#!/usr/bin/env node
process.env.NODE_ENV = process.env.NODE_ENV || 'production';
process.env.SANITIZE_CONCURRENCY = '1';
process.env.SANITIZE_KIMI_DELAY_MS = '5000';

const { initializeDatabase, closeDatabase, query } = require('../nexo-lp-server/models/sqlite');
const SessionRepository = require('../nexo-lp-server/models/repositories/SessionRepository');
const orchestrator = require('../nexo-lp-server/services/lpSanitizationOrchestrator');

const targetId = process.argv.find((arg) => arg.startsWith('--template-id='))?.split('=')[1];
const forceMode = process.argv.includes('--force');

async function sanitizeTemplate(tpl) {
  const prefix = `[${tpl.id}]`;
  console.log(`\n${prefix} Starting full sanitization combo`);

  const session = await SessionRepository.findById(tpl.session_id);
  // Prefer the original (un-sanitized) HTML so we don't feed a previously
  // duplicated or broken sanitized_html back into the sanitizer.
  const originalHtml = tpl.original_html || tpl.html || session?.current_html || '';
  if (!originalHtml) {
    console.warn(`${prefix} No HTML, skipping`);
    return { success: false, error: 'No HTML' };
  }

  const result = await orchestrator.startSanitization(
    tpl.session_id,
    originalHtml,
    session?.prompt || '',
    session?.kimi_chat_url || null,
    `sanitize-${tpl.id}`
  );

  if (result.success) {
    console.log(`${prefix} OK — htmlLength=${result.htmlLength}, metadata=${JSON.stringify(result.metadata).substring(0, 120)}`);
  } else {
    console.error(`⚠️  ${prefix} FAILED: ${result.error}`);
  }
  return result;
}

async function main() {
  await initializeDatabase();

  let rows;
  if (targetId) {
    rows = await query(
      forceMode
        ? 'SELECT id, session_id, html, original_html, status FROM templates WHERE id = ?'
        : 'SELECT id, session_id, html, original_html, status FROM templates WHERE id = ? AND status = ?',
      forceMode ? [targetId] : [targetId, 'unreviewed']
    );
  } else {
    rows = await query(`
      SELECT id, session_id, html, original_html, status
      FROM templates
      WHERE status = 'unreviewed'
      ORDER BY created_at
    `);
  }

  console.log(`Found ${rows.length} unreviewed template(s)`);

  if (rows.length === 0) {
    closeDatabase();
    console.log('Nothing to do.');
    process.exit(0);
  }

  const failed = [];
  for (const tpl of rows) {
    try {
      const result = await sanitizeTemplate(tpl);
      if (!result.success) failed.push({ id: tpl.id, error: result.error });
    } catch (err) {
      console.error(`⚠️  [${tpl.id}] ERROR: ${err.message}`);
      failed.push({ id: tpl.id, error: err.message });
    }
  }

  closeDatabase();

  if (failed.length > 0) {
    console.error('\n⚠️  FAILED TEMPLATES:');
    failed.forEach((f) => console.error(`  - ${f.id}: ${f.error}`));
    process.exit(1);
  }

  console.log('\nDone: all unreviewed templates sanitized');
  process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });
