/**
 * NEXO Landing Page Creator v3.0 - Admin Service
 *
 * Administrative operations for the Command Center:
 * templates, sessions, purchases, currency, mining jobs, and settings.
 *
 * @module services/lpAdminService
 * @version 3.0.0
 */

const AdminLogRepository = require('../models/repositories/AdminLogRepository');
const AppSettingsRepository = require('../models/repositories/AppSettingsRepository');
const CurrencyRepository = require('../models/repositories/CurrencyRepository');
const MiningJobRepository = require('../models/repositories/MiningJobRepository');
const SessionRepository = require('../models/repositories/SessionRepository');
const TemplatePurchaseRepository = require('../models/repositories/TemplatePurchaseRepository');
const TemplateRepository = require('../models/repositories/TemplateRepository');
const lpGenerationService = require('./lpGenerationService');
const lpSanitizationOrchestrator = require('./lpSanitizationOrchestrator');
const userService = require('./lpUserService');
const { query } = require('../models/sqlite');

const VALID_CURRENCIES = ['stars', 'suns', 'moons'];
const GENERATION_SETTINGS_KEYS = [
  'generation.mode',
  'generation.frameworks',
  'generation.auto_publish',
  'generation.base_prompt',
  'pricing.default_template',
];
const DEFAULT_SETTINGS = {
  'generation.mode': 'landing',
  'generation.frameworks': ['static-html-tailwind'],
  'generation.auto_publish': false,
  'generation.base_prompt': '',
  'pricing.default_template': 0,
};
const TEMPLATE_UPDATE_KEYS = [
  'name',
  'description',
  'category',
  'subcategory',
  'metadata_json',
  'price',
  'is_public',
  'status',
];

class AdminService {
  constructor() {
    this.adminLogRepository = AdminLogRepository;
    this.appSettingsRepository = AppSettingsRepository;
    this.currencyRepository = CurrencyRepository;
    this.miningJobRepository = MiningJobRepository;
    this.sessionRepository = SessionRepository;
    this.templatePurchaseRepository = TemplatePurchaseRepository;
    this.templateRepository = TemplateRepository;
    this.generationService = lpGenerationService;
    this.sanitizationOrchestrator = lpSanitizationOrchestrator;
  }

  /**
   * Log an administrative action.
   */
  async log(userId, action, targetType, targetId, payload, result) {
    try {
      return await this.adminLogRepository.create({
        userId,
        action,
        targetType,
        targetId,
        payload,
        result,
      });
    } catch (err) {
      console.error('[AdminService] Failed to write admin log:', err.message);
      return null;
    }
  }

  /**
   * Validate that a value is a non-empty string id.
   */
  _validateId(id) {
    if (typeof id !== 'string' || id.trim() === '') {
      throw new TypeError('id must be a non-empty string');
    }
  }

  /**
   * Validate that a value is a positive integer within an optional max bound.
   */
  _validatePositiveInteger(name, value, max = 10000) {
    const num = Number(value);
    if (!Number.isInteger(num) || num < 1 || num > max) {
      throw new TypeError(`${name} must be a positive integer <= ${max}`);
    }
    return num;
  }

  /**
   * Aggregate dashboard statistics.
   */
  async getStats() {
    const templateRows = await query('SELECT status, COUNT(*) as count FROM templates GROUP BY status');
    const templatesByStatus = templateRows.reduce((acc, row) => {
      acc[row.status || 'unknown'] = row.count;
      return acc;
    }, {});

    const activeSessionsRow = await queryOneSafe(
      "SELECT COUNT(*) as count FROM sessions WHERE status = 'preview'"
    );
    const purchasesRow = await queryOneSafe('SELECT COUNT(*) as count FROM template_purchases');
    const jobsRow = await queryOneSafe('SELECT COUNT(*) as count FROM mining_jobs');

    const templateTotal = Object.values(templatesByStatus).reduce((sum, c) => sum + c, 0);
    const stats = {
      templates: { total: templateTotal, byStatus: templatesByStatus },
      sessions: { active: activeSessionsRow ? activeSessionsRow.count : 0 },
      purchases: { total: purchasesRow ? purchasesRow.count : 0 },
      jobs: { total: jobsRow ? jobsRow.count : 0 },
      currency: { total: 0 },
    };

    const count = templateTotal + stats.sessions.active + stats.purchases.total + stats.jobs.total;

    await this.log(null, 'get_stats', null, null, {}, { count });
    return stats;
  }

