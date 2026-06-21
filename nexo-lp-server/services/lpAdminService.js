/**
 * NEXO Landing Page Creator v3.0 - Admin Service
 *
 * Administrative operations backed by lpUserService and an audit log.
 *
 * @module services/lpAdminService
 * @version 3.0.0
 */

const userService = require('./lpUserService');
const AdminLogRepository = require('../models/repositories/AdminLogRepository');

class AdminService {
  constructor() {
    this.userService = userService;
  }

  /**
   * Write an audit log entry for an administrative action.
   * @param {string} userId
   * @param {string} action
   * @param {string} targetType
   * @param {string} targetId
   * @param {object} payload
   * @param {object} result
   */
  async log(userId, action, targetType, targetId, payload, result) {
    await AdminLogRepository.create({
      userId,
      action,
      targetType,
      targetId,
      payload,
      result,
    });
  }

  /**
   * List users.
   * @param {object} options
   * @param {number} page
   * @param {number} limit
   * @returns {object}
   */
  async listUsers(options = {}, page = 1, limit = 20) {
    return this.userService.list(options, page, limit);
  }

  /**
   * Get a single user profile.
   * @param {string} userId
   * @returns {object|null}
   */
  async getUser(userId) {
    return this.userService.getProfile(userId);
  }

  /**
   * Update a user.
   * @param {string} userId
   * @param {object} data
   * @param {string} adminUserId
   * @returns {object|null}
   */
  async updateUser(userId, data, adminUserId) {
    const result = await this.userService.update(userId, data, adminUserId);
    await this.log(adminUserId, 'admin.updateUser', 'user', userId, data, { success: true, userId });
    return result;
  }

  /**
   * Block a user.
   * @param {string} userId
   * @param {string} adminUserId
   * @returns {object|null}
   */
  async blockUser(userId, adminUserId) {
    const result = await this.userService.setStatus(userId, 'blocked', adminUserId);
    await this.log(adminUserId, 'admin.blockUser', 'user', userId, { status: 'blocked' }, { success: true, userId });
    return result;
  }

  /**
   * Unblock a user.
   * @param {string} userId
   * @param {string} adminUserId
   * @returns {object|null}
   */
  async unblockUser(userId, adminUserId) {
    const result = await this.userService.setStatus(userId, 'active', adminUserId);
    await this.log(adminUserId, 'admin.unblockUser', 'user', userId, { status: 'active' }, { success: true, userId });
    return result;
  }

  /**
   * Generate an impersonation token for a user.
   * @param {string} userId
   * @param {string} adminUserId
   * @returns {object}
   */
  async impersonateUser(userId, adminUserId) {
    const result = this.userService.impersonate(userId, adminUserId);
    await this.log(adminUserId, 'admin.impersonateUser', 'user', userId, { userId }, result);
    return result;
  }
}

module.exports = new AdminService();
