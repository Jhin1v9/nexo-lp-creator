/**
 * NEXO Landing Page Creator v3.0 - Template Purchase Repository
 * Handles CRUD operations for template purchases
 */

const { query, queryOne, run } = require('../sqlite');

class TemplatePurchaseRepository {
  async create(data) {
    const id = data.id || `tpu-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const now = new Date().toISOString();
    const status = data.status || 'completed';

    await run(
      `INSERT INTO template_purchases (
        id, template_id, user_id,
        price_stars, price_suns, price_moons,
        status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        data.template_id || data.templateId,
        data.user_id || data.userId,
        data.price_stars || data.priceStars || 0,
        data.price_suns || data.priceSuns || 0,
        data.price_moons || data.priceMoons || 0,
        status,
        now,
      ]
    );

    return this.findById(id);
  }

  async findById(id) {
    return queryOne('SELECT * FROM template_purchases WHERE id = ?', [id]);
  }

  async findByTemplateAndUser(templateId, userId) {
    return queryOne(
      'SELECT * FROM template_purchases WHERE template_id = ? AND user_id = ?',
      [templateId, userId]
    );
  }

  async findByUser(userId) {
    return query(
      'SELECT * FROM template_purchases WHERE user_id = ? ORDER BY created_at DESC',
      [userId]
    );
  }

  async list({ limit = 1000, offset = 0, userId = null, templateId = null } = {}) {
    let sql = `
      SELECT
        p.*,
        t.name AS template_name,
        (p.price_stars + p.price_suns + p.price_moons) AS amount
      FROM template_purchases p
      LEFT JOIN templates t ON t.id = p.template_id
      WHERE 1=1
    `;
    const params = [];
    if (userId) {
      sql += ' AND p.user_id = ?';
      params.push(userId);
    }
    if (templateId) {
      sql += ' AND p.template_id = ?';
      params.push(templateId);
    }
    sql += ' ORDER BY p.created_at DESC LIMIT ? OFFSET ?';
    params.push(
      Math.min(Math.max(parseInt(limit, 10) || 1000, 1), 10000),
      Math.max(parseInt(offset, 10) || 0, 0)
    );
    return query(sql, params);
  }
}

module.exports = new TemplatePurchaseRepository();
