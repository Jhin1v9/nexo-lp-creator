/**
 * NEXO Landing Page Creator v3.0 - User Service
 *
 * Central user management for the admin redesign. Handles user
 * existence guarantees, profile enrichment, administrative updates
 * and impersonation tokens.
 *
 * @module services/lpUserService
 * @version 3.0.0
 */

const UserRepository = require('../models/repositories/UserRepository');
const CurrencyRepository = require('../models/repositories/CurrencyRepository');
const TemplatePurchaseRepository = require('../models/repositories/TemplatePurchaseRepository');
const SessionRepository = require('../models/repositories/SessionRepository');
const TemplateRepository = require('../models/repositories/TemplateRepository');
const AdminLogRepository = require('../models/repositories/AdminLogRepository');

class UserService {
  /**
   * Ensure a user record exists for the given id.
   * @param {string} userId
   * @returns {object} user
   */
  async ensureExists(userId) {
    return UserRepository.findOrCreate(userId);
  }

  /**
   * Build a complete profile for a user, including balances, purchases,
   * sessions, published templates and admin history.
   * @param {string} userId
   * @returns {object|null}
   */
  async getProfile(userId) {
    const user = await UserRepository.findById(userId);
    if (!user) return null;

    const balances = await CurrencyRepository.getBalance(userId);
    const purchases = await TemplatePurchaseRepository.findByUser(userId);
    const sessions = await SessionRepository.list({ userId }, 1, 1000);
    const { templates: publishedTemplates } = await TemplateRepository.list(
      { includeAllStatuses: true, createdBy: userId },
      1,
      1000
    );
    const adminHistory = await AdminLogRepository.listByTarget('user', userId);

    const totalSpent = purchases.reduce(
      (acc, purchase) => ({
        stars: acc.stars + (purchase.price_stars || 0),
        suns: acc.suns + (purchase.price_suns || 0),
        moons: acc.moons + (purchase.price_moons || 0),
      }),
      { stars: 0, suns: 0, moons: 0 }
    );
    const totalPurchases = purchases.length;

    return {
      ...user,
      balances,
      totalSpent,
      totalPurchases,
      purchases,
      sessions,
      publishedTemplates,
      adminHistory,
    };
  }

  /**
   * List users with filters and pagination.
   * @param {object} options
   * @param {number} page
   * @param {number} limit
   * @returns {object}
   */
  async list(options = {}, page = 1, limit = 20) {
    return UserRepository.list(options, page, limit);
  }

  /**
   * Update a user and log the action.
   * @param {string} userId
   * @param {object} data
   * @param {string} adminUserId
   * @returns {object|null}
   */
  async update(userId, data, adminUserId) {
    const before = await UserRepository.findById(userId);
    const updated = await UserRepository.update(userId, data);

    await AdminLogRepository.create({
      userId: adminUserId,
      action: 'user.update',
      targetType: 'user',
      targetId: userId,
      payload: { before, updates: data },
      result: { success: true, userId },
    });

    return updated;
  }

  /**
   * Set a user's status and log the action.
   * @param {string} userId
   * @param {string} status
   * @param {string} adminUserId
   * @returns {object|null}
   */
  async setStatus(userId, status, adminUserId) {
    const updated = await UserRepository.update(userId, { status });

    await AdminLogRepository.create({
      userId: adminUserId,
      action: `user.${status}`,
      targetType: 'user',
      targetId: userId,
      payload: { status },
      result: { success: true, userId },
    });

    return updated;
  }

  /**
   * Generate an impersonation token for a user and log the action.
   * @param {string} userId
   * @param {string} adminUserId
   * @returns {object} { userId, token }
   */
  impersonate(userId, adminUserId) {
    const token = Buffer.from(
      JSON.stringify({ userId, ts: Date.now() })
    ).toString('base64url');

    AdminLogRepository.create({
      userId: adminUserId,
      action: 'user.impersonate',
      targetType: 'user',
      targetId: userId,
      payload: { userId },
      result: { success: true, userId, token },
    }).catch((err) => {
      console.error('[lpUserService] Failed to log impersonation:', err.message);
    });

    return { userId, token };
  }
}

module.exports = new UserService();
