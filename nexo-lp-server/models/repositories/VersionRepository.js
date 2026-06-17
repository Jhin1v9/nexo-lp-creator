/**
 * NEXO Landing Page Creator v3.0 - Version Repository
 * Async SQLite repository for session_versions table.
 */

const { query, queryOne, run } = require('../sqlite');
const SessionRepository = require('./SessionRepository');

class VersionRepository {
  /**
   * Create a new version for a session
   */
  async create(data) {
    const sessionId = data.sessionId || data.session_id;
    if (!sessionId) {
      throw new Error('sessionId is required');
    }

    // Compute next version number atomically within the session
    const latest = await this.findLatest(sessionId);
    const versionNumber = latest ? latest.version_number + 1 : 1;

    const now = new Date().toISOString();
    const metadataJson = data.metadata ? JSON.stringify(data.metadata) : null;

    const result = await run(
      `INSERT INTO session_versions (session_id, version_number, html, css, js, metadata, change_summary, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        sessionId,
        versionNumber,
        data.html || null,
        data.css || null,
        data.js || null,
        metadataJson,
        data.changeSummary || data.change_summary || `Version ${versionNumber}`,
        now,
      ]
    );

    return this.findById(result.lastID);
  }

  /**
   * Find version by internal id
   */
  async findById(id) {
    const row = await queryOne('SELECT * FROM session_versions WHERE id = ?', [id]);
    return row || null;
  }

  /**
   * Find all versions for a session, newest first
   */
  async findBySessionId(sessionId, options = {}) {
    let sql = 'SELECT * FROM session_versions WHERE session_id = ? ORDER BY version_number DESC';
    const params = [sessionId];
    if (options.limit) {
      sql += ' LIMIT ?';
      params.push(options.limit);
    }
    return query(sql, params);
  }

  /**
   * Find the latest version for a session
   */
  async findLatest(sessionId) {
    return queryOne(
      'SELECT * FROM session_versions WHERE session_id = ? ORDER BY version_number DESC LIMIT 1',
      [sessionId]
    );
  }

  /**
   * Delete a version by id
   */
  async delete(id) {
    const result = await run('DELETE FROM session_versions WHERE id = ?', [id]);
    return result.changes > 0;
  }

  /**
   * Delete all versions for a session
   */
  async deleteBySessionId(sessionId) {
    const result = await run('DELETE FROM session_versions WHERE session_id = ?', [sessionId]);
    return result.changes;
  }

  /**
   * Roll back a session's current_html to a specific version.
   * Returns the version row.
   */
  async rollback(sessionId, versionId) {
    const version = await this.findById(versionId);
    if (!version) {
      throw new Error('Version not found');
    }
    if (version.session_id !== sessionId) {
      throw new Error('Version does not belong to session');
    }

    await SessionRepository.updateGeneratedCode(sessionId, {
      html: version.html || '',
      css: version.css || '',
      js: version.js || '',
    });

    return version;
  }
}

module.exports = new VersionRepository();
