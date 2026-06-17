/**
 * NEXO Landing Page Creator v3.0 - Template Service
 *
 * Manages reusable landing page templates.
 * Provides CRUD operations, LOJA publishing, purchasing, and template
 * application for new sessions.
 *
 * @module services/lpTemplateService
 * @version 3.0.0
 */

const crypto = require('crypto');
const TemplateRepository = require('../models/repositories/TemplateRepository');
const TemplatePurchaseRepository = require('../models/repositories/TemplatePurchaseRepository');
const SessionRepository = require('../models/repositories/SessionRepository');
const CurrencyRepository = require('../models/repositories/CurrencyRepository');
const PreviewService = require('./lpPreviewService');
const SanitizationOrchestrator = require('./lpSanitizationOrchestrator');
const config = require('../config/nexo-lp-config');

class TemplateService {
  constructor() {
    this.repository = TemplateRepository;
  }

  /**
   * Create a new template
   * @param {object} data - Template data
   * @returns {object} Created template
   */
  async createTemplate(data) {
    if (!data.name) {
      throw new Error('Template name is required');
    }

    return this.repository.create({
      name: data.name,
      description: data.description || '',
      category: data.category || 'landing',
      stack: data.stack || config.stacks.default,
      thumbnailUrl: data.thumbnailUrl || null,
      html: data.html || null,
      css: data.css || null,
      js: data.js || null,
      config: data.config || null,
      tags: data.tags || [],
      source: data.source || 'manual',
      rating: data.rating || 0,
      isPublic: data.isPublic !== undefined ? data.isPublic : true,
      createdBy: data.createdBy || null,
    });
  }

  /**
   * Get template by ID
   * @param {string} id
   * @returns {object|null}
   */
  async getTemplateById(id) {
    if (!id) {
      throw new Error('Template ID is required');
    }
    return this.repository.findById(id);
  }

  /**
   * List templates with filtering and pagination
   * @param {object} filters - { category, stack, search, isPublic }
   * @param {number} page
   * @param {number} limit
   * @returns {object}
   */
  async listTemplates(filters = {}, page = 1, limit = 20) {
    return this.repository.list(filters, page, limit);
  }

  /**
   * Update a template
   * @param {string} id
   * @param {object} data
   * @returns {object|null}
   */
  async updateTemplate(id, data) {
    if (!id) {
      throw new Error('Template ID is required');
    }
    return this.repository.update(id, data);
  }

  /**
   * Delete a template
   * @param {string} id
   * @returns {boolean}
   */
  async deleteTemplate(id) {
    if (!id) {
      throw new Error('Template ID is required');
    }
    return this.repository.delete(id);
  }

  /**
   * Publish a session's generated landing page to the LOJA.
   * Creates a template in 'sanitizing' status and triggers background
   * sanitization. Public preview is available immediately.
   * @param {string} sessionId
   * @param {string} userId
   * @returns {object} Created template
   */
  async publishFromSession(sessionId, userId) {
    const session = await SessionRepository.findById(sessionId);
    if (!session) throw new Error('Session not found');
    if (session.user_id !== userId) throw new Error('Unauthorized');

    const existing = await TemplateRepository.findBySessionId(sessionId);
    if (existing) return existing;

    const html = session.current_html || '';
    const prompt = session.initial_prompt || '';
    const token = PreviewService.generatePublicToken();

    let metadataKimiChatUrl = null;
    if (session.metadata_json) {
      try {
        metadataKimiChatUrl = JSON.parse(session.metadata_json).kimiChatUrl || null;
      } catch {
        metadataKimiChatUrl = null;
      }
    }
    const chatUrl = session.kimi_chat_url || metadataKimiChatUrl || null;

    const template = await TemplateRepository.create({
      name: this._generateName(session),
      description: this._generateDescription(session),
      category: 'landing',
      stack: session.stack || 'react-tailwind',
      html,
      original_html: html,
      status: 'sanitizing',
      public_preview_token: token,
      prompt_hash: this._hashPrompt(prompt),
      prompt_censored: '[PROMPT BLOCKED — purchase this template in the LOJA to unlock the original prompt]',
      price_stars: config.loja.defaultPrices.stars,
      price_suns: config.loja.defaultPrices.suns,
      price_moons: config.loja.defaultPrices.moons,
      source: 'generated',
      created_by: userId,
      session_id: sessionId,
      kimi_chat_url: chatUrl,
      is_public: 0,
    });

    await PreviewService.publishPublicPreview(sessionId, this._blockedPreviewHtml(template.name), token);

    SanitizationOrchestrator.startSanitization(sessionId, html, prompt, chatUrl, userId)
      .catch((err) => console.error('[LOJA] Sanitization orchestrator failed:', err.message));

    return template;
  }