  /**
   * List public templates with filters.
   */
  async listTemplates(filters = {}) {
    const limit = filters.limit
      ? this._validatePositiveInteger('limit', filters.limit, 1000)
      : 1000;
    const repoFilters = { ...filters, limit };
    if (!filters.status || filters.status === 'all') {
      repoFilters.includeAllStatuses = true;
      delete repoFilters.status;
    }
    const result = await this.templateRepository.findAll(repoFilters);
    const count = Array.isArray(result)
      ? result.length
      : result?.templates?.length ?? result?.pagination?.total ?? 0;
    await this.log(null, 'list_templates', null, null, filters, { count });
    return result;
  }

  /**
   * Update an existing template (restricted fields).
   */
  async updateTemplate(id, data, userId) {
    try {
      this._validateId(id);
      this._validateId(userId);

      const allowed = {};
      for (const key of TEMPLATE_UPDATE_KEYS) {
        if (key in data) {
          allowed[key] = data[key];
        }
      }

      if ('price' in allowed) {
        if (typeof allowed.price !== 'number' || Number.isNaN(allowed.price) || allowed.price < 0) {
          throw new TypeError('price must be a number >= 0');
        }
      }

      if ('metadata_json' in allowed) {
        const raw = allowed.metadata_json;
        if (typeof raw === 'string') {
          JSON.parse(raw);
        } else if (raw && typeof raw === 'object') {
          allowed.metadata_json = JSON.stringify(raw);
        } else {
          throw new TypeError('metadata_json must be a valid JSON string or object');
        }
      }

      const updated = await this.templateRepository.update(id, allowed);
      await this.log(userId, 'template.update', 'template', id, allowed, { success: true });
      return updated;
    } catch (err) {
      console.error('[AdminService] updateTemplate failed:', err.message);
      await this.log(userId, 'template.update', 'template', id, data, { success: false, error: err.message });
      throw err;
    }
  }

  /**
   * Approve a template for public display.
   */
  async approveTemplate(id, userId) {
    try {
      this._validateId(id);
      this._validateId(userId);
      const result = await this.templateRepository.approve(id);
      await this.log(userId, 'template.approve', 'template', id, null, { success: true });
      return result;
    } catch (err) {
      console.error('[AdminService] approveTemplate failed:', err.message);
      await this.log(userId, 'template.approve', 'template', id, null, { success: false, error: err.message });
      throw err;
    }
  }

  /**
   * Delete a template.
   */
  async deleteTemplate(id, userId) {
    try {
      this._validateId(id);
      this._validateId(userId);
      const deleted = await this.templateRepository.delete(id);
      await this.log(userId, 'template.delete', 'template', id, null, { success: deleted });
      return deleted;
    } catch (err) {
      console.error('[AdminService] deleteTemplate failed:', err.message);
      await this.log(userId, 'template.delete', 'template', id, null, { success: false, error: err.message });
      throw err;
    }
  }

  /**
   * Trigger sanitization for a template's session.
   */
  async sanitizeTemplate(id, userId) {
    try {
      this._validateId(id);
      this._validateId(userId);

      const template = await this.templateRepository.findById(id);
      if (!template) throw new Error(`Template ${id} not found`);

      const sessionId = template.session_id;
      if (!sessionId) throw new Error(`Template ${id} has no associated session`);

      const session = await this.sessionRepository.findById(sessionId);
      if (!session) throw new Error(`Session ${sessionId} not found`);

      const originalHtml = template.original_html || session.current_html || '';
      const originalPrompt = session.initial_prompt || '';
      const kimiChatUrl = template.kimi_chat_url || session.kimi_chat_url || null;
      const targetUserId = template.created_by || session.user_id || userId;

      this.sanitizationOrchestrator
        .startSanitization(sessionId, originalHtml, originalPrompt, kimiChatUrl, targetUserId)
        .then((sanitizationResult) => {
          this.log(userId, 'template.sanitize', 'template', id, { sessionId }, {
            success: true,
            queued: true,
            result: sanitizationResult,
          });
        })
        .catch((err) => {
          console.error('[AdminService] sanitization failed:', err.message);
          this.log(userId, 'template.sanitize', 'template', id, { sessionId }, {
            success: false,
            queued: true,
            error: err.message,
          });
        });

      return { queued: true };
    } catch (err) {
      console.error('[AdminService] sanitizeTemplate failed:', err.message);
      await this.log(userId, 'template.sanitize', 'template', id, null, { success: false, error: err.message });
      throw err;
    }
  }

