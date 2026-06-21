const crypto = require('crypto');
const { query, queryOne, run } = require('../sqlite');

class AdminLogRepository {
  _generateId() {
    if (typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    return `log-${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
  }

  _safeStringify(value) {
    try {
      return JSON.stringify(value);
    } catch {
      return '[unserializable]';
    }
  }

  async create({ userId = null, action, targetType = null, targetId = null, payload = null, result = null }) {
    if (typeof action !== 'string' || action.length === 0) {
      throw new TypeError('action must be a non-empty string');
    }

    const id = this._generateId();
    const now = new Date().toISOString();
    await run(
      'INSERT INTO admin_logs (id, user_id, action, target_type, target_id, payload, result, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [id, userId, action, targetType, targetId, payload != null ? this._safeStringify(payload) : null, result != null ? this._safeStringify(result) : null, now]
    );
    return this.findById(id);
  }

  async findById(id) {
    return queryOne('SELECT * FROM admin_logs WHERE id = ?', [id]);
  }

  async list({ targetType, targetId, limit = 100, offset = 0 } = {}) {
    let sql = 'SELECT * FROM admin_logs WHERE 1=1';
    const params = [];
    if (targetType) {
      sql += ' AND target_type = ?';
      params.push(targetType);
    }
    if (targetId) {
      sql += ' AND target_id = ?';
      params.push(targetId);
    }

    let safeLimit = Number.isNaN(parseInt(limit, 10)) ? 100 : parseInt(limit, 10);
    safeLimit = Math.max(1, Math.min(1000, safeLimit));

    let safeOffset = Number.isNaN(parseInt(offset, 10)) ? 0 : parseInt(offset, 10);
    safeOffset = Math.max(0, safeOffset);

    sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(safeLimit, safeOffset);
    return query(sql, params);
  }
}

module.exports = new AdminLogRepository();

if (require.main === module) {
  (async () => {
    const { initializeDatabase, closeDatabase } = require('../sqlite');
    try {
      await initializeDatabase();
      const created = await module.exports.create({
        action: 'test-falsy',
        payload: 0,
        result: false,
      });
      if (created.payload !== '0') {
        throw new Error(`expected payload "0", got ${JSON.stringify(created.payload)}`);
      }
      if (created.result !== 'false') {
        throw new Error(`expected result "false", got ${JSON.stringify(created.result)}`);
      }
      const logs = await module.exports.list({ limit: 10 });
      if (logs.length < 1) {
        throw new Error('expected at least one log');
      }
      console.log('AdminLogRepository self-test passed');
    } finally {
      closeDatabase();
    }
  })();
}
