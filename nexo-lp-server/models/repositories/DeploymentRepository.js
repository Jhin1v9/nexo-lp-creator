/**
 * NEXO Landing Page Creator v3.0 - Deployment Repository
 * Handles deployment history and tracking
 */

const { query, queryOne, run } = require('../sqlite');

class DeploymentRepository {
  async create(data) {
    const id = data.id || `deploy-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const now = new Date().toISOString();

    await run(
      `INSERT INTO deployments (id, session_id, user_id, type, url, status, metadata, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        data.session_id || data.sessionId || null,
        data.user_id || data.userId || null,
        data.type || 'github',
        data.url || null,
        data.status || 'pending',
        data.metadata ? JSON.stringify(data.metadata) : null,
        now,
        now,
      ]
    );
    return this.findById(id);
  }

  async findById(id) {
    return queryOne('SELECT * FROM deployments WHERE id = ?', [id]);
  }

  async findBySession(sessionId) {
    return query(
      'SELECT * FROM deployments WHERE session_id = ? ORDER BY created_at DESC',
      [sessionId]
    );
  }

  async updateStatus(id, status, url) {
    const params = [status, new Date().toISOString()];
    let sql = 'UPDATE deployments SET status = ?, updated_at = ?';

    if (url !== undefined) {
      sql += ', url = ?';
      params.push(url);
    }

    sql += ' WHERE id = ?';
    params.push(id);

    await run(sql, params);
    return this.findById(id);
  }

  async updateUrl(id, url) {
    await run(
      'UPDATE deployments SET url = ?, updated_at = ? WHERE id = ?',
      [url, new Date().toISOString(), id]
    );
    return this.findById(id);
  }

  async updateMetadata(id, metadata) {
    await run(
      'UPDATE deployments SET metadata = ?, updated_at = ? WHERE id = ?',
      [JSON.stringify(metadata), new Date().toISOString(), id]
    );
    return this.findById(id);
  }

  async list(options = {}) {
    let sql = 'SELECT * FROM deployments';
    const params = [];

    if (options.status) {
      sql += ' WHERE status = ?';
      params.push(options.status);
    }

    sql += ' ORDER BY created_at DESC';

    if (options.limit) {
      sql += ' LIMIT ?';
      params.push(options.limit);
    }

    return query(sql, params);
  }

  async delete(id) {
    const result = await run('DELETE FROM deployments WHERE id = ?', [id]);
    return result.changes > 0;
  }

  async count(options = {}) {
    let sql = 'SELECT COUNT(*) as count FROM deployments';
    const params = [];

    if (options.status) {
      sql += ' WHERE status = ?';
      params.push(options.status);
    }

    const row = await queryOne(sql, params);
    return row ? row.count : 0;
  }

  async getRecent(days = 7) {
    return query(
      `SELECT * FROM deployments 
       WHERE created_at >= datetime('now', '-${days} days')
       ORDER BY created_at DESC`
    );
  }

  async getStats() {
    const rows = await query(
      `SELECT 
        status, 
        COUNT(*) as count,
        type
      FROM deployments 
      GROUP BY status, type`
    );

    const stats = {
      total: 0,
      byStatus: {},
      byType: {}
    };

    for (const row of rows) {
      stats.total += row.count;
      stats.byStatus[row.status] = (stats.byStatus[row.status] || 0) + row.count;
      stats.byType[row.type] = (stats.byType[row.type] || 0) + row.count;
    }

    return stats;
  }
}

module.exports = new DeploymentRepository();