  /**
   * List sessions directly from SQLite with optional status and search.
   */
  async listSessions(filters = {}) {
    const params = [];
    const conditions = [];

    if (filters.status) {
      conditions.push('status = ?');
      params.push(filters.status);
    }

    if (filters.search) {
      const escaped = filters.search.replace(/[%_\\]/g, '\\$&');
      conditions.push('(id LIKE ? ESCAPE "\\" OR initial_prompt LIKE ? ESCAPE "\\")');
      params.push(`%${escaped}%`, `%${escaped}%`);
    }

    let sql = 'SELECT * FROM sessions';
    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }
    sql += ' ORDER BY updated_at DESC';

    const limit = filters.limit
      ? this._validatePositiveInteger('limit', filters.limit, 1000)
      : 1000;
    sql += ' LIMIT ?';
    params.push(limit);

    const result = await query(sql, params);
    await this.log(null, 'list_sessions', null, null, filters, { count: result.length });
    return result;
  }

  /**
   * Regenerate a session by restarting generation.
   */
  async regenerateSession(id, userId) {
    try {
      this._validateId(id);
      this._validateId(userId);

      const session = await this.sessionRepository.findById(id);
      if (!session) throw new Error(`Session ${id} not found`);

      const stack = session.stack || 'html-tailwind';
      const prompt = session.initial_prompt || '';

      this.generationService
        .startGeneration(id, prompt, stack, { userId: session.user_id || userId })
        .then((generationResult) => {
          this.log(userId, 'session.regenerate', 'session', id, { stack }, {
            success: true,
            queued: true,
            result: generationResult,
          });
        })
        .catch((err) => {
          console.error('[AdminService] regeneration failed:', err.message);
          this.log(userId, 'session.regenerate', 'session', id, { stack }, {
            success: false,
            queued: true,
            error: err.message,
          });
        });

      return { queued: true };
    } catch (err) {
      console.error('[AdminService] regenerateSession failed:', err.message);
      await this.log(userId, 'session.regenerate', 'session', id, null, { success: false, error: err.message });
      throw err;
    }
  }

  /**
   * Delete a session.
   */
  async deleteSession(id, userId) {
    try {
      this._validateId(id);
      this._validateId(userId);
      const deleted = await this.sessionRepository.delete(id);
      await this.log(userId, 'session.delete', 'session', id, null, { success: deleted });
      return deleted;
    } catch (err) {
      console.error('[AdminService] deleteSession failed:', err.message);
      await this.log(userId, 'session.delete', 'session', id, null, { success: false, error: err.message });
      throw err;
    }
  }

  /**
   * List template purchases.
   */
  async listPurchases(filters = {}) {
    const limit = filters.limit
      ? this._validatePositiveInteger('limit', filters.limit, 1000)
      : 1000;
    const result = await this.templatePurchaseRepository.list({
      ...filters,
      limit,
    });
    const count = Array.isArray(result)
      ? result.length
      : result?.length ?? result?.pagination?.total ?? 0;
    await this.log(null, 'list_purchases', null, null, filters, { count });
    return result;
  }

  /**
   * Credit virtual currency to a user.
   */
  async creditCurrency(userId, currency, amount, actorId) {
    try {
      this._validateCurrencyOperation(userId, currency, amount);
      const result = await this.currencyRepository.credit(userId, { [currency]: amount });
      await this.log(actorId, 'currency.credit', 'user', userId, { currency, amount }, { success: true, balance: result });
      return result;
    } catch (err) {
      console.error('[AdminService] creditCurrency failed:', err.message);
      await this.log(actorId, 'currency.credit', 'user', userId, { currency, amount }, { success: false, error: err.message });
      throw err;
    }
  }

  /**
   * Deduct virtual currency from a user.
   */
  async deductCurrency(userId, currency, amount, actorId) {
    try {
      this._validateCurrencyOperation(userId, currency, amount);
      const result = await this.currencyRepository.deduct(userId, { [currency]: amount });
      await this.log(actorId, 'currency.deduct', 'user', userId, { currency, amount }, { success: true, balance: result });
      return result;
    } catch (err) {
      console.error('[AdminService] deductCurrency failed:', err.message);
      await this.log(actorId, 'currency.deduct', 'user', userId, { currency, amount }, { success: false, error: err.message });
      throw err;
    }
  }

  /**
   * List mining jobs.
   */
  async listMiningJobs(filters = {}) {
    const limit = filters.limit
      ? this._validatePositiveInteger('limit', filters.limit, 1000)
      : 1000;
    const result = await this.miningJobRepository.list({
      ...filters,
      limit,
    });
    const count = Array.isArray(result)
      ? result.length
      : result?.length ?? result?.pagination?.total ?? 0;
    await this.log(null, 'list_mining_jobs', null, null, filters, { count });
    return result;
  }

  /**
   * Retry a mining job by resetting its status to pending.
   */
  async retryMiningJob(id, userId) {
    try {
      this._validateId(id);
      this._validateId(userId);
      const result = await this.miningJobRepository.updateStatus(id, 'pending');
      await this.log(userId, 'mining.retry', 'mining_job', id, null, { success: true });
      return result;
    } catch (err) {
      console.error('[AdminService] retryMiningJob failed:', err.message);
      await this.log(userId, 'mining.retry', 'mining_job', id, null, { success: false, error: err.message });
      throw err;
    }
  }

  /**
   * Pause a mining job by setting its status to paused.
   */
  async pauseMiningJob(id, userId) {
    try {
      this._validateId(id);
      this._validateId(userId);
      const result = await this.miningJobRepository.updateStatus(id, 'paused');
      await this.log(userId, 'mining.pause', 'mining_job', id, null, { success: true });
      return result;
    } catch (err) {
      console.error('[AdminService] pauseMiningJob failed:', err.message);
      await this.log(userId, 'mining.pause', 'mining_job', id, null, { success: false, error: err.message });
      throw err;
    }
  }

  /**
   * Resume a mining job by setting its status back to pending.
   */
  async resumeMiningJob(id, userId) {
    try {
      this._validateId(id);
      this._validateId(userId);
      const result = await this.miningJobRepository.updateStatus(id, 'pending');
      await this.log(userId, 'mining.resume', 'mining_job', id, null, { success: true });
      return result;
    } catch (err) {
      console.error('[AdminService] resumeMiningJob failed:', err.message);
      await this.log(userId, 'mining.resume', 'mining_job', id, null, { success: false, error: err.message });
      throw err;
    }
  }

  /**
   * Get generation-related application settings.
   */
  async getSettings() {
    const result = {};
    for (const key of GENERATION_SETTINGS_KEYS) {
      result[key] = await this.appSettingsRepository.get(key, DEFAULT_SETTINGS[key]);
    }
    await this.log(null, 'get_settings', null, null, {}, { count: Object.keys(result).length });
    return result;
  }

  /**
   * Update allowed generation/pricing settings.
   */
  async updateSettings(settings, userId) {
    try {
      this._validateId(userId);
      if (!settings || typeof settings !== 'object') {
        throw new Error('Settings must be an object');
      }

      const results = {};
      for (const key of GENERATION_SETTINGS_KEYS) {
        if (key in settings) {
          results[key] = await this.appSettingsRepository.set(key, settings[key]);
        }
      }

      await this.log(userId, 'settings.update', 'app_settings', null, settings, { success: true, updated: Object.keys(results) });
      return results;
    } catch (err) {
      console.error('[AdminService] updateSettings failed:', err.message);
      await this.log(userId, 'settings.update', 'app_settings', null, settings, { success: false, error: err.message });
      throw err;
    }
  }

  async listUsers(options = {}, page = 1, limit = 20, userId) {
    await this.log(userId, 'user.list', 'user', null, { page, limit, options });
    return userService.list(options, page, limit);
  }

  async getUser(id, adminUserId) {
    await this.log(adminUserId, 'user.view', 'user', id, {});
    return userService.getProfile(id);
  }

  async updateUser(id, data, adminUserId) {
    return userService.update(id, data, adminUserId);
  }

  async blockUser(id, adminUserId) {
    return userService.setStatus(id, 'blocked', adminUserId);
  }

  async unblockUser(id, adminUserId) {
    return userService.setStatus(id, 'active', adminUserId);
  }

  async impersonateUser(id, adminUserId) {
    return userService.impersonate(id, adminUserId);
  }

  _validateCurrencyOperation(userId, currency, amount) {
    this._validateId(userId);
    if (!VALID_CURRENCIES.includes(currency)) {
      throw new Error(`Invalid currency: ${currency}. Must be one of ${VALID_CURRENCIES.join(', ')}`);
    }
    if (typeof amount !== 'number' || Number.isNaN(amount) || amount <= 0) {
      throw new Error('amount must be a positive number');
    }
  }
}

async function queryOneSafe(sql, params = []) {
  const rows = await query(sql, params);
  return rows && rows.length > 0 ? rows[0] : null;
}

module.exports = new AdminService();
