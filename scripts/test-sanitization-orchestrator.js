#!/usr/bin/env node
process.env.NODE_ENV = process.env.NODE_ENV || 'production';

const { initializeDatabase, closeDatabase, query } = require('../nexo-lp-server/models/sqlite');
const SessionRepository = require('../nexo-lp-server/models/repositories/SessionRepository');
const SanitizationOrchestrator = require('../nexo-lp-server/services/lpSanitizationOrchestrator');

async function main() {
  await initializeDatabase();

  const rows = await query("SELECT id, session_id, html FROM templates WHERE status = 'unreviewed' ORDER BY created_at ASC LIMIT 1");
  if (rows.length === 0) {
    console.log('No unreviewed templates');
    closeDatabase();
    process.exit(0);
  }

  const tpl = rows[0];
  const session = await SessionRepository.findById(tpl.session_id);
  const html = tpl.html || session.current_html || '';

  console.log('Testing sanitization for', tpl.id);
  console.log('Original HTML length:', html.length);

  const result = await SanitizationOrchestrator.startSanitization(
    tpl.session_id,
    html,
    session.initial_prompt || '',
    session.kimi_chat_url || null,
    session.user_id
  );

  console.log('\nResult success:', result.success);
  if (!result.success) console.log('Error:', result.error);
  console.log('HTML length:', result.htmlLength);
  console.log('Metadata:', JSON.stringify(result.metadata, null, 2));

  closeDatabase();
  process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });
