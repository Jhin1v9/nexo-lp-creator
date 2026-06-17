/**
 * NEXO Landing Page Creator v3.0 - Mining Job Repository
 * Handles template mining pipeline job queue
 */

const { query, queryOne, run } = require('../sqlite');

class MiningJobRepository {
  async create(data) {
    const id = data.id || `mine-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    await run(
      `INSERT INTO mining_jobs (id, url, user_id, status, progress, result, error_message, queue_position, started_at, completed_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        data.url,
        data.user_id || data.userId || null,
        data.status || 'pending',
        data.progress || 0,
        data.result || null,
        data.error_message || data.errorMessage || null,
        data.queue_position || data.queuePosition || null,
        data.started_at || data.startedAt || null,
        data.completed_at || data.completedAt || null,
        new Date().toISOString(),
      ]
    );
    return this.findById(id);
  }

  async findById(id) {
    return queryOne('SELECT * FROM mining_jobs WHERE id = ?', [id]);
  }

  async findBySession(sessionId) {
    return query(
      'SELECT * FROM mining_jobs WHERE session_id = ? ORDER BY created_at DESC',
      [sessionId]
    );
  }

  async findPending(limit = 10) {
    return query(
      'SELECT * FROM mining_jobs WHERE status = ? ORDER BY created_at ASC LIMIT ?',
      ['pending', limit]
    );
  }

  async getPendingCount() {
    const row = await queryOne(
      "SELECT COUNT(*) as count FROM mining_jobs WHERE status IN ('pending', 'queued')"
    );
    return row ? row.count : 0;
  }

  async updateStatus(id, status) {
    await run('UPDATE mining_jobs SET status = ? WHERE id = ?', [status, id]);
    return this.findById(id);
  }

  async updateProgress(id, progress) {
    await run('UPDATE mining_jobs SET progress = ? WHERE id = ?', [progress, id]);
    return this.findById(id);
  }

  async updateResult(id, result) {
    await run(
      `UPDATE mining_jobs 
       SET status = 'completed', progress = 100, result = ?, completed_at = ? 
       WHERE id = ?`,
      [JSON.stringify(result), new Date().toISOString(), id]
    );
    return this.findById(id);
  }

  async updateError(id, error) {
    await run(
      `UPDATE mining_jobs 
       SET status = 'failed', error_message = ?, completed_at = ? 
       WHERE id = ?`,
      [error, new Date().toISOString(), id]
    );
    return this.findById(id);
  }

  async list(options = {}) {
    let sql = 'SELECT * FROM mining_jobs';
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
    const result = await run('DELETE FROM mining_jobs WHERE id = ?', [id]);
    return result.changes > 0;
  }

  async countByStatus() {
    const rows = await query(
      'SELECT status, COUNT(*) as count FROM mining_jobs GROUP BY status'
    );
    const result = {};
    for (const row of rows) {
      result[row.status] = row.count;
    }
    return result;
  }
}

module.exports = new MiningJobRepository();
