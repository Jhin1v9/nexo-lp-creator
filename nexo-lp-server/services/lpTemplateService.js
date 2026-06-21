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
const MessageRepository = require('../models/repositories/MessageRepository');
const CurrencyRepository = require('../models/repositories/CurrencyRepository');
const PreviewService = require('./lpPreviewService');
const SanitizationOrchestrator = require('./lpSanitizationOrchestrator');
const userService = require('./lpUserService');
const NexoDashboardFinanceService = require('./nexoDashboardFinanceService');
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

    await userService.ensureExists(userId);

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
      is_public: 1,
    });

    await PreviewService.publishPublicPreview(sessionId, this._blockedPreviewHtml(template.name), token);

    SanitizationOrchestrator.startSanitization(sessionId, html, prompt, chatUrl, userId)
      .catch((err) => console.error('[LOJA] Sanitization orchestrator failed:', err.message));

    return template;
  }

  /**
   * Publish a session that has not passed QA review as an "unreviewed" template.
   * The template is sold at half price until it is later sanitized and promoted
   * to 'available'.
   * @param {string} sessionId
   * @param {string} userId
   * @param {string} reason - Why it is unreviewed (e.g. 'review-failed', 'cron-backfill')
   * @returns {object} Created template
   */
  async publishUnreviewedFromSession(sessionId, userId, reason = 'unreviewed') {
    const session = await SessionRepository.findById(sessionId);
    if (!session) throw new Error('Session not found');
    if (session.user_id !== userId) throw new Error('Unauthorized');

    await userService.ensureExists(userId);

    const html = session.current_html || '';
    if (!this._isValidHtml(html)) {
      throw new Error('Session does not contain valid HTML');
    }

    const existing = await TemplateRepository.findBySessionId(sessionId);
    if (existing) return existing;

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

    const originalPrices = config.loja.defaultPrices;
    const discountedPrices = {
      stars: Math.max(1, Math.ceil(originalPrices.stars / 2)),
      suns: Math.max(0, Math.ceil(originalPrices.suns / 2)),
      moons: Math.max(0, Math.ceil(originalPrices.moons / 2)),
    };

    const template = await TemplateRepository.create({
      name: this._generateName(session),
      description: this._generateDescription(session),
      category: 'landing',
      stack: session.stack || 'react-tailwind',
      html,
      original_html: html,
      status: 'unreviewed',
      public_preview_token: token,
      prompt_hash: this._hashPrompt(prompt),
      prompt_censored: '[PROMPT BLOCKED — purchase this template in the LOJA to unlock the original prompt]',
      price_stars: discountedPrices.stars,
      price_suns: discountedPrices.suns,
      price_moons: discountedPrices.moons,
      original_price_stars: originalPrices.stars,
      original_price_suns: originalPrices.suns,
      original_price_moons: originalPrices.moons,
      source: 'generated',
      created_by: userId,
      session_id: sessionId,
      kimi_chat_url: chatUrl,
      unreviewed_reason: reason,
      is_public: 1,
    });

    // For unreviewed templates the buyer needs to see the actual (unsanitized)
    // HTML in the preview to decide whether to buy discounted or wait.
    await PreviewService.publishPublicPreview(sessionId, html, token);

    return template;
  }

  /**
   * Promote an unreviewed template to fully reviewed/approved.
   * Restores the original price.
   * @param {string} templateId
   * @returns {object|null}
   */
  async promoteToReviewed(templateId) {
    const template = await TemplateRepository.findById(templateId);
    if (!template) return null;
    if (template.status !== 'unreviewed') return template;

    return TemplateRepository.update(templateId, {
      status: 'approved',
      is_public: 2,
      reviewed_at: new Date().toISOString(),
      unreviewed_reason: null,
      price_stars: template.original_price_stars || config.loja.defaultPrices.stars,
      price_suns: template.original_price_suns || config.loja.defaultPrices.suns,
      price_moons: template.original_price_moons || config.loja.defaultPrices.moons,
    });
  }

  _isValidHtml(html) {
    if (!html || typeof html !== 'string' || html.length < 15000) return false;
    const lower = html.toLowerCase();
    return lower.includes('<!doctype html>') && lower.includes('<html') && lower.includes('</html>') && lower.includes('<body');
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

    await userService.ensureExists(userId);

    const alreadyPurchased = await TemplatePurchaseRepository.findByTemplateAndUser(templateId, userId);
    if (alreadyPurchased) return alreadyPurchased;

    const cost = { stars: template.price_stars, suns: template.price_suns, moons: template.price_moons };
    await CurrencyRepository.deduct(userId, cost);

    const purchaseRecord = await TemplatePurchaseRepository.create({
      template_id: templateId,
      user_id: userId,
      price_stars: cost.stars,
      price_suns: cost.suns,
      price_moons: cost.moons,
    });

    try {
      NexoDashboardFinanceService.recordTemplatePurchase(purchaseRecord, template).catch((err) => {
        console.error('[TemplateService] Failed to push template purchase to NEXO Dashboard:', err.message);
      });
    } catch (err) {
      console.error('[TemplateService] Failed to push template purchase to NEXO Dashboard:', err.message);
    }

    return purchaseRecord;
  }

  /**
   * Resolve the original user prompt for a template.
   * Prefers the first user message of the source session, then the session's
   * initial_prompt, then a fallback based on the template name.
   * @param {object} template
   * @param {object|null} sourceSession
   * @returns {Promise<string>}
   */
  async resolveOriginalPrompt(template, sourceSession) {
    if (sourceSession) {
      const messages = await MessageRepository.findBySession(sourceSession.id, { limit: 100 });
      const firstUserMessage = messages.find((m) => m.role === 'user');
      if (firstUserMessage && typeof firstUserMessage.content === 'string' && firstUserMessage.content.trim()) {
        return firstUserMessage.content.trim();
      }
      if (sourceSession.initial_prompt && typeof sourceSession.initial_prompt === 'string' && sourceSession.initial_prompt.trim()) {
        return sourceSession.initial_prompt.trim();
      }
    }
    return `Template based on ${template.name}`;
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

    const sourceSession = await SessionRepository.findById(template.session_id);
    const originalPrompt = await this.resolveOriginalPrompt(template, sourceSession);

    let targetSession;
    if (sessionId) {
      const existingSession = await SessionRepository.findById(sessionId);
      if (!existingSession) throw new Error('Session not found');
      if (existingSession.user_id !== userId) throw new Error('Unauthorized');
      targetSession = await SessionRepository.update(existingSession.id, {
        initial_prompt: originalPrompt,
        stack: template.stack || existingSession.stack,
      });
    } else {
      targetSession = await SessionRepository.create({
        user_id: userId,
        initial_prompt: originalPrompt,
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
      initialPrompt: session.initial_prompt,
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
      const originalPrompt = await this.resolveOriginalPrompt(template, session);
      return {
        unlocked: true,
        prompt: originalPrompt,
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

  /**
   * Enrich template metadata locally by extracting title/description from the
   * HTML and inferring category/tags from the content. Does NOT use Kimi/Chrome.
   * @param {string} templateId
   * @returns {object} Updated template
   */
  async enrichMetadataLocal(templateId) {
    const template = await this.repository.findById(templateId);
    if (!template) throw new Error('Template not found');

    const html = template.html || template.original_html || '';
    const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
    const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["']/i);

    const htmlTitle = (titleMatch ? titleMatch[1] : '').trim();
    const description = (descMatch ? descMatch[1] : template.description || htmlTitle || '').trim();
    const text = `${template.name} ${description} ${html}`.toLowerCase();

    const category = this._inferCategory(text);
    const subcategory = this._inferSubcategory(text, category);
    const tags = this._inferTags(text, category);
    const features = this._inferFeatures(text);

    const metadata = {
      category,
      subcategory,
      tags,
      niche: category,
      audience: 'general',
      difficulty: 'beginner',
      features,
      colors: ['#6366F1', '#8B5CF6', '#0F172A'],
      style: 'modern',
      seoKeywords: tags,
      badges: [],
      whyBuy: description || 'High-converting landing page template.',
      useCases: ['Landing page', 'Marketing campaign', 'Product launch'],
    };

    return this.repository.update(templateId, {
      name: (template.name || htmlTitle || 'Landing Page').slice(0, 100),
      description: description.slice(0, 500),
      category,
      subcategory,
      tags: tags.join(','),
      metadata_json: JSON.stringify(metadata),
    });
  }

  _inferCategory(text) {
    // Must match the CHECK constraint in the templates table.
    if (/restaurant|restaurante|caf[eé]|coffee|padaria|bakery|gelato|pizza|sorvete|food|comida/.test(text)) return 'business';
    if (/clinic|cl[ií]nica|hospital|medical|m[eé]dico|health|sa[uú]de/.test(text)) return 'business';
    if (/saas|software|app|tech|tecnologia|plataforma|dashboard/.test(text)) return 'saas';
    if (/portfolio|designer|developer|freelancer/.test(text)) return 'portfolio';
    if (/agency|ag[eê]ncia|marketing|digital/.test(text)) return 'agency';
    if (/event|evento|show|conference|festa|futebol|sports|esporte/.test(text)) return 'event';
    if (/ecommerce|shop|store|loja|produto|product|venda|jogo|game/.test(text)) return 'ecommerce';
    if (/course|curso|escola|school|education|educa/.test(text)) return 'business';
    if (/startup|launch/.test(text)) return 'startup';
    return 'landing';
  }

  _inferSubcategory(text, category) {
    const map = {
      food: /restaurant|restaurante/.test(text) ? 'restaurant' : /padaria|bakery/.test(text) ? 'bakery' : /caf[eé]|coffee/.test(text) ? 'cafe' : /gelato|sorvete|ice.cream/.test(text) ? 'ice-cream' : 'food',
      health: /clinic|cl[ií]nica/.test(text) ? 'clinic' : 'health',
      saas: /b2b/.test(text) ? 'b2b-saas' : 'saas',
      agency: 'digital-agency',
      event: /futebol|sports|esporte/.test(text) ? 'sports' : 'event',
      ecommerce: /product|produto/.test(text) ? 'product' : 'store',
      education: /course|curso/.test(text) ? 'course' : 'school',
      startup: 'launch',
      portfolio: 'creative',
      landing: 'landing',
    };
    return map[category] || category;
  }

  _inferTags(text, category) {
    const tags = new Set([category, 'responsive', 'modern']);
    const keywordMap = {
      restaurant: ['restaurant', 'food', 'menu', 'reservation'],
      cafe: ['cafe', 'coffee', 'breakfast', 'cozy'],
      bakery: ['bakery', 'bread', 'fresh', 'artisan'],
      clinic: ['clinic', 'medical', 'healthcare', 'appointment'],
      saas: ['saas', 'software', 'b2b', 'pricing'],
      agency: ['agency', 'marketing', 'services', 'portfolio'],
      event: ['event', 'landing', 'rsvp'],
      ecommerce: ['ecommerce', 'product', 'shopping', 'store'],
      education: ['course', 'education', 'learning', 'school'],
      startup: ['startup', 'launch', 'innovation'],
      portfolio: ['portfolio', 'creative', 'gallery'],
    };
    (keywordMap[category] || []).forEach((t) => tags.add(t));
    if (/hero|header/.test(text)) tags.add('hero');
    if (/pricing|pre[cç]o|plan/.test(text)) tags.add('pricing');
    if (/testimonial|depoimento|review/.test(text)) tags.add('testimonials');
    if (/contact|contato|form/.test(text)) tags.add('contact');
    if (/footer/.test(text)) tags.add('footer');
    return Array.from(tags).slice(0, 10);
  }

  _inferFeatures(text) {
    const features = [];
    if (/hero|banner/.test(text)) features.push('Hero section');
    if (/feature|recurso|benefit|benef[ií]cio/.test(text)) features.push('Features grid');
    if (/pricing|pre[cç]o|plan/.test(text)) features.push('Pricing table');
    if (/testimonial|depoimento|review/.test(text)) features.push('Testimonials');
    if (/contact|contato|form/.test(text)) features.push('Contact form');
    if (/gallery|galeria|portfolio/.test(text)) features.push('Gallery');
    if (/cta|call.to.action/.test(text)) features.push('Call-to-action');
    if (/faq/.test(text)) features.push('FAQ');
    if (features.length === 0) features.push('Hero section', 'Call-to-action');
    return features;
  }
}

module.exports = new TemplateService();
