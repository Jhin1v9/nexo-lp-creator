/**
 * NEXO Landing Page Creator v3.0 - SQLite Database Layer
 * Uses sql.js (SQLite WASM) with better-sqlite3-compatible sync API.
 */

const fs = require('fs');
const path = require('path');

const DB_PATH = process.env.NEXO_LP_DB_PATH || path.join(__dirname, '../../data/nexo-lp.db');

let _SQL = null;
let _db = null;
let _initPromise = null;

/**
 * Initialize the SQL.js module (async, but cached)
 */
async function initSQL() {
  if (_SQL) return _SQL;
  if (_initPromise) return _initPromise;

  _initPromise = (async () => {
    const initSqlJs = require('sql.js');
    _SQL = await initSqlJs();
    _initPromise = null;
    return _SQL;
  })();

  return _initPromise;
}

function ensureDir() {
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function loadOrCreate() {
  ensureDir();
  if (fs.existsSync(DB_PATH)) {
    const data = fs.readFileSync(DB_PATH);
    return new _SQL.Database(data);
  }
  return new _SQL.Database();
}

function persist() {
  if (!_db) return;
  ensureDir();
  const data = _db.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
}

// NOTE: Do NOT persist on process.exit. Every write already calls persist(),
// and persisting here would overwrite external changes made by other processes
// (e.g., the cron backfill script) with this process's stale in-memory state.

/**
 * Get the database instance (initializes sql.js on first call)
 */
async function getDatabaseAsync() {
  if (_db) return _db;
  await initSQL();
  _db = loadOrCreate();
  return _db;
}

function getDatabase() {
  if (_db) return _db;
  // Sync fallback: if sql.js already loaded, use it
  if (_SQL) {
    _db = loadOrCreate();
    return _db;
  }
  throw new Error('Database not initialized. Call initializeDatabase() first.');
}

function closeDatabase() {
  persist();
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

  get(...params) {
    const flat = params.length === 1 && Array.isArray(params[0]) ? params[0] : params;
    const stmt = this._getStmt();
    stmt.bind(flat);
    if (stmt.step()) {
      return stmt.getAsObject();
    }
    return undefined;
  }

  run(...params) {
    const flat = params.length === 1 && Array.isArray(params[0]) ? params[0] : params;
    const stmt = this._getStmt();
    stmt.run(flat);
    // Get last insert rowid BEFORE persisting, because sql.js export() resets it.
    let lastID = 0;
    try {
      const idStmt = this.db.prepare('SELECT last_insert_rowid() as id');
      if (idStmt.step()) {
        lastID = idStmt.getAsObject().id || 0;
      }
      idStmt.free();
    } catch (e) { /* ignore */ }
    persist();
    return { lastID, changes: 1 };
  }

  all(...params) {
    const flat = params.length === 1 && Array.isArray(params[0]) ? params[0] : params;
    const stmt = this._getStmt();
    stmt.bind(flat);
    const rows = [];
    while (stmt.step()) {
      rows.push(stmt.getAsObject());
    }
    return rows;
  }

  free() {
    if (this._stmt) {
      this._stmt.free();
      this._stmt = null;
    }
  }
}

// ============================================
// Database class (better-sqlite3 compatible)
// ============================================
class Database {
  constructor() {
    if (!_db) {
      throw new Error('Database not initialized. Call initializeDatabase() first.');
    }
    this.db = _db;
  }

  prepare(sql) {
    return new Statement(this.db, sql);
  }

  exec(sql) {
    this.db.run(sql);
    persist();
  }

  pragma(pragma) {
    const stmt = this.db.prepare(`PRAGMA ${pragma}`);
    const rows = [];
    while (stmt.step()) {
      rows.push(stmt.getAsObject());
    }
    stmt.free();
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
    const db = getDatabase();
    const stmt = new Statement(db, sql);
    return stmt.all(params);
  });
}

function queryOne(sql, params = []) {
  return Promise.resolve().then(() => {
    const db = getDatabase();
    const stmt = new Statement(db, sql);
    return stmt.get(params);
  });
}

function run(sql, params = []) {
  return Promise.resolve().then(() => {
    const db = getDatabase();
    const stmt = new Statement(db, sql);
    return stmt.run(params);
  });
}

function exec(sql) {
  return Promise.resolve().then(() => {
    const db = getDatabase();
    db.run(sql);
    persist();
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

  db.run(`CREATE TABLE IF NOT EXISTS __migrations (
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
      db.run(sql);
      const insert = new Statement(db, 'INSERT INTO __migrations (filename) VALUES (?)');
      insert.run(file);
      insert.free();
      console.log(`[DB] Migrated: ${file}`);
    }
  }

  persist();
}

// ============================================
// Initialization
// ============================================
async function initializeDatabase() {
  await initSQL();
  await getDatabaseAsync();
  runMigrations();
  console.log(`[DB] SQLite (sql.js) initialized at ${DB_PATH}`);
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
  const result = callback({
    db: getDatabase(),
    query,
    queryOne,
    run,
    exec,
  });
  persist();
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
