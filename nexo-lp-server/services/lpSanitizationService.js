const crypto = require('crypto');
const TemplateRepository = require('../models/repositories/TemplateRepository');
const PreviewService = require('./lpPreviewService');
const BridgeAdapter = require('./lpBridgeAdapter.cjs');

const SANITIZE_PROMPT = `You are a strict HTML sanitizer for the NEXO Digital landing page store (https://www.nexo-digital.app/pt).

Task: sanitize the landing page HTML below.
Rules:
- Remove all brand names, personal names, emails, phone numbers, addresses, and real business data.
- Replace removed data with neutral placeholder content for NEXO Digital.
- Keep the layout, structure, Tailwind classes, React components, and images (use placeholder image URLs if originals identify real brands).
- Do NOT add explanations. Return ONLY the sanitized HTML code.

HTML to sanitize:`;

const REVIEW_PROMPT = `Review the sanitized landing page HTML below. Is it technically correct, safe, and ready to be published in the NEXO Digital store?

Reply ONLY with "OK" if it is ready. If not, list the minimal corrections needed (no code, just instructions).`;

const MAX_RETRIES = 3;

class SanitizationService {
  hashPrompt(prompt) {
    return crypto.createHash('sha256').update(prompt).digest('hex');
  }

  makeCensoredPrompt() {
    return '[PROMPT BLOQUEADO — compre este template na LOJA para desbloquear o prompt original]';
  }

  async startSanitization(sessionId, originalHtml, originalPrompt, kimiChatUrl, userId) {
    const template = await TemplateRepository.findBySessionId(sessionId);
    if (!template) throw new Error('Template not found for session ' + sessionId);

    const log = { attempts: [], startedAt: new Date().toISOString() };

    try {
      // Step 1: instant sanitize
      log.attempts.push({ step: 'sanitize', mode: 'instant', startedAt: new Date().toISOString() });
      const sanitized = await this._sendToKimi(originalHtml, 'instant', kimiChatUrl, SANITIZE_PROMPT);
      log.attempts[log.attempts.length - 1].finishedAt = new Date().toISOString();
      log.attempts[log.attempts.length - 1].responseLength = sanitized.length;

      // Step 2: thinking review
      log.attempts.push({ step: 'review', mode: 'thinking', startedAt: new Date().toISOString() });
      let review = await this._sendToKimi(sanitized, 'thinking', kimiChatUrl, REVIEW_PROMPT);
      log.attempts[log.attempts.length - 1].finishedAt = new Date().toISOString();
      log.attempts[log.attempts.length - 1].response = review.slice(0, 500);

      let finalHtml = sanitized;
      let retryCount = 0;

      while (!this._isReviewOk(review) && retryCount < MAX_RETRIES) {
        retryCount++;
        log.attempts.push({ step: `retry-${retryCount}`, mode: 'instant', startedAt: new Date().toISOString() });
        const retryPrompt = `${SANITIZE_PROMPT}\n\nAdditional corrections requested by reviewer:\n${review}\n\nHTML to sanitize:\n${originalHtml}`;
        finalHtml = await this._sendToKimi(retryPrompt, 'instant', kimiChatUrl);
        log.attempts[log.attempts.length - 1].finishedAt = new Date().toISOString();

        log.attempts.push({ step: `retry-review-${retryCount}`, mode: 'thinking', startedAt: new Date().toISOString() });
        review = await this._sendToKimi(finalHtml, 'thinking', kimiChatUrl, REVIEW_PROMPT);
        log.attempts[log.attempts.length - 1].finishedAt = new Date().toISOString();
        log.attempts[log.attempts.length - 1].response = review.slice(0, 500);
      }

      const ok = this._isReviewOk(review);
      const status = ok ? 'available' : 'failed';

      await TemplateRepository.update(template.id, {
        sanitized_html: finalHtml,
        html: ok ? finalHtml : template.html,
        status,
        sanitization_log: JSON.stringify(log),
        is_public: ok ? 1 : 0,
      });

      if (ok) {
        PreviewService.updatePublicPreview(template.public_preview_token, finalHtml);
      }

      return { success: ok, templateId: template.id, log };
    } catch (err) {
      log.error = err.message;
      await TemplateRepository.update(template.id, {
        status: 'failed',
        sanitization_log: JSON.stringify(log),
      });
      return { success: false, error: err.message, log };
    }
  }

  async _sendToKimi(content, mode, chatUrl, promptPrefix) {
    const context = { userId: 'loja-sanitizer', chatUrl };
    const prompt = promptPrefix ? `${promptPrefix}\n\n${content}` : content;
    const result = await BridgeAdapter.sendMessage(context, prompt, {
      mode,
      newChat: false,
      phaseTimeoutMs: 0,
    });
    return result.content || '';
  }

  _isReviewOk(text) {
    if (!text) return false;
    const t = text.trim().toLowerCase();
    return t.startsWith('ok') || t === 'ok.' || t.includes('pronto para ser publicado');
  }
}

module.exports = new SanitizationService();
