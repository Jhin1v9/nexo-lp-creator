#!/usr/bin/env node
/**
 * One-shot importer: publishes existing NEXO LP Creator sessions to the LOJA.
 *
 * Flow:
 *   1. Reads sessions from the local NEXO LP backend API.
 *   2. Filters sessions that have a valid generated HTML preview.
 *   3. Publishes each session to the LOJA via POST /api/nexo-lp/sessions/:id/publish.
 *   4. The backend creates a template in 'sanitizing' status and triggers the
 *      Luna/Kimi sanitization orchestrator in the background.
 *   5. Writes a JSON log to data/imported-sessions.json.
 *
 * This script does NOT touch kimi.com; it only operates on our own NEXO LP API.
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const fs = require('fs');

const API_BASE = process.env.NEXO_LP_API_URL || 'http://localhost:3460/api/nexo-lp';
const LOG_PATH = path.resolve(__dirname, '../data/imported-sessions.json');
const LIMIT = parseInt(process.env.IMPORT_LIMIT || '0', 10) || undefined;

function validateHtml(html) {
  if (!html || typeof html !== 'string') return false;
  const h = html.trim().toLowerCase();
  return (
    h.includes('<!doctype html>') &&
    h.includes('<html') &&
    h.includes('</html>') &&
    (h.includes('<body') || h.includes('<main') || h.includes('<section'))
  );
}

async function apiGet(url) {
  const res = await fetch(`${API_BASE}${url}`);
  const json = await res.json();
  if (!json.success) {
    throw new Error(json.error?.message || `GET ${url} failed`);
  }
  return json.data;
}

async function apiPost(url, body) {
  const res = await fetch(`${API_BASE}${url}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {}),
  });
  const json = await res.json();
  if (!json.success) {
    throw new Error(json.error?.message || `POST ${url} failed`);
  }
  return json.data;
}

async function apiPatch(url, body) {
  const res = await fetch(`${API_BASE}${url}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {}),
  });
  const json = await res.json();
  if (!json.success) {
    throw new Error(json.error?.message || `PATCH ${url} failed`);
  }
  return json.data;
}

function writeLog(log) {
  fs.writeFileSync(LOG_PATH, JSON.stringify(log, null, 2));
}

function backupExistingLog() {
  if (!fs.existsSync(LOG_PATH)) return;
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.resolve(path.dirname(LOG_PATH), `imported-sessions.backup-${timestamp}.json`);
  fs.renameSync(LOG_PATH, backupPath);
  console.log(`[IMPORT] Backed up previous log to ${backupPath}`);
}

async function main() {
  backupExistingLog();

  const data = await apiGet('/sessions?page=1&limit=1000');
  const allSessions = data.sessions || [];
  console.log(`[IMPORT] Found ${allSessions.length} sessions via API`);

  let sessionsWithHtml = allSessions.filter((s) => validateHtml(s.current_html));
  if (LIMIT && LIMIT < sessionsWithHtml.length) {
    sessionsWithHtml = sessionsWithHtml.slice(0, LIMIT);
  }
  console.log(`[IMPORT] ${sessionsWithHtml.length} sessions have valid HTML (limit: ${LIMIT || 'none'})`);

  if (sessionsWithHtml.length === 0) {
    console.log('[IMPORT] Nothing to import.');
    return;
  }

  const log = {
    importedAt: new Date().toISOString(),
    apiBase: API_BASE,
    totalSessions: allSessions.length,
    sessionsWithHtml: sessionsWithHtml.length,
    processed: 0,
    results: [],
  };
  writeLog(log);

  for (let i = 0; i < sessionsWithHtml.length; i++) {
    const session = sessionsWithHtml[i];
    const result = {
      sessionId: session.id,
      prompt: session.initial_prompt || '',
      htmlLength: (session.current_html || '').length,
      success: false,
      templateId: null,
      error: null,
    };

    try {
      console.log(`[${i + 1}/${sessionsWithHtml.length}] Publishing session ${session.id} to LOJA (direct, no sanitization)...`);
      const published = await apiPost(`/sessions/${session.id}/publish`, { direct: true });
      result.success = true;
      result.templateId = published.templateId;
      result.status = published.status;
      console.log(`  -> template ${published.templateId} (status: ${published.status})`);
    } catch (err) {
      result.error = err.message;
      console.error(`  FAILED: ${err.message}`);
    }

    log.results.push(result);
    log.processed = log.results.length;
    writeLog(log);
  }

  const okCount = log.results.filter((r) => r.success).length;
  console.log(`[IMPORT] Log written to ${LOG_PATH}`);
  console.log(`[IMPORT] Done: ${okCount}/${sessionsWithHtml.length} sessions published to LOJA`);
  console.log('[IMPORT] Sanitization runs asynchronously in the background via Luna/Kimi bridge.');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('[IMPORT] Fatal error:', err.message);
    process.exit(1);
  });
