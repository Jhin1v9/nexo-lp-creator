/**
 * NEXO Landing Page Creator v3.0 - Template Purchase Repository
 * Handles CRUD operations for template purchases
 */

const { query, queryOne, run } = require('../sqlite');

class TemplatePurchaseRepository {
  async create(data) {
    const id = data.id || `tpu-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const now = new Date().toISOString();

    await run(
      `INSERT INTO template_purchases (
        id, template_id, user_id,
        price_stars, price_suns, price_moons,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        data.template_id || data.templateId,
        data.user_id || data.userId,
        data.price_stars || data.priceStars || 0,
        data.price_suns || data.priceSuns || 0,
        data.price_moons || data.priceMoons || 0,
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
}

module.exports = new TemplatePurchaseRepository();
