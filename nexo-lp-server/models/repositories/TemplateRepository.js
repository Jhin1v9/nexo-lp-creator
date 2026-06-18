/**
 * NEXO Landing Page Creator v3.0 - Template Repository
 * Handles CRUD operations for public templates
 */

const { query, queryOne, run } = require('../sqlite');

const ALLOWED_UPDATE_COLUMNS = [
  'name', 'description', 'category', 'subcategory', 'stack', 'thumbnail_url',
  'html', 'css', 'js', 'config', 'tags', 'source', 'usage_count', 'rating',
  'is_public', 'created_by', 'status', 'original_html', 'sanitized_html',
  'sanitization_log', 'public_preview_token', 'prompt_hash', 'prompt_censored',
  'price_stars', 'price_suns', 'price_moons', 'session_id', 'kimi_chat_url',
  'metadata_json', 'reviewed_at', 'unreviewed_reason',
  'original_price_stars', 'original_price_suns', 'original_price_moons',
];

class TemplateRepository {
  async create(data) {
    const id = data.id || `tpl-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const now = new Date().toISOString();

    const sanitizationLog = data.sanitization_log !== undefined
      ? (typeof data.sanitization_log === 'object' ? JSON.stringify(data.sanitization_log) : data.sanitization_log)
      : null;

    await run(
      `INSERT INTO templates (
        id, name, description, category, subcategory, stack, thumbnail_url,
        html, css, js, config, tags, source, usage_count, rating,
        is_public, created_by, created_at, updated_at,
        status, original_html, sanitized_html, sanitization_log,
        public_preview_token, prompt_hash, prompt_censored,
        price_stars, price_suns, price_moons,
        session_id, kimi_chat_url, metadata_json,
        reviewed_at, unreviewed_reason,
        original_price_stars, original_price_suns, original_price_moons
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        data.name,
        data.description || null,
        data.category || 'landing',
        data.subcategory || data.category || 'landing',
        data.stack || 'static-html-tailwind',
        data.thumbnail_url || data.thumbnailUrl || null,
        data.html || null,
        data.css || null,
        data.js || null,
        data.config ? JSON.stringify(data.config) : null,
        Array.isArray(data.tags) ? data.tags.join(',') : (data.tags || null),
        data.source || 'manual',
        data.usage_count || data.usageCount || 0,
        data.rating || 0,
        data.is_public !== undefined ? data.is_public : (data.isPublic !== undefined ? data.isPublic : true),
        data.created_by || data.createdBy || null,
        now,
        now,
        data.status || 'available',
        data.original_html || data.originalHtml || null,
        data.sanitized_html || data.sanitizedHtml || null,
        sanitizationLog,
        data.public_preview_token || data.publicPreviewToken || null,
        data.prompt_hash || data.promptHash || null,
        data.prompt_censored || data.promptCensored || null,
        data.price_stars || data.priceStars || 0,
        data.price_suns || data.priceSuns || 0,
        data.price_moons || data.priceMoons || 0,
        data.session_id || data.sessionId || null,
        data.kimi_chat_url || data.kimiChatUrl || null,
        data.metadata_json || (data.metadata ? JSON.stringify(data.metadata) : null),
        data.reviewed_at || null,
        data.unreviewed_reason || null,
        data.original_price_stars || data.originalPriceStars || null,
        data.original_price_suns || data.originalPriceSuns || null,
        data.original_price_moons || data.originalPriceMoons || null,
      ]
    );
    return this.findById(id);
  }

  async findById(id) {
    return queryOne('SELECT * FROM templates WHERE id = ?', [id]);
  }

  async findBySessionId(sessionId) {
    return queryOne('SELECT * FROM templates WHERE session_id = ?', [sessionId]);
  }

  async findByPublicPreviewToken(token) {
    return queryOne('SELECT * FROM templates WHERE public_preview_token = ?', [token]);
  }

  async findByCategory(category, options = {}) {
    let sql = 'SELECT * FROM templates WHERE category = ? AND is_public >= 1';
    const params = [category];

    if (options.search) {
      sql += ' AND (name LIKE ? OR description LIKE ?)';
      params.push(`%${options.search}%`, `%${options.search}%`);
    }

    sql += ' ORDER BY rating DESC, usage_count DESC';

    if (options.limit) {
      sql += ' LIMIT ?';
      params.push(options.limit);
    }

    return query(sql, params);
  }

  async findByStack(stack, options = {}) {
    let sql = 'SELECT * FROM templates WHERE stack = ? AND is_public >= 1';
    const params = [stack];

    if (options.search) {
      sql += ' AND (name LIKE ? OR description LIKE ?)';
      params.push(`%${options.search}%`, `%${options.search}%`);
    }

    sql += ' ORDER BY rating DESC, usage_count DESC';

    if (options.limit) {
      sql += ' LIMIT ?';
      params.push(options.limit);
    }

    return query(sql, params);
  }

  _buildWhere(options = {}) {
    const conditions = ['is_public >= 1'];
    const params = [];

    if (options.status) {
      conditions.push('status = ?');
      params.push(options.status);
    } else {
      conditions.push("status IN ('sanitizing', 'available', 'unreviewed')");
    }

    if (options.category) {
      conditions.push('category = ?');
      params.push(options.category);
    }

    if (options.subcategory) {
      conditions.push('subcategory = ?');
      params.push(options.subcategory);
    }

    if (options.stack) {
      conditions.push('stack = ?');
      params.push(options.stack);
    }

    if (options.search) {
      const escaped = options.search.replace(/[%_]/g, '\\$&');
      conditions.push('(name LIKE ? ESCAPE "\\" OR description LIKE ? ESCAPE "\\")');
      params.push(`%${escaped}%`, `%${escaped}%`);
    }

    return { where: conditions.join(' AND '), params };
  }

  async findAll(options = {}) {
    const { where, params } = this._buildWhere(options);

    let sql = `SELECT * FROM templates WHERE ${where} ORDER BY rating DESC, usage_count DESC`;

    const page = options.page || 1;
    const limit = options.limit || 20;
    const offset = (page - 1) * limit;

    sql += ' LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const templates = await query(sql, params);
    const total = await this.count(options);

    return {
      templates,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async list(filters = {}, page = 1, limit = 20) {
    return this.findAll({ ...filters, page, limit });
  }

  async update(id, data) {
    const updates = [];
    const params = [];

    for (const [key, value] of Object.entries(data)) {
      if (!ALLOWED_UPDATE_COLUMNS.includes(key)) continue;
      updates.push(`${key} = ?`);
      params.push(value);
    }

    if (updates.length === 0) {
      return this.findById(id);
    }

    params.push(id);

    await run(`UPDATE templates SET ${updates.join(', ')} WHERE id = ?`, params);
    return this.findById(id);
  }

  async incrementDownloads(id) {
    await run(
      'UPDATE templates SET usage_count = usage_count + 1 WHERE id = ?',
      [id]
    );
    return this.findById(id);
  }

  async incrementUsage(id) {
    return this.incrementDownloads(id);
  }

  async updateRating(id, rating) {
    await run(
      'UPDATE templates SET rating = ? WHERE id = ?',
      [rating, id]
    );
    return this.findById(id);
  }

  async approve(id) {
    await run('UPDATE templates SET is_public = 2 WHERE id = ?', [id]);
    return this.findById(id);
  }

  async delete(id) {
    const result = await run('DELETE FROM templates WHERE id = ?', [id]);
    return result.changes > 0;
  }

  async getCategories() {
    const rows = await query(
      'SELECT DISTINCT category FROM templates WHERE is_public >= 1 ORDER BY category'
    );
    return rows.map(r => r.category);
  }

  async getSubcategories(category) {
    let sql = 'SELECT DISTINCT subcategory FROM templates WHERE is_public >= 1 AND subcategory IS NOT NULL';
    const params = [];
    if (category) {
      sql += ' AND category = ?';
      params.push(category);
    }
    sql += ' ORDER BY subcategory';
    const rows = await query(sql, params);
    return rows.map(r => r.subcategory).filter(Boolean);
  }

  async getPopular(limit = 10) {
    return query(
      'SELECT * FROM templates WHERE is_public >= 1 ORDER BY usage_count DESC, rating DESC LIMIT ?',
      [limit]
    );
  }

  async count(options = {}) {
    const { where, params } = this._buildWhere(options);
    const row = await queryOne(`SELECT COUNT(*) as count FROM templates WHERE ${where}`, params);
    return row ? row.count : 0;
  }

  async search(query, options = {}) {
    const sql = `
      SELECT * FROM templates
      WHERE is_public >= 1
      AND (name LIKE ? OR description LIKE ? OR category LIKE ?)
      ORDER BY rating DESC, usage_count DESC
      LIMIT ? OFFSET ?
    `;
    const searchTerm = `%${query}%`;
    const limit = options.limit || 20;
    const offset = options.offset || 0;

    return query(sql, [searchTerm, searchTerm, searchTerm, limit, offset]);
  }

  async seed(templates) {
    const results = [];
    for (const template of templates) {
      const existing = await queryOne(
        'SELECT id FROM templates WHERE name = ? AND category = ?',
        [template.name, template.category]
      );
      if (!existing) {
        const result = await this.create(template);
        results.push(result);
      }
    }
    return results;
  }
}

module.exports = new TemplateRepository();
