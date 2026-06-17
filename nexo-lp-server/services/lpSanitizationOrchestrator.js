const { EventEmitter } = require('events');
const TemplateRepository = require('../models/repositories/TemplateRepository');
const PreviewService = require('./lpPreviewService');
const BridgeAdapter = require('./lpBridgeAdapter.cjs');

const HYBRID_SANITIZE_PROMPT = `You are a strict HTML sanitizer and frontend optimizer for the NEXO Digital landing page store (https://www.nexo-digital.app/pt).

TASK: Sanitize, debug, and lightly improve the landing page HTML below.

RULES:
1. Remove all brand names, personal names, emails, phone numbers, addresses, and real business data.
2. Replace removed data with neutral placeholder content for NEXO Digital:
   - Brand name: NEXO Digital
   - Site: https://www.nexo-digital.app/pt
   - Slogan: We create digital experiences that convert.
   - Email: contato@nexo-digital.app
   - Primary colors: #6366F1 and #8B5CF6
3. Fix any obvious HTML/CSS/JS bugs while preserving layout, structure, and Tailwind classes.
4. Keep images as generic placeholders (Unsplash generic keywords or SVG placeholders).
5. Lightly improve copy and spacing if it improves conversion, but do NOT add new sections.
6. Return ONLY the complete, self-contained HTML code. No markdown fences, no explanations, no comments outside the code.

HTML to sanitize and improve:`;

const REVIEW_PROMPT = `Review the sanitized landing page HTML below for the NEXO Digital template store.

Your job is to:
1. Decide if the HTML is technically correct, safe, and ready to publish.
2. Propose corrections if anything is wrong.
3. Categorize the template and generate rich marketplace metadata.

Reply ONLY with a JSON object matching this exact schema (no markdown, no explanations):
{
  "ok": true,
  "corrections": [],
  "metadata": {
    "category": "saas",
    "subcategory": "b2b-saas",
    "tags": ["modern", "clean", "pricing"],
    "niche": "B2B SaaS",
    "audience": "Startup founders and product teams",
    "difficulty": "beginner",
    "features": ["Hero section", "Pricing table", "Testimonials", "CTA"],
    "colors": ["#6366F1", "#8B5CF6", "#0F172A"],
    "style": "modern minimal",
    "seoKeywords": ["saas landing page", "b2b software"],
    "badges": ["Trending"],
    "whyBuy": "High-converting B2B layout with clear pricing and social proof.",
    "useCases": ["Product launch", "SaaS signup", "Feature announcement"]
  }
}

If corrections are needed, set ok to false and list them:
{
  "ok": false,
  "corrections": ["Fix broken closing div", "Replace remaining brand name"],
  "metadata": { ...same schema... }
}

HTML to review:`;

const REFINE_PROMPT = `You are a strict HTML sanitizer and frontend optimizer for the NEXO Digital landing page store.

Apply the corrections below to the provided HTML.

RULES:
1. Keep the NEXO Digital placeholders already applied.
2. Fix all listed issues.
3. Return ONLY the complete, self-contained HTML code. No markdown fences, no explanations, no comments outside the code.

Corrections:`;

class SanitizationOrchestrator extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(50);
  }

  /**
   * Start the automatic sanitization pipeline.
   * @param {string} sessionId
   * @param {string} originalHtml
   * @param {string} originalPrompt
   * @param {string|null} kimiChatUrl
   * @param {string} userId
   */
  async startSanitization(sessionId, originalHtml, originalPrompt, kimiChatUrl, userId) {
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

      const step1Result = await this._sendToKimi(
        context,
        `${HYBRID_SANITIZE_PROMPT}\n\n${originalHtml}`,
        { mode: 'instant', phase: 'sanitize' }
      );

      let currentHtml = this._extractHtml(step1Result.content);
      log.attempts.push({
        step: 1,
        mode: 'instant',
        finishedAt: new Date().toISOString(),
        responseLength: currentHtml.length,
      });

      this.emit('sanitization:progress', { sessionId, step: 1, htmlLength: currentHtml.length });

      // Step 2: thinking review + metadata
      this.emit('sanitization:step', { sessionId, step: 2, mode: 'thinking' });

      const step2Result = await this._sendToKimi(
        context,
        `${REVIEW_PROMPT}\n\n${currentHtml}`,
        { mode: 'thinking', phase: 'review' }
      );

      const review = this._parseReview(step2Result.content);
      log.attempts.push({
        step: 2,
        mode: 'thinking',
        finishedAt: new Date().toISOString(),
        response: JSON.stringify(review).slice(0, 1000),
      });

      // Step 3: thinking refinement if corrections needed
      if (!review.ok && Array.isArray(review.corrections) && review.corrections.length > 0) {
        this.emit('sanitization:step', { sessionId, step: 3, mode: 'thinking' });

        const correctionsText = review.corrections.map((c, i) => `${i + 1}. ${c}`).join('\n');
        const step3Result = await this._sendToKimi(
          context,
          `${REFINE_PROMPT}\n${correctionsText}\n\nHTML to refine:\n${currentHtml}`,
          { mode: 'thinking', phase: 'refine' }
        );

        currentHtml = this._extractHtml(step3Result.content);
        log.attempts.push({
          step: 3,
          mode: 'thinking',
          finishedAt: new Date().toISOString(),
          responseLength: currentHtml.length,
        });
      }

      // Merge metadata with defaults
      const metadata = this._normalizeMetadata(review.metadata);

      // Finalize
      await TemplateRepository.update(template.id, {
        sanitized_html: currentHtml,
        html: currentHtml,
        status: 'available',
        is_public: 1,
        category: metadata.category,
        subcategory: metadata.subcategory,
        tags: Array.isArray(metadata.tags) ? metadata.tags.join(',') : null,
        metadata_json: JSON.stringify(metadata),
        sanitization_log: JSON.stringify(log),
      });

      await PreviewService.updatePublicPreview(template.public_preview_token, currentHtml);

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
      await TemplateRepository.update(template.id, {
        status: 'failed',
        sanitization_log: JSON.stringify(log),
      });

      this.emit('sanitization:error', { sessionId, error: err.message });
      return { success: false, error: err.message, log };
    }
  }

  async _sendToKimi(context, prompt, options = {}) {
    return BridgeAdapter.sendMessage(context, prompt, {
      mode: options.mode || 'instant',
      newChat: false,
      phaseTimeoutMs: 0,
      ...options,
    });
  }

  _extractHtml(text) {
    if (!text) return '';
    const fenceMatch = text.match(/```(?:html)?\s*([\s\S]*?)```/i);
    if (fenceMatch) return fenceMatch[1].trim();
    const trimmed = text.trim();
    if (/<!doctype|<html|<div|<section/i.test(trimmed)) return trimmed;
    return trimmed;
  }

  _parseReview(text) {
    if (!text) return { ok: false, corrections: ['Empty review response'] };
    const trimmed = text.trim();

    const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed.ok === true) return { ok: true, corrections: [], metadata: parsed.metadata };
        if (parsed.ok === false) {
          return {
            ok: false,
            corrections: Array.isArray(parsed.corrections) ? parsed.corrections : [String(parsed.corrections)],
            metadata: parsed.metadata,
          };
        }
      } catch {
        // fall through
      }
    }

    const lower = trimmed.toLowerCase();
    if (lower.startsWith('ok') || lower === 'ok.') {
      return { ok: true, corrections: [], metadata: {} };
    }

    return { ok: false, corrections: [trimmed.slice(0, 500)], metadata: {} };
  }

  _normalizeMetadata(metadata = {}) {
    const category = metadata.category || 'landing';
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
