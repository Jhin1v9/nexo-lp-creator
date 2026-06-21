const { EventEmitter } = require('events');
const TemplateRepository = require('../models/repositories/TemplateRepository');
const PreviewService = require('./lpPreviewService');
const TemplateScreenshotService = require('./lpTemplateScreenshotService');
const BridgeAdapter = require('./lpBridgeAdapter.cjs');
const { ResponseParser } = require('./luna/ResponseParser.cjs');
const {
  sanitizePrompt,
  sanitizeRetryPrompt,
  sanitizeQaPrompt,
  sanitizeMetadataPrompt,
  sanitizeRefinePrompt,
} = require('./prompts/nexoPromptPack');

const buildSanitizePrompt = (originalHtml) => sanitizePrompt(originalHtml);
const buildSanitizeRetryPrompt = (originalHtml) => sanitizeRetryPrompt(originalHtml);
const buildQaPrompt = (html) => sanitizeQaPrompt(html);
const buildMetadataPrompt = (html) => sanitizeMetadataPrompt(html);
const buildRefinePrompt = (html, corrections) => sanitizeRefinePrompt(html, corrections);

class SanitizationOrchestrator extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(50);
    const concurrency = parseInt(process.env.SANITIZE_CONCURRENCY, 10);
    this.concurrency = Number.isNaN(concurrency) ? 3 : concurrency;
    this.running = 0;
    this.queue = [];
    this.lastKimiRequestAt = 0;
    const delay = parseInt(process.env.SANITIZE_KIMI_DELAY_MS, 10);
    this.kimiRequestDelayMs = Number.isNaN(delay) ? 3000 : delay;
  }

  async _enqueue(work) {
    return new Promise((resolve, reject) => {
      this.queue.push({ work, resolve, reject });
      this._drain();
    });
  }

  async _drain() {
    if (this.running >= this.concurrency || this.queue.length === 0) return;

    const { work, resolve, reject } = this.queue.shift();
    this.running += 1;

    try {
      const result = await work();
      resolve(result);
    } catch (err) {
      reject(err);
    } finally {
      this.running -= 1;
      setImmediate(() => this._drain());
    }
  }

  /**
   * Start the automatic sanitization pipeline.
   * Requests are queued so that at most SANITIZE_CONCURRENCY (default 3)
   * sanitizations run simultaneously, preventing Chrome from spawning too
   * many pages at once.
   * @param {string} sessionId
   * @param {string} originalHtml
   * @param {string} originalPrompt
   * @param {string|null} kimiChatUrl
   * @param {string} userId
   */
  async startSanitization(sessionId, originalHtml, originalPrompt, kimiChatUrl, userId) {
    return this._enqueue(() => this._runSanitization(sessionId, originalHtml, originalPrompt, kimiChatUrl, userId));
  }

  async _runSanitization(sessionId, originalHtml, originalPrompt, kimiChatUrl, userId) {
    const template = await TemplateRepository.findBySessionId(sessionId);
    if (!template) {
      throw new Error(`Template not found for session ${sessionId}`);
    }

    const log = {
      startedAt: new Date().toISOString(),
      attempts: [],
    };

    const context = {
      userId,
      sessionId,
      chatUrl: kimiChatUrl || null,
      retries: 0,
    };

    try {
      this.emit('sanitization:step', { sessionId, step: 1, mode: 'instant' });

      let currentHtml = '';
      let step1Result = null;
      for (let attempt = 1; attempt <= 2; attempt += 1) {
        const prompt = attempt === 1
          ? buildSanitizePrompt(originalHtml)
          : buildSanitizeRetryPrompt(originalHtml);

        step1Result = await this._sendToKimi(
          context,
          prompt,
          { mode: 'instant', phase: 'sanitize', newChat: true }
        );

        currentHtml = this._extractHtml(step1Result.content);

        // Fallback: Kimi sometimes returns a downloadable HTML file instead of
        // pasting the code. Try to fetch the attached file from the chat page.
        if (!this._isValidHtml(currentHtml) && this._looksLikeFileResponse(step1Result.content)) {
          const attachedHtml = await BridgeAdapter.fetchAttachedHtml(context, step1Result.content);
          if (attachedHtml && this._isValidHtml(attachedHtml)) {
            currentHtml = attachedHtml;
            log.attempts.push({
              step: 1,
              mode: 'instant',
              attempt,
              note: 'HTML fetched from attached file',
              finishedAt: new Date().toISOString(),
              responseLength: currentHtml.length,
              valid: true,
            });
          }
        }

        log.attempts.push({
          step: 1,
          mode: 'instant',
          attempt,
          finishedAt: new Date().toISOString(),
          responseLength: currentHtml.length,
          valid: this._isValidHtml(currentHtml),
        });

        this.emit('sanitization:progress', { sessionId, step: 1, attempt, htmlLength: currentHtml.length });

        if (this._isValidHtml(currentHtml)) break;
      }

      if (!this._isValidHtml(currentHtml)) {
        throw new Error(`Step 1 failed to produce valid HTML after retries (length=${currentHtml.length})`);
      }

      // Step 2: QA review — check if HTML is technically sound.
      this.emit('sanitization:step', { sessionId, step: 2, mode: 'thinking' });

      const qaResult = await this._sendToKimi(
        context,
        buildQaPrompt(currentHtml),
        { mode: 'thinking', phase: 'qa' }
      );

      const qa = this._parseQaReview(qaResult.content);
      log.attempts.push({
        step: 2,
        mode: 'thinking',
        phase: 'qa',
        finishedAt: new Date().toISOString(),
        response: JSON.stringify(qa).slice(0, 1000),
      });

      // Step 3: refine if QA found real issues.
      if (!qa.ok && Array.isArray(qa.corrections) && qa.corrections.length > 0) {
        this.emit('sanitization:step', { sessionId, step: 3, mode: 'thinking' });

        const correctionsText = qa.corrections.map((c, i) => `${i + 1}. ${c}`).join('\n');
        const step3Result = await this._sendToKimi(
          context,
          buildRefinePrompt(currentHtml, correctionsText),
          { mode: 'thinking', phase: 'refine' }
        );

        const refinedHtml = this._extractHtml(step3Result.content);
        log.attempts.push({
          step: 3,
          mode: 'thinking',
          finishedAt: new Date().toISOString(),
          responseLength: refinedHtml.length,
          valid: this._isValidHtml(refinedHtml),
        });

        if (this._isValidHtml(refinedHtml)) {
          currentHtml = refinedHtml;
        } else {
          log.attempts.push({
            step: 3,
            note: 'Refined HTML invalid; keeping previous HTML',
            previousValid: this._isValidHtml(currentHtml),
          });
        }
      }

      // Step 4: metadata extraction — separate prompt so Kimi doesn't confuse
      // JSON metadata with the large HTML response.
      this.emit('sanitization:step', { sessionId, step: 4, mode: 'thinking' });

      const metadataResult = await this._sendToKimi(
        context,
        buildMetadataPrompt(currentHtml),
        { mode: 'thinking', phase: 'metadata' }
      );

      const metadataPayload = this._parseMetadata(metadataResult.content);
      log.attempts.push({
        step: 4,
        mode: 'thinking',
        phase: 'metadata',
        finishedAt: new Date().toISOString(),
        response: JSON.stringify(metadataPayload).slice(0, 1000),
      });

      // Merge metadata with defaults
      const metadata = this._normalizeMetadata(metadataPayload);

      // Finalize: successful sanitization means the template is approved for sale.
      await TemplateRepository.update(template.id, {
        sanitized_html: currentHtml,
        html: currentHtml,
        category: metadata.category,
        subcategory: metadata.subcategory,
        tags: Array.isArray(metadata.tags) ? metadata.tags.join(',') : null,
        metadata_json: JSON.stringify(metadata),
        sanitization_log: JSON.stringify(log),
      });

      await PreviewService.updatePublicPreview(template.public_preview_token, currentHtml);

      if (template.status === 'unreviewed') {
        const lpTemplateService = require('./lpTemplateService');
        await lpTemplateService.promoteToReviewed(template.id);
      } else {
        await TemplateRepository.update(template.id, {
          status: 'approved',
          is_public: 2,
        });
      }

      // Generate thumbnail in the background; never fail sanitization because of a screenshot.
      TemplateScreenshotService.captureTemplateScreenshot(template.id, template.public_preview_token)
        .then((thumbnailUrl) => TemplateRepository.update(template.id, { thumbnail_url: thumbnailUrl }))
        .catch((err) => console.error(`[LOJA] Screenshot failed for ${template.id}:`, err.message));

      this.emit('sanitization:complete', {
        sessionId,
        templateId: template.id,
        success: true,
        htmlLength: currentHtml.length,
        metadata,
      });

      return { success: true, templateId: template.id, log, metadata };
    } catch (err) {
      log.error = err.message;

      if (template.status === 'unreviewed') {
        // Already unreviewed: keep it that way and just log the sanitization attempt.
        try {
          await TemplateRepository.update(template.id, {
            sanitization_log: JSON.stringify(log),
          });
        } catch (updateErr) {
          log.error = `${err.message}; log update failed: ${updateErr.message}`;
        }
        this.emit('sanitization:error', { sessionId, error: log.error });
        return { success: false, error: log.error, log };
      }

      // Last-resort fallback for sanitizing templates: mark as unreviewed and sell at half price.
      const fallbackHtml = this._basicSanitizeFallback(originalHtml);
      try {
        await TemplateRepository.update(template.id, {
          sanitized_html: fallbackHtml,
          html: fallbackHtml,
          status: 'unreviewed',
          is_public: 1,
          unreviewed_reason: 'sanitization-review-failed',
          sanitization_log: JSON.stringify(log),
        });

        const originalPrices = {
          stars: template.original_price_stars || template.price_stars,
          suns: template.original_price_suns || template.price_suns,
          moons: template.original_price_moons || template.price_moons,
        };
        const discountedPrices = {
          stars: Math.max(1, Math.ceil(originalPrices.stars / 2)),
          suns: Math.max(0, Math.ceil(originalPrices.suns / 2)),
          moons: Math.max(0, Math.ceil(originalPrices.moons / 2)),
        };
        await TemplateRepository.update(template.id, {
          price_stars: discountedPrices.stars,
          price_suns: discountedPrices.suns,
          price_moons: discountedPrices.moons,
          original_price_stars: originalPrices.stars,
          original_price_suns: originalPrices.suns,
          original_price_moons: originalPrices.moons,
        });

        await PreviewService.updatePublicPreview(template.public_preview_token, fallbackHtml);

        // Generate thumbnail for the fallback version as well.
        TemplateScreenshotService.captureTemplateScreenshot(template.id, template.public_preview_token)
          .then((thumbnailUrl) => TemplateRepository.update(template.id, { thumbnail_url: thumbnailUrl }))
          .catch((err) => console.error(`[LOJA] Screenshot failed for ${template.id}:`, err.message));
      } catch (updateErr) {
        log.error = `${err.message}; fallback update failed: ${updateErr.message}`;
        await TemplateRepository.update(template.id, {
          status: 'failed',
          sanitization_log: JSON.stringify(log),
        });
        this.emit('sanitization:error', { sessionId, error: log.error });
        return { success: false, error: log.error, log };
      }

      this.emit('sanitization:complete', {
        sessionId,
        templateId: template.id,
        success: false,
        htmlLength: fallbackHtml.length,
        metadata: this._normalizeMetadata(),
        fallback: true,
        unreviewed: true,
        error: err.message,
      });

      return { success: false, templateId: template.id, log, metadata: this._normalizeMetadata(), fallback: true, unreviewed: true, error: err.message };
    } finally {
      // v12.5-fix: Free the Chrome page immediately after sanitization so batch
      // jobs don't accumulate one tab per template.
      if (context?.userId) {
        BridgeAdapter.closeUserPage(context.userId).catch((err) =>
          console.warn(`[SANITIZE] Failed to close user page for ${context.userId}:`, err.message)
        );
      }
    }
  }

  async _sendToKimi(context, prompt, options = {}) {
    // Slow down requests to avoid Kimi rate limits when sanitizing many templates.
    const now = Date.now();
    const elapsed = now - this.lastKimiRequestAt;
    if (elapsed < this.kimiRequestDelayMs) {
      await new Promise((resolve) => setTimeout(resolve, this.kimiRequestDelayMs - elapsed));
    }
    this.lastKimiRequestAt = Date.now();

    return BridgeAdapter.sendMessage(context, prompt, {
      mode: options.mode || 'instant',
      // Only force a fresh Kimi chat for the first prompt of this template.
      // Subsequent prompts (QA, metadata, refine) reuse the same chat/tab so
      // we don't keep creating/closing tabs inside a single sanitization.
      newChat: options.newChat ?? !context.chatUrl,
      hardRefresh: false,
      phaseTimeoutMs: 0,
      ...options,
    });
  }

  _extractHtml(text) {
    if (!text) return '';

    // Prefer fenced code blocks when present, then run the same document
    // extraction so trailing markdown/explanations are discarded.
    const fenceMatch = text.match(/```(?:html)?\s*([\s\S]*?)```/i);
    if (fenceMatch) return this._extractHtmlDocument(fenceMatch[1].trim());

    return this._extractHtmlDocument(text.trim());
  }

  _extractHtmlDocument(trimmed) {
    // Extract the first full HTML document only. Kimi sometimes returns the
    // original HTML followed by the sanitized copy; a greedy match would
    // concatenate both documents, so we stop at the first </html>.
    const docMatch = trimmed.match(/(<!DOCTYPE\s+html[\s\S]*?<\/html\s*>)/i);
    if (docMatch) return docMatch[1].trim();

    const htmlMatch = trimmed.match(/(<html[\s\S]*?<\/html\s*>)/i);
    if (htmlMatch) return htmlMatch[1].trim();

    // Fallback: find the first </html> and slice from the document start.
    // This handles responses where extra text appears after the closing tag.
    const lower = trimmed.toLowerCase();
    const htmlCloseIdx = lower.indexOf('</html>');
    if (htmlCloseIdx !== -1) {
      const startIdx = lower.indexOf('<!doctype html>');
      return trimmed.slice(startIdx >= 0 ? startIdx : 0, htmlCloseIdx + 7).trim();
    }

    // Fallback: largest contiguous block that starts with a common tag
    const blockMatch = trimmed.match(/(<(?:section|div|header|footer|nav|main|body|head)[\s\S]*)/i);
    if (blockMatch) return blockMatch[1].trim();

    return trimmed;
  }

  /**
   * Detect when Kimi responded with a downloadable file instead of pasted code.
   */
  _looksLikeFileResponse(text) {
    if (!text || typeof text !== 'string') return false;
    const lower = text.toLowerCase();
    const hasHtmlRef = /[a-z0-9_-]+\.html/i.test(text);
    return (
      lower.includes('download') ||
      lower.includes('download:') ||
      lower.includes('anexo') ||
      lower.includes('attached') ||
      lower.includes('arquivo') ||
      (hasHtmlRef && lower.includes('file'))
    );
  }

  _isValidHtml(html) {
    if (!html || html.length < 200) return false;
    const lower = html.toLowerCase().trim();
    const hasDocType = lower.includes('<!doctype html>');
    const hasHtml = lower.includes('<html');
    const hasClosingHtml = lower.includes('</html>');
    const hasBody = lower.includes('<body') || lower.includes('<main') || lower.includes('<section');
    return (hasDocType || hasHtml) && hasBody && hasClosingHtml;
  }

  _basicSanitizeFallback(originalHtml) {
    return originalHtml
      .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, 'contato@nexo-digital.app')
      .replace(/\b(?:\+?\d{1,3}[-.\s]?)?\(?\d{2,4}\)?[-.\s]?\d{3,5}[-.\s]?\d{3,5}\b/g, '')
      .replace(/Acme|Acme\s+Corp|Acme\s+Digital/gi, 'NEXO Digital')
      .replace(/acme-digital\.app|acme\.com|acme\.app/gi, 'nexo-digital.app');
  }

  _parseReview(text) {
    if (!text) return { ok: false, corrections: ['Empty review response'], metadata: {} };

    // Use the same robust parser as the review phase to handle markdown fences,
    // explanatory text, truncated JSON, and the {ok, corrections, metadata} schema.
    const normalized = ResponseParser.extractJsonObject(text);
    if (normalized && typeof normalized.passed === 'boolean') {
      const corrections = Array.isArray(normalized.issues)
        ? normalized.issues.map((i) => (typeof i === 'string' ? i : i.message || String(i)))
        : (Array.isArray(normalized.suggestions) ? normalized.suggestions : []);
      return {
        ok: normalized.passed,
        corrections,
        metadata: normalized.metadata || {},
      };
    }

    // Last-resort raw scan for the {ok, corrections, metadata} shape.
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        if (typeof parsed.ok === 'boolean') {
          return {
            ok: parsed.ok,
            corrections: Array.isArray(parsed.corrections) ? parsed.corrections : [],
            metadata: parsed.metadata || {},
          };
        }
      } catch {
        // fall through
      }
    }

    const lower = text.trim().toLowerCase();
    if (lower.startsWith('ok') || lower === 'ok.') {
      return { ok: true, corrections: [], metadata: {} };
    }

    return { ok: false, corrections: [text.trim().slice(0, 500)], metadata: {} };
  }

  _parseQaReview(text) {
    if (!text) return { ok: false, corrections: ['Empty QA response'] };

    const normalized = ResponseParser.extractJsonObject(text);
    if (normalized && typeof normalized.ok === 'boolean') {
      return {
        ok: normalized.ok,
        corrections: Array.isArray(normalized.corrections) ? normalized.corrections : [],
      };
    }

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        if (typeof parsed.ok === 'boolean') {
          return {
            ok: parsed.ok,
            corrections: Array.isArray(parsed.corrections) ? parsed.corrections : [],
          };
        }
      } catch {
        // fall through
      }
    }

    const lower = text.trim().toLowerCase();
    if (lower.startsWith('ok') || lower === 'ok.') {
      return { ok: true, corrections: [] };
    }

    return { ok: false, corrections: [text.trim().slice(0, 500)] };
  }

  _parseMetadata(text) {
    if (!text) return {};

    const normalized = ResponseParser.extractJsonObject(text);
    if (normalized && normalized.metadata && typeof normalized.metadata === 'object') {
      return normalized.metadata;
    }
    if (normalized && typeof normalized.category === 'string') {
      // Flat metadata object (no wrapping "metadata" key)
      return normalized;
    }

    // Robust scan: find the first balanced JSON object that looks like metadata.
    const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    const payload = codeBlockMatch ? codeBlockMatch[1] : text;
    for (let i = 0; i < payload.length; i += 1) {
      if (payload[i] !== '{') continue;
      let depth = 0;
      let inString = false;
      let escape = false;
      for (let j = i; j < payload.length; j += 1) {
        const char = payload[j];
        if (inString) {
          if (escape) escape = false;
          else if (char === '\\') escape = true;
          else if (char === '"') inString = false;
        } else if (char === '"') {
          inString = true;
        } else if (char === '{') {
          depth += 1;
        } else if (char === '}') {
          depth -= 1;
          if (depth === 0) {
            const candidate = payload.slice(i, j + 1);
            try {
              const parsed = JSON.parse(candidate);
              if (parsed && typeof parsed === 'object') {
                if (parsed.metadata && typeof parsed.metadata === 'object') return parsed.metadata;
                if (typeof parsed.category === 'string' || Array.isArray(parsed.tags)) return parsed;
              }
            } catch {
              // keep scanning
            }
            break;
          }
        }
      }
    }

    return {};
  }

  _normalizeCategory(input) {
    const allowed = ['business', 'startup', 'portfolio', 'ecommerce', 'saas', 'agency', 'personal', 'event', 'landing', 'other'];
    const normalized = String(input || 'landing').toLowerCase().trim();
    if (allowed.includes(normalized)) return normalized;
    if (normalized.includes('saas')) return 'saas';
    if (normalized.includes('agency')) return 'agency';
    if (normalized.includes('restaurant') || normalized.includes('food') || normalized.includes('service')) return 'business';
    if (normalized.includes('shop') || normalized.includes('store') || normalized.includes('ecommerce') || normalized.includes('e-commerce')) return 'ecommerce';
    if (normalized.includes('portfolio')) return 'portfolio';
    if (normalized.includes('event')) return 'event';
    if (normalized.includes('personal')) return 'personal';
    if (normalized.includes('startup')) return 'startup';
    return 'landing';
  }

  _normalizeMetadata(metadata = {}) {
    const category = this._normalizeCategory(metadata.category);
    return {
      category,
      subcategory: metadata.subcategory || category,
      tags: Array.isArray(metadata.tags) ? metadata.tags : [],
      niche: metadata.niche || '',
      audience: metadata.audience || '',
      difficulty: metadata.difficulty || 'beginner',
      features: Array.isArray(metadata.features) ? metadata.features : [],
      colors: Array.isArray(metadata.colors) ? metadata.colors : [],
      style: metadata.style || '',
      seoKeywords: Array.isArray(metadata.seoKeywords) ? metadata.seoKeywords : [],
      badges: Array.isArray(metadata.badges) ? metadata.badges : [],
      whyBuy: metadata.whyBuy || '',
      useCases: Array.isArray(metadata.useCases) ? metadata.useCases : [],
    };
  }
}

module.exports = new SanitizationOrchestrator();
