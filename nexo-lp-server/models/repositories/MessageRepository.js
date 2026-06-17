const { query, queryOne, run } = require('../sqlite');

function parseMetadata(row) {
  if (!row || !row.metadata) return {};
  try {
    return JSON.parse(row.metadata);
  } catch {
    return {};
  }
}

class MessageRepository {
  static async create({ sessionId, role, content, type = 'text', metadata = {} }) {
    const result = await run(
      `INSERT INTO messages (session_id, role, content, type, metadata, created_at)
       VALUES (?, ?, ?, ?, ?, datetime('now'))`,
      [sessionId, role, content, type, JSON.stringify(metadata)]
    );
    return { id: result.lastID, sessionId, role, content, type, metadata };
  }

  static async findBySession(sessionId, options = {}) {
    const limit = options.limit || 1000;
    const rows = await query(
      `SELECT id, session_id AS sessionId, role, content, type, metadata, created_at AS createdAt
       FROM messages
       WHERE session_id = ?
       ORDER BY created_at ASC, id ASC
       LIMIT ?`,
      [sessionId, limit]
    );
    return rows.map((row) => ({
      ...row,
      metadata: parseMetadata(row),
    }));
  }

  static async findById(id) {
    const row = await queryOne(
      `SELECT id, session_id AS sessionId, role, content, type, metadata, created_at AS createdAt
       FROM messages WHERE id = ?`,
      [id]
    );
    if (!row) return null;
    return { ...row, metadata: parseMetadata(row) };
  }

  static async deleteBySession(sessionId) {
    await run('DELETE FROM messages WHERE session_id = ?', [sessionId]);
  }
}

module.exports = MessageRepository;
