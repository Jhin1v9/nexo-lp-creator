#!/usr/bin/env node
/**
 * One-off script: sanitize all current 'unreviewed' templates.
 * Keeps the process alive until the sanitization queue drains.
 */

const path = require('path');
process.env.NODE_ENV = process.env.NODE_ENV || 'production';

const { initializeDatabase, closeDatabase, query } = require('../nexo-lp-server/models/sqlite');
const SessionRepository = require('../nexo-lp-server/models/repositories/SessionRepository');
const TemplateRepository = require('../nexo-lp-server/models/repositories/TemplateRepository');
const SanitizationOrchestrator = require('../nexo-lp-server/services/lpSanitizationOrchestrator');

async function main() {
  await initializeDatabase();

  const templates = await query(
    `SELECT id, session_id, html FROM templates WHERE status = 'unreviewed'`
  );
  console.log(`[SANITIZE] Found ${templates.length} unreviewed template(s)`);

  const promises = [];
  for (const tpl of templates) {
    const session = await SessionRepository.findById(tpl.session_id);
    if (!session) {
      console.warn(`[SANITIZE] Session not found for ${tpl.session_id}`);
      continue;
    }
    const html = tpl.html || session.current_html || '';
    if (!html) {
      console.warn(`[SANITIZE] No HTML for ${tpl.id}`);
      continue;
    }
    console.log(`[SANITIZE] Starting ${tpl.id} (session ${tpl.session_id})`);
    const p = SanitizationOrchestrator.startSanitization(
      tpl.session_id,
      html,
      session.initial_prompt || '',
      session.kimi_chat_url || null,
      session.user_id
    ).then((result) => {
      console.log(`[SANITIZE] Finished ${tpl.id}:`, result.success ? 'success' : result.error);
    }).catch((err) => {
      console.error(`[SANITIZE] Failed ${tpl.id}:`, err.message);
    });
    promises.push(p);
  }

  if (promises.length > 0) {
    console.log(`[SANITIZE] Waiting for ${promises.length} sanitization(s)...`);
    await Promise.all(promises);
  }

  closeDatabase();
  console.log('[SANITIZE] Done');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('[SANITIZE] Fatal error:', err.message);
    process.exit(1);
  });
