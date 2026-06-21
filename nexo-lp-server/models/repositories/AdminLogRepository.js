/**
 * NEXO Landing Page Creator v3.0 - Admin Log Repository
 *
 * Audit trail for administrative actions performed against users,
 * templates, sessions and other entities.
 *
 * @module models/repositories/AdminLogRepository
 * @version 3.0.0
 */

const { query, queryOne, run } = require('../sqlite');

class AdminLogRepository {
  /**
   * Create a new admin log entry
   * @param {object} data
   * @param {string} data.userId - Admin user id performing the action
   * @param {string} data.action - Action name (e.g. 'user.update')
   * @param {string} data.targetType - Type of target entity (e.g. 'user')
   * @param {string} data.targetId - Target entity id
   * @param {object} data.payload - Request/input payload
   * @param {object} data.result - Operation result
   * @returns {object} created log entry
   */
  async create(data) {
    const id = data.id || `log-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const now = new Date().toISOString();

    const payloadJson = data.payload !== null && data.payload !== undefined
      ? JSON.stringify(data.payload)
      : null;
    const resultJson = data.result !== null && data.result !== undefined
      ? JSON.stringify(data.result)
      : null;

    await run(
      `INSERT INTO admin_logs (
        id, user_id, action, target_type, target_id, payload, result, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        data.userId || data.user_id || null,
        data.action,
        data.targetType || data.target_type || null,
        data.targetId || data.target_id || null,
        payloadJson,
        resultJson,
        now,
      ]
    );

    return this.findById(id);
  }

  /**
   * Find a log entry by id
   * @param {string} id
   * @returns {object|null}
   */
  async findById(id) {
    return queryOne('SELECT * FROM admin_logs WHERE id = ?', [id]);
  }

  /**
   * List log entries for a specific target
   * @param {string} targetType
   * @param {string} targetId
   * @returns {object[]}
   */
  async listByTarget(targetType, targetId) {
    return query(
      'SELECT * FROM admin_logs WHERE target_type = ? AND target_id = ? ORDER BY created_at DESC',
      [targetType, targetId]
    );
  }
}

module.exports = new AdminLogRepository();