  /**
   * Buy a template from the LOJA.
   * Deducts the template's price from the user's currency balance and
   * records the purchase.
   * @param {string} templateId
   * @param {string} userId
   * @returns {object} Purchase record
   */
  async buyTemplate(templateId, userId) {
    const template = await TemplateRepository.findById(templateId);
    if (!template) throw new Error('Template not found');
    if (template.status !== 'available') throw new Error('Template is not available yet');

    const alreadyPurchased = await TemplatePurchaseRepository.findByTemplateAndUser(templateId, userId);
    if (alreadyPurchased) return alreadyPurchased;

    const cost = { stars: template.price_stars, suns: template.price_suns, moons: template.price_moons };
    await CurrencyRepository.deduct(userId, cost);

    return TemplatePurchaseRepository.create({
      template_id: templateId,
      user_id: userId,
      price_stars: cost.stars,
      price_suns: cost.suns,
      price_moons: cost.moons,
    });
  }

  /**
   * Use a purchased template as the starting point for a session.
   * If sessionId is provided, applies the template to that existing session
   * (after verifying ownership); otherwise creates a new session.
   * Copies the template's code into the session and increments usage.
   * @param {string} templateId
   * @param {string} userId
   * @param {string|null} sessionId
   * @returns {object} Session
   */
  async useTemplate(templateId, userId, sessionId = null) {
    const template = await TemplateRepository.findById(templateId);
    if (!template) throw new Error('Template not found');
    if (template.status !== 'available') throw new Error('Template is not available yet');

    const purchased = await TemplatePurchaseRepository.findByTemplateAndUser(templateId, userId);
    if (!purchased) throw new Error('Template not purchased');

    await TemplateRepository.incrementUsage(templateId);

    let targetSession;
    if (sessionId) {
      const existingSession = await SessionRepository.findById(sessionId);
      if (!existingSession) throw new Error('Session not found');
      if (existingSession.user_id !== userId) throw new Error('Unauthorized');
      targetSession = existingSession;
    } else {
      targetSession = await SessionRepository.create({
        user_id: userId,
        initial_prompt: `Template based on ${template.name}`,
        stack: template.stack,
        status: 'created',
      });
    }

    await SessionRepository.updateGeneratedCode(targetSession.id, {
      html: template.html,
      css: template.css || '',
      js: template.js || '',
    });

    const session = await SessionRepository.findById(targetSession.id);

    return {
      success: true,
      sessionId: session.id,
      templateId: template.id,
      templateName: template.name,
      status: session.status,
      stack: session.stack,
      current_html: session.current_html,
      generated_css: session.generated_css,
      generated_js: session.generated_js,
      preview_url: session.preview_url,
      created_at: session.created_at,
    };
  }

  /**
   * Get the prompt for a template.
   * Returns the original prompt if the user has purchased the template,
   * otherwise returns the censored prompt.
   * @param {string} templateId
   * @param {string} userId
   * @returns {object} { unlocked, prompt, censored }
   */
  async getTemplatePrompt(templateId, userId) {
    const template = await TemplateRepository.findById(templateId);
    if (!template) throw new Error('Template not found');

    const purchased = await TemplatePurchaseRepository.findByTemplateAndUser(templateId, userId);
    if (purchased) {
      const session = await SessionRepository.findById(template.session_id);
      return {
        unlocked: true,
        prompt: session ? session.initial_prompt : null,
        censored: false,
      };
    }

    return {
      unlocked: false,
      prompt: template.prompt_censored,
      censored: true,
    };
  }

  /**
   * Get distinct subcategories, optionally filtered by category
   * @param {string} category
   * @returns {string[]}
   */
  async getSubcategories(category) {
    return this.repository.getSubcategories(category);
  }

  /**
   * Get templates by category
   * @param {string} category
   * @param {object} options
   * @returns {object[]}
   */
  async getTemplatesByCategory(category, options = {}) {
    return this.repository.findByCategory(category, options);
  }

  /**
   * Get templates by stack
   * @param {string} stack
   * @param {object} options
   * @returns {object[]}
   */
  async getTemplatesByStack(stack, options = {}) {
    return this.repository.findByStack(stack, options);
  }

