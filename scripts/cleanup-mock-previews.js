#!/usr/bin/env node
/**
 * One-time cleanup: remove persisted mock fallback HTML from sessions and previews.
 *
 * What it does:
 * 1. Scans data/previews/*.html and data/previews/public/*.html for files that
 *    contain all three mock markers: "NEXO AI", "Powerful Features",
 *    "What Our Users Say".
 * 2. For each affected session:
 *    - Verifies sessions.current_html still contains the mock markers.
 *    - Clears current_html, generated_css, generated_js, preview_url.
 *    - Sets status to 'error'.
 *    - Updates metadata_json with mockCleanedAt and an error note.
 *    - Deletes the session preview file.
 * 3. For each affected public preview:
 *    - Finds the owning template via templates.public_preview_token.
 *    - Deletes the public preview file.
 *    - Clears templates.public_preview_token (does NOT delete the template).
 * 4. Verifies no mock-marked preview files remain and affected DB rows are clean.
 */

const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const DB_PATH = process.env.NEXO_LP_DB_PATH || path.resolve(__dirname, '../data/nexo-lp.db');
const PREVIEWS_DIR = path.resolve(__dirname, '../data/previews');
const PUBLIC_PREVIEWS_DIR = path.resolve(__dirname, '../data/previews/public');

const MOCK_MARKERS = ['NEXO AI', 'Powerful Features', 'What Our Users Say'];
const ERROR_MESSAGE = 'mock HTML removed — no real generation output available';

function hasAllMarkers(content) {
  if (!content || typeof content !== 'string') return false;
  return MOCK_MARKERS.every((marker) => content.includes(marker));
}

function backupDb(dbPath) {
  if (!fs.existsSync(dbPath)) return null;
  const backupPath = `${dbPath}.backup-${Date.now()}`;
  fs.copyFileSync(dbPath, backupPath);
  return backupPath;
}

function buildSessionsDdl(db) {
  const columns = db.prepare("PRAGMA table_info('sessions')").all();
  if (!columns || columns.length === 0) {
    throw new Error('Could not read sessions table info');
  }

  const colDefs = columns.map((col) => {
    let def = `${col.name} ${col.type}`;
    if (col.notnull) def += ' NOT NULL';
    if (col.dflt_value !== null && col.dflt_value !== undefined) {
      def += ` DEFAULT ${col.dflt_value}`;
    }
    if (col.pk) def += ' PRIMARY KEY';
    if (col.name === 'status') {
      def += " CHECK (status IN ('created', 'intention', 'structure', 'code', 'review', 'preview', 'deployed', 'failed', 'archived', 'error'))";
    }
    return def;
  });

  const columnNames = columns.map((col) => col.name).join(', ');
  return {
    create: `CREATE TABLE sessions_new (\n  ${colDefs.join(',\n  ')}\n);`,
    columnNames,
  };
}

function recreateIndexes(db) {
  const indexes = db.prepare(
    "SELECT sql FROM sqlite_master WHERE type='index' AND tbl_name='sessions' AND sql IS NOT NULL"
  ).all();
  for (const { sql } of indexes) {
    // Skip indexes automatically created for UNIQUE constraints; they are
    // recreated by the table DDL. Re-create named indexes only.
    if (sql && sql.toLowerCase().startsWith('create index')) {
      db.exec(sql.replace(/ON sessions/gi, 'ON sessions_new'));
    }
  }
}

function ensureErrorStatusAllowed(db) {
  const info = db.prepare(
    "SELECT sql FROM sqlite_master WHERE type='table' AND name='sessions'"
  ).get();
  if (!info || !info.sql) return;

  if (info.sql.includes("'error'")) {
    console.log('[schema] sessions.status already allows "error"');
    return;
  }

  console.log('[schema] Updating sessions.status CHECK constraint to allow "error"...');

  db.prepare('PRAGMA foreign_keys=off').run();
  db.exec('BEGIN TRANSACTION');

  try {
    db.exec('DROP TABLE IF EXISTS sessions_new;');
    const { create, columnNames } = buildSessionsDdl(db);
    db.exec(create);
    db.exec(`INSERT INTO sessions_new (${columnNames}) SELECT ${columnNames} FROM sessions;`);
    db.exec('DROP TABLE sessions;');
    db.exec('ALTER TABLE sessions_new RENAME TO sessions;');
    recreateIndexes(db);
    db.exec('COMMIT');
    console.log('[schema] Constraint updated successfully');
  } catch (err) {
    try { db.exec('ROLLBACK'); } catch {}
    throw err;
  } finally {
    db.prepare('PRAGMA foreign_keys=on').run();
  }
}

function findMockFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter((f) => f.endsWith('.html'))
    .map((f) => path.join(dir, f))
    .filter((p) => {
      try {
        return hasAllMarkers(fs.readFileSync(p, 'utf8'));
      } catch (err) {
        console.warn(`[warn] Could not read ${p}: ${err.message}`);
        return false;
      }
    });
}

function safeUnlink(filePath) {
  try {
    fs.unlinkSync(filePath);
    return true;
  } catch (err) {
    console.warn(`[warn] Could not delete ${filePath}: ${err.message}`);
    return false;
  }
}

