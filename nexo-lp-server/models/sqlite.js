/**
 * NEXO Landing Page Creator v3.0 - SQLite Database Layer
 *
 * Uses better-sqlite3 for persistent, file-backed SQLite with native
 * performance. Replaces the previous sql.js in-memory + export() approach
 * which serialized the whole database on every write and caused noticeable
 * latency when switching chats or saving large HTML payloads.
 */

const fs = require('fs');
const path = require('path');
const DatabaseConstructor = require('better-sqlite3');

const DB_PATH = process.env.NEXO_LP_DB_PATH || path.join(__dirname, '../../data/nexo-lp.db');

let _db = null;

function ensureDir() {
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/**
 * Get the database instance (synchronous)
 */
function getDatabase() {
  if (!_db) {
    throw new Error('Database not initialized. Call initializeDatabase() first.');
  }
  return _db;
}

/**
 * Async variant kept for backward compatibility with existing repositories.
 */
async function getDatabaseAsync() {
  return getDatabase();
}

function closeDatabase() {
  if (_db) {
    _db.close();
    _db = null;
  }
}

// ============================================
// Statement class (better-sqlite3 compatible)
// ============================================
class Statement {
  constructor(db, sql) {
    this.db = db;
    this._sql = sql;
    this._stmt = null;
  }

  _getStmt() {
    if (!this._stmt) {
      this._stmt = this.db.prepare(this._sql);
    }
    return this._stmt;
  }

  _flattenParams(params) {
    return params.length === 1 && Array.isArray(params[0]) ? params[0] : params;
  }

  _normalizeParams(params) {
    return this._flattenParams(params).map((value) => {
      if (typeof value === 'boolean') return value ? 1 : 0;
      return value;
    });
  }

  get(...params) {
    return this._getStmt().get(this._normalizeParams(params));
  }

  run(...params) {
    const info = this._getStmt().run(this._normalizeParams(params));
    return {
      lastID: Number(info.lastInsertRowid) || 0,
      changes: info.changes,
    };
  }

  all(...params) {
    return this._getStmt().all(this._normalizeParams(params));
  }

  free() {
    // better-sqlite3 prepared statements are garbage-collected; no-op for API compat.
  }
}

// ============================================
// Database class (better-sqlite3 compatible)
// ============================================
class Database {
  constructor() {
    this.db = getDatabase();
  }

  prepare(sql) {
    return new Statement(this.db, sql);
  }

  exec(sql) {
    this.db.exec(sql);
  }

  pragma(pragma) {
    const rows = this.db.pragma(pragma, { simple: false });
    return rows.length === 1 ? rows[0] : rows;
  }

  close() {
    closeDatabase();
  }
}

// ============================================
// Async helpers (for repositories)
// ============================================
function query(sql, params = []) {
  return Promise.resolve().then(() => {
    const stmt = new Statement(getDatabase(), sql);
    return stmt.all(params);
  });
}

function queryOne(sql, params = []) {
  return Promise.resolve().then(() => {
    const stmt = new Statement(getDatabase(), sql);
    return stmt.get(params);
  });
}

function run(sql, params = []) {
  return Promise.resolve().then(() => {
    const stmt = new Statement(getDatabase(), sql);
    return stmt.run(params);
  });
}

function exec(sql) {
  return Promise.resolve().then(() => {
    getDatabase().exec(sql);
  });
}

// ============================================
// Migrations
// ============================================
function runMigrations() {
  const migrationsDir = path.join(__dirname, 'migrations');
  if (!fs.existsSync(migrationsDir)) return;

  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  const db = getDatabase();

  db.exec(`CREATE TABLE IF NOT EXISTS __migrations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    filename TEXT NOT NULL UNIQUE,
    executed_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  for (const file of files) {
    const check = new Statement(db, 'SELECT filename FROM __migrations WHERE filename = ?');
    const row = check.get(file);
    check.free();

    if (!row) {
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      db.exec(sql);
      const insert = new Statement(db, 'INSERT INTO __migrations (filename) VALUES (?)');
      insert.run(file);
      insert.free();
      console.log(`[DB] Migrated: ${file}`);
    }
  }
}

// ============================================
// Initialization
// ============================================
async function initializeDatabase() {
  if (_db) {
    _db.close();
    _db = null;
  }

  ensureDir();

  // If the database file is being recreated (e.g. test teardown deleted only
  // the .db file), stale WAL/SHM files from a previous run can cause a
  // "disk I/O error" on open. Remove them when the main file is missing.
  if (!fs.existsSync(DB_PATH)) {
    for (const suffix of ['-wal', '-shm']) {
      try {
        const stale = `${DB_PATH}${suffix}`;
        if (fs.existsSync(stale)) fs.unlinkSync(stale);
      } catch {
        // ignore
      }
    }
  }

  _db = new DatabaseConstructor(DB_PATH);
  // WAL mode allows concurrent readers and avoids the full-database fsync
  // bottleneck that made sql.js feel slow when switching chats.
  _db.pragma('journal_mode = WAL');

  runMigrations();
  console.log(`[DB] SQLite (better-sqlite3) initialized at ${DB_PATH}`);
}

// ============================================
// QueryBuilder
// ============================================
class QueryBuilder {
  constructor(tableName) {
    this.table = tableName;
  }

  all(conditions = {}, options = {}) {
    let sql = `SELECT * FROM ${this.table}`;
    const params = [];
    const keys = Object.keys(conditions);
    if (keys.length > 0) {
      const where = keys.map(k => {
        params.push(conditions[k]);
        return `${k} = ?`;
      }).join(' AND ');
      sql += ` WHERE ${where}`;
    }
    if (options.orderBy) sql += ` ORDER BY ${options.orderBy}`;
    if (options.limit) { sql += ' LIMIT ?'; params.push(options.limit); }
    const stmt = new Statement(getDatabase(), sql);
    return stmt.all(params);
  }

  get(conditions = {}) {
    const results = this.all(conditions, { limit: 1 });
    return results[0] || null;
  }

  insert(data) {
    const keys = Object.keys(data);
    const placeholders = keys.map(() => '?').join(', ');
    const sql = `INSERT INTO ${this.table} (${keys.join(', ')}) VALUES (${placeholders})`;
    const stmt = new Statement(getDatabase(), sql);
    return stmt.run(Object.values(data));
  }

  update(conditions, data) {
    const setClause = Object.keys(data).map(k => `${k} = ?`).join(', ');
    const whereClause = Object.keys(conditions).map(k => `${k} = ?`).join(' AND ');
    const sql = `UPDATE ${this.table} SET ${setClause} WHERE ${whereClause}`;
    const stmt = new Statement(getDatabase(), sql);
    return stmt.run([...Object.values(data), ...Object.values(conditions)]);
  }

  delete(conditions) {
    const whereClause = Object.keys(conditions).map(k => `${k} = ?`).join(' AND ');
    const sql = `DELETE FROM ${this.table} WHERE ${whereClause}`;
    const stmt = new Statement(getDatabase(), sql);
    return stmt.run(Object.values(conditions));
  }
}

function table(name) {
  return new QueryBuilder(name);
}

function transaction(callback) {
  const db = getDatabase();
  const result = callback({
    db,
    query,
    queryOne,
    run,
    exec,
  });
  return Promise.resolve(result);
}

module.exports = {
  Database,
  Statement,
  getDatabase,
  closeDatabase,
  initializeDatabase,
  runMigrations,
  query,
  queryOne,
  run,
  exec,
  table,
  transaction,
  QueryBuilder,
};