  /**
   * Search templates
   * @param {string} query
   * @param {object} options
   * @returns {object[]}
   */
  async searchTemplates(query, options = {}) {
    if (!query || query.trim().length === 0) {
      return this.repository.list({}, 1, options.limit || 20).templates;
    }

    return this.repository.list({ search: query }, 1, options.limit || 20).templates;
  }

  /**
   * Get popular templates
   * @param {number} limit
   * @returns {object[]}
   */
  async getPopularTemplates(limit = 10) {
    return this.repository.getPopular(limit);
  }

  /**
   * Rate a template
   * @param {string} id
   * @param {number} rating - 1-5
   * @returns {object|null}
   */
  async rateTemplate(id, rating) {
    if (!id) {
      throw new Error('Template ID is required');
    }
    if (rating < 1 || rating > 5) {
      throw new Error('Rating must be between 1 and 5');
    }

    const template = await this.repository.findById(id);
    if (!template) {
      return null;
    }

    // Simple average calculation
    const currentRating = template.rating || 0;
    const usageCount = template.usage_count || 1;
    const newRating = ((currentRating * usageCount) + rating) / (usageCount + 1);

    return this.repository.update(id, { rating: Math.round(newRating * 10) / 10 });
  }

  /**
   * Seed default templates
   * Creates a set of default templates if none exist
   * @returns {number} Number of templates created
   */
  async seedDefaultTemplates() {
    const count = await this.repository.count();
    if (count > 0) {
      return 0; // Templates already exist
    }

    const defaultTemplates = [
      {
        name: 'SaaS Landing Page',
        description: 'Modern SaaS product landing page with hero, features, pricing, and CTA sections',
        category: 'saas',
        stack: 'react-tailwind',
        tags: ['saas', 'modern', 'responsive'],
        source: 'manual',
        isPublic: true,
      },
      {
        name: 'Startup Launch Page',
        description: 'Clean startup launch page with email capture and social proof',
        category: 'startup',
        stack: 'react-tailwind',
        tags: ['startup', 'launch', 'minimal'],
        source: 'manual',
        isPublic: true,
      },
      {
        name: 'Portfolio Showcase',
        description: 'Creative portfolio page with project gallery and about section',
        category: 'portfolio',
        stack: 'react-tailwind',
        tags: ['portfolio', 'creative', 'gallery'],
        source: 'manual',
        isPublic: true,
      },
      {
        name: 'E-commerce Product',
        description: 'Product landing page with features, reviews, and purchase CTA',
        category: 'ecommerce',
        stack: 'react-tailwind',
        tags: ['ecommerce', 'product', 'sales'],
        source: 'manual',
        isPublic: true,
      },
      {
        name: 'Agency Services',
        description: 'Professional agency page with services, team, and contact sections',
        category: 'agency',
        stack: 'react-tailwind',
        tags: ['agency', 'services', 'professional'],
        source: 'manual',
        isPublic: true,
      },
    ];

    let created = 0;
    for (const tpl of defaultTemplates) {
      try {
        await this.createTemplate(tpl);
        created++;
      } catch (err) {
        console.error(`[TemplateService] Failed to seed template "${tpl.name}":`, err.message);
      }
    }

    return created;
  }

  _hashPrompt(prompt) {
    return crypto.createHash('sha256').update(prompt || '').digest('hex');
  }

  _blockedPreviewHtml(name) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${this._escapeHtml(name)} - Sanitizing</title>
  <script src="https://cdn.tailwindcss.com"><\/script>
</head>
<body class="min-h-screen flex items-center justify-center bg-slate-50 text-slate-700">
  <div class="text-center p-8">
    <div class="w-12 h-12 border-4 border-indigo-200 border-t-indigo-500 rounded-full animate-spin mx-auto mb-4"></div>
    <h1 class="text-xl font-semibold mb-2">Sanitizing template...</h1>
    <p class="text-sm text-slate-500">This landing page is being reviewed and prepared for the NEXO LOJA.</p>
  </div>
</body>
</html>`;
  }

  _escapeHtml(text) {
    return (text || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  _generateName(session) {
    const base = session.initial_prompt || 'Landing Page';
    return base.slice(0, 60).replace(/[<>]/g, '');
  }

  _generateDescription(session) {
    return `Generated landing page using ${session.stack || 'react-tailwind'}`;
  }
}

module.exports = new TemplateService();