function main() {
  const backupPath = backupDb(DB_PATH);
  if (backupPath) {
    console.log(`[backup] Created DB backup at ${backupPath}`);
  }

  const db = new Database(DB_PATH, { fileMustExist: true });
  try {
    db.pragma('journal_mode = WAL');
    ensureErrorStatusAllowed(db);

    const nowIso = new Date().toISOString();
    const cleanedSessions = [];
    const cleanedPublicTokens = [];

    console.log('\n--- Scanning preview files ---');
    const sessionFiles = findMockFiles(PREVIEWS_DIR);
    const publicFiles = findMockFiles(PUBLIC_PREVIEWS_DIR);

    console.log(`Found ${sessionFiles.length} session preview(s) with mock markers`);
    console.log(`Found ${publicFiles.length} public preview(s) with mock markers`);

    // Process session previews.
    for (const filePath of sessionFiles) {
      const fileName = path.basename(filePath);
      const sessionId = fileName.replace(/\.html$/, '');

      const row = db
        .prepare('SELECT id, current_html, metadata_json FROM sessions WHERE id = ?')
        .get(sessionId);

      if (!row) {
        console.log(`[warn] Session ${sessionId} not found in DB; deleting orphan file ${fileName}`);
        safeUnlink(filePath);
        cleanedSessions.push({ sessionId, fileName, dbUpdated: false, note: 'orphan file' });
        continue;
      }

      if (!hasAllMarkers(row.current_html || '')) {
        console.log(`[warn] ${fileName} has mock markers but DB current_html does not; deleting stale file only`);
        safeUnlink(filePath);
        cleanedSessions.push({ sessionId, fileName, dbUpdated: false, note: 'DB did not match' });
        continue;
      }

      let metadata = {};
      if (row.metadata_json) {
        try {
          metadata = JSON.parse(row.metadata_json);
        } catch {
          metadata = { _originalParseFailed: true, _originalValue: row.metadata_json };
        }
      }
      metadata.mockCleanedAt = nowIso;
      metadata.error = ERROR_MESSAGE;

      db.prepare(
        `UPDATE sessions
         SET current_html = '',
             generated_css = '',
             generated_js = '',
             preview_url = NULL,
             status = 'error',
             metadata_json = ?,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`
      ).run(JSON.stringify(metadata), sessionId);

      safeUnlink(filePath);
      console.log(`[cleaned] session ${sessionId}: DB cleared, file ${fileName} deleted`);
      cleanedSessions.push({ sessionId, fileName, dbUpdated: true });
    }

    // Process public previews.
    for (const filePath of publicFiles) {
      const fileName = path.basename(filePath);
      const token = fileName.replace(/\.html$/, '');

      const template = db
        .prepare('SELECT id, name, public_preview_token FROM templates WHERE public_preview_token = ?')
        .get(token);

      if (!template) {
        console.log(`[warn] No template owns public preview ${fileName}; deleting orphan file`);
        safeUnlink(filePath);
        cleanedPublicTokens.push({ token, fileName, templateId: null, note: 'orphan file' });
        continue;
      }

      db.prepare(
        `UPDATE templates
         SET public_preview_token = NULL,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`
      ).run(template.id);

      safeUnlink(filePath);
      console.log(`[cleaned] public preview ${token}: template ${template.id} token cleared, file ${fileName} deleted`);
      cleanedPublicTokens.push({ token, fileName, templateId: template.id });
    }

    // Verification.
    console.log('\n--- Verification ---');
    const remainingSessionMocks = findMockFiles(PREVIEWS_DIR);
    const remainingPublicMocks = findMockFiles(PUBLIC_PREVIEWS_DIR);

    let dbCheckPass = true;
    for (const { sessionId, dbUpdated } of cleanedSessions) {
      if (!dbUpdated) continue;
      const row = db.prepare('SELECT id, current_html, status FROM sessions WHERE id = ?').get(sessionId);
      if (!row || row.current_html !== '' || row.status !== 'error') {
        console.log(`[verify FAIL] session ${sessionId}: current_html length=${(row?.current_html || '').length}, status=${row?.status}`);
        dbCheckPass = false;
      } else {
        console.log(`[verify OK] session ${sessionId}: current_html empty, status=error`);
      }
    }

    if (remainingSessionMocks.length > 0) {
      console.log(`[verify FAIL] ${remainingSessionMocks.length} session mock file(s) still remain`);
    } else {
      console.log('[verify OK] No session preview files with mock markers remain');
    }

    if (remainingPublicMocks.length > 0) {
      console.log(`[verify FAIL] ${remainingPublicMocks.length} public mock file(s) still remain`);
    } else {
      console.log('[verify OK] No public preview files with mock markers remain');
    }

    const allOk =
      remainingSessionMocks.length === 0 &&
      remainingPublicMocks.length === 0 &&
      dbCheckPass;

    console.log('\n--- Summary ---');
    console.log('Cleaned sessions:', cleanedSessions.map((s) => s.sessionId));
    console.log('Cleared public tokens:', cleanedPublicTokens.map((t) => t.token));
    console.log('All checks passed:', allOk);

    process.exit(allOk ? 0 : 1);
  } catch (err) {
    console.error('[FATAL]', err.message);
    process.exit(1);
  } finally {
    try { db.close(); } catch {}
  }
}

main();
