#!/usr/bin/env node
/**
 * One-off script: sanitize all current 'unreviewed' templates sequentially.
 * Processes one template at a time with a short pause between them so the
 * Kimi bridge is not overwhelmed.
 */

const path = require('path');
process.env.NODE_ENV = process.env.NODE_ENV || 'production';

const { initializeDatabase, closeDatabase, query } = require('../nexo-lp-server/models/sqlite');
const SessionRepository = require('../nexo-lp-server/models/repositories/SessionRepository');
const SanitizationOrchestrator = require('../nexo-lp-server/services/lpSanitizationOrchestrator');

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  await initializeDatabase();

  const templates = await query(
    `SELECT id, session_id, html FROM templates WHERE status = 'unreviewed' ORDER BY created_at ASC`
  );
  console.log(`[SANITIZE] Found ${templates.length} unreviewed template(s)`);

  let success = 0;
  let failed = 0;

  for (const tpl of templates) {
    const session = await SessionRepository.findById(tpl.session_id);
    if (!session) {
      console.warn(`[SANITIZE] Session not found for ${tpl.session_id}`);
      failed += 1;
      continue;
    }
    const html = tpl.html || session.current_html || '';
    if (!html) {
      console.warn(`[SANITIZE] No HTML for ${tpl.id}`);
      failed += 1;
      continue;
    }

    console.log(`[SANITIZE] Starting ${tpl.id} (session ${tpl.session_id})`);
    try {
      const result = await SanitizationOrchestrator.startSanitization(
        tpl.session_id,
        html,
        session.initial_prompt || '',
        session.kimi_chat_url || null,
        session.user_id
      );
      if (result && result.success) {
        console.log(`[SANITIZE] Finished ${tpl.id}: success`);
        success += 1;
      } else {
        console.error(`[SANITIZE] Finished ${tpl.id}: ${result?.error || 'unknown failure'}`);
        failed += 1;
      }
    } catch (err) {
      console.error(`[SANITIZE] Failed ${tpl.id}:`, err.message);
      failed += 1;
    }

    // Brief pause to keep the bridge stable before the next template.
    await sleep(5000);
  }

  closeDatabase();
  console.log(`[SANITIZE] Done: ${success} succeeded, ${failed} failed (total ${templates.length})`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('[SANITIZE] Fatal error:', err.message);
    process.exit(1);
  });
