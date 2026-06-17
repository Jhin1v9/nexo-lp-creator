/**
 * NEXO Landing Page Creator v3.0 - Session Repository
 * Async SQLite repository for sessions table.
 */

const { query, queryOne, run } = require('../sqlite');

class SessionRepository {
  /**
   * Create a new session
   */
  async create(data) {
    const id = data.id || `sess-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const now = new Date().toISOString();
    await run(
      `INSERT INTO sessions (id, user_id, project_id, status, stack, initial_prompt, intention_json, design_json, current_html, version, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        data.userId || data.user_id || 'anonymous',
        data.projectId || data.project_id || id,
        data.status || 'created',
        data.stack || 'static-html-tailwind',
        data.initialPrompt || data.initial_prompt || null,
        data.intention_json || data.intentionJson || null,
        data.design_json || data.designJson || null,
        data.current_html || data.currentHtml || null,
        data.version || 1,
        now,
        now
      ]
    );
    return this.findById(id);
  }

  /**
   * Find session by ID
   */
  async findById(id) {
    return queryOne('SELECT * FROM sessions WHERE id = ?', [id]);
  }

  /**
   * Find sessions by user ID
   */
  async findByUserId(userId, options = {}) {
    let sql = 'SELECT * FROM sessions WHERE user_id = ? ORDER BY updated_at DESC';
    const params = [userId];
    if (options.limit) {
      sql += ' LIMIT ?';
      params.push(options.limit);
    }
    return query(sql, params);
  }

  /**
   * Find sessions by status
   */
  async findByStatus(status, options = {}) {
    let sql = 'SELECT * FROM sessions WHERE status = ? ORDER BY updated_at DESC';
    const params = [status];
    if (options.limit) {
      sql += ' LIMIT ?';
      params.push(options.limit);
    }
    return query(sql, params);
  }

  /**
   * Update session fields
   */
  async update(id, data) {
    const keys = Object.keys(data);
    if (keys.length === 0) return null;
    const setClause = keys.map(k => `${k} = ?`).join(', ');
    await run(`UPDATE sessions SET ${setClause}, updated_at = ? WHERE id = ?`, [...Object.values(data), new Date().toISOString(), id]);
    return this.findById(id);
  }

  /**
   * Update session status
   */
  async updateStatus(id, status) {
    await run('UPDATE sessions SET status = ?, updated_at = ? WHERE id = ?', [status, new Date().toISOString(), id]);
    return this.findById(id);
  }

  /**
   * Update generated code (HTML/CSS/JS)
   */
  async updateGeneratedCode(id, code) {
    const updates = {};
    if (code.html !== undefined) updates.current_html = code.html;
    if (code.css !== undefined) updates.generated_css = code.css;
    if (code.js !== undefined) updates.generated_js = code.js;
    return this.update(id, updates);
  }

  /**
   * Update preview URL
   */
  async updatePreviewUrl(id, previewUrl) {
    return this.update(id, { preview_url: previewUrl });
  }

  /**
   * Update deploy URL
   */
  async updateDeployUrl(id, deployUrl) {
    return this.update(id, { deploy_url: deployUrl });
  }

  /**
   * Update session metadata
   */
  async updateMetadata(id, metadata) {
    // Get existing
    const session = await this.findById(id);
    if (!session) return null;
    let existing = {};
    if (session.metadata_json) {
      try {
        existing = JSON.parse(session.metadata_json);
      } catch (err) {
        console.warn(`[SessionRepository] Failed to parse metadata_json for session ${id}: ${err.message}`);
        existing = {};
      }
    }
    const merged = { ...existing, ...metadata };
    const updates = { metadata_json: JSON.stringify(merged) };

    // Persist kimiChatUrl to its own column so sanitization can reuse the chat.
    if (metadata.kimiChatUrl !== undefined) {
      updates.kimi_chat_url = metadata.kimiChatUrl;
    }

    return this.update(id, updates);
  }

  /**
   * Increment version
   */
  async incrementVersion(id) {
    await run('UPDATE sessions SET version = version + 1, updated_at = ? WHERE id = ?', [new Date().toISOString(), id]);
    return this.findById(id);
  }

  /**
   * Delete session
   */
  async delete(id) {
    const result = await run('DELETE FROM sessions WHERE id = ?', [id]);
    return result.changes > 0;
  }

  /**
   * List sessions with filters
   */
  async list(filters = {}, page = 1, limit = 20) {
    let sql = 'SELECT * FROM sessions';
    const params = [];
    const conditions = [];

    if (filters.userId) {
      conditions.push('user_id = ?');
      params.push(filters.userId);
    }
    if (filters.status) {
      conditions.push('status = ?');
      params.push(filters.status);
    }

    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }

    sql += ' ORDER BY updated_at DESC';
    sql += ' LIMIT ? OFFSET ?';
    params.push(limit, (page - 1) * limit);

    return query(sql, params);
  }

  /**
   * Count sessions
   */
  async count(filters = {}) {
    let sql = 'SELECT COUNT(*) as count FROM sessions';
    const params = [];

    if (filters.status) {
      sql += ' WHERE status = ?';
      params.push(filters.status);
    }

    const row = await queryOne(sql, params);
    return row ? row.count : 0;
  }

  /**
   * Update with raw WHERE clause
   */
  async updateWhere(data, whereClause, whereParams = []) {
    const keys = Object.keys(data);
    if (keys.length === 0) return 0;
    const setClause = keys.map(k => `${k} = ?`).join(', ');
    const sql = `UPDATE sessions SET ${setClause} WHERE ${whereClause}`;
    const result = await run(sql, [...Object.values(data), ...whereParams]);
    return result.changes;
  }
}

module.exports = new SessionRepository();
