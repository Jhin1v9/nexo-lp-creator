/**
 * NEXO Landing Page Creator v3.0 - User Repository
 *
 * Manages the central users table and joins virtual currency balances
 * from user_currencies (stars, suns, moons).
 *
 * @module models/repositories/UserRepository
 * @version 3.0.0
 */

const { query, queryOne, run } = require('../sqlite');

const ALLOWED_UPDATE_COLUMNS = [
  'email',
  'name',
  'status',
  'role',
  'last_seen_at',
  'metadata_json',
];

const USER_SELECT = `
  SELECT u.*,
         COALESCE(b.stars, 0) as balance_stars,
         COALESCE(b.suns, 0) as balance_suns,
         COALESCE(b.moons, 0) as balance_moons,
         COALESCE(p.total_spent_stars, 0) as total_spent_stars,
         COALESCE(p.total_spent_suns, 0) as total_spent_suns,
         COALESCE(p.total_spent_moons, 0) as total_spent_moons,
         COALESCE(p.total_purchases, 0) as total_purchases
  FROM users u
  LEFT JOIN user_currencies b ON b.user_id = u.id
  LEFT JOIN (
    SELECT user_id,
           SUM(price_stars) as total_spent_stars,
           SUM(price_suns) as total_spent_suns,
           SUM(price_moons) as total_spent_moons,
           COUNT(*) as total_purchases
    FROM template_purchases GROUP BY user_id
  ) p ON p.user_id = u.id
`;

class UserRepository {
  /**
   * Create a new user record
   * @param {object} data
   * @returns {object} created user
   */
  async create(data) {
    const id = data.id || data.userId || `usr-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const now = new Date().toISOString();

    let metadataJson = data.metadata_json || data.metadataJson || null;
    if (metadataJson !== null && typeof metadataJson === 'object') {
      metadataJson = JSON.stringify(metadataJson);
    }

    await run(
      `INSERT INTO users (
        id, email, name, status, role,
        created_at, updated_at, last_seen_at, metadata_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        data.email || null,
        data.name || null,
        data.status || 'active',
        data.role || 'user',
        now,
        now,
        data.last_seen_at || data.lastSeenAt || null,
        metadataJson,
      ]
    );

    return this.findById(id);
  }

  /**
   * Find or create a user by id
   * @param {string} userId
   * @param {object} defaults
   * @returns {object} user
   */
  async findOrCreate(userId, defaults = {}) {
    if (!userId) {
      throw new Error('userId is required');
    }

    let user = await this.findById(userId);
    if (!user) {
      user = await this.create({ id: userId, ...defaults });
    }
    return user;
  }

  /**
   * Find a user by id, including currency balances
   * @param {string} userId
   * @returns {object|null}
   */
  async findById(userId) {
    return queryOne(`${USER_SELECT} WHERE u.id = ?`, [userId]);
  }

  _buildWhere(filters = {}) {
    const conditions = [];
    const params = [];

    if (filters.status) {
      conditions.push('u.status = ?');
      params.push(filters.status);
    }

    if (filters.role) {
      conditions.push('u.role = ?');
      params.push(filters.role);
    }

    if (filters.search) {
      const escaped = filters.search.replace(/[%_]/g, '\\$&');
      conditions.push('(u.id LIKE ? ESCAPE "\\" OR u.email LIKE ? ESCAPE "\\" OR u.name LIKE ? ESCAPE "\\")');
      params.push(`%${escaped}%`, `%${escaped}%`, `%${escaped}%`);
    }

    return { where: conditions.join(' AND '), params };
  }

  /**
   * List users with optional filters and pagination.
   * Includes currency balances and purchase aggregates.
   * @param {object} filters
   * @param {number} page
   * @param {number} limit
   * @returns {object} { users, pagination: { page, limit, total, totalPages } }
   */
  async list(filters = {}, page = 1, limit = 20) {
    const { where, params } = this._buildWhere(filters);

    let sql = USER_SELECT;
    if (where) {
      sql += ' WHERE ' + where;
    }
    sql += ' ORDER BY u.created_at DESC';
    sql += ' LIMIT ? OFFSET ?';
    const listParams = [...params, limit, (page - 1) * limit];

    const countSql = `SELECT COUNT(*) as count FROM users u${where ? ' WHERE ' + where : ''}`;

    const [users, totalRow] = await Promise.all([
      query(sql, listParams),
      queryOne(countSql, params),
    ]);

    const total = totalRow ? totalRow.count : 0;

    return {
      users,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Update arbitrary user fields
   * @param {string} userId
   * @param {object} data
   * @returns {object|null}
   */
  async update(userId, data) {
    const updateData = { ...data };

    if ('metadataJson' in updateData) {
      updateData.metadata_json = updateData.metadataJson;
      delete updateData.metadataJson;
    }

    if (updateData.metadata_json !== null && typeof updateData.metadata_json === 'object') {
      updateData.metadata_json = JSON.stringify(updateData.metadata_json);
    }

    const keys = Object.keys(updateData).filter(k => ALLOWED_UPDATE_COLUMNS.includes(k));
    if (keys.length === 0) return this.findById(userId);

    const setClause = keys.map(k => `${k} = ?`).join(', ');
    const values = keys.map(k => updateData[k]);

    await run(
      `UPDATE users SET ${setClause}, updated_at = ? WHERE id = ?`,
      [...values, new Date().toISOString(), userId]
    );

    return this.findById(userId);
  }
}

module.exports = new UserRepository();
