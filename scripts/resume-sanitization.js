#!/usr/bin/env node
/**
 * Resume sanitization for templates stuck in 'sanitizing' status.
 * Processes templates sequentially so the bridge is not overwhelmed.
 */

process.env.NODE_ENV = process.env.NODE_ENV || 'production';

const { initializeDatabase, closeDatabase, query } = require('../nexo-lp-server/models/sqlite');
const SessionRepository = require('../nexo-lp-server/models/repositories/SessionRepository');
const TemplateRepository = require('../nexo-lp-server/models/repositories/TemplateRepository');
const SanitizationOrchestrator = require('../nexo-lp-server/services/lpSanitizationOrchestrator');

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  await initializeDatabase();

  try {
    const templates = await query(`
      SELECT id, session_id, original_html, kimi_chat_url, created_by
      FROM templates
      WHERE status = 'sanitizing'
      ORDER BY created_at ASC
    `);

    console.log(`Resuming sanitization for ${templates.length} template(s)...`);

    for (const template of templates) {
      const session = await SessionRepository.findById(template.session_id);
      if (!session) {
        console.log(`[skip] Session ${template.session_id} not found for template ${template.id}`);
        continue;
      }

      const html = template.original_html || session.current_html || '';
      const prompt = session.initial_prompt || '';
      const chatUrl = template.kimi_chat_url || null;
      const userId = template.created_by || session.user_id;

      console.log(`[resume] ${template.id} (session ${template.session_id})`);
      try {
        const result = await SanitizationOrchestrator.startSanitization(
          template.session_id,
          html,
          prompt,
          chatUrl,
          userId
        );
        if (result.success) {
          console.log(`[success] ${template.id} -> ${result.metadata?.category || 'landing'}/${result.metadata?.subcategory || 'landing'}`);
        } else {
          console.error(`[failed] ${template.id}: ${result.error}`);
        }
      } catch (err) {
        console.error(`[error] ${template.id}: ${err.message}`);
      }

      // Brief pause between templates to keep bridge stable.
      await sleep(5000);
    }

    console.log('Resume loop complete.');
  } finally {
    closeDatabase();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
