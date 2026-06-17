#!/usr/bin/env node
/**
 * One-off utility: publish existing successful session previews to the LOJA.
 * Filters out test/error sessions and triggers background sanitization.
 */

const path = require('path');

process.env.NODE_ENV = process.env.NODE_ENV || 'production';

const { initializeDatabase, closeDatabase, query } = require('../nexo-lp-server/models/sqlite');
const lpTemplateService = require('../nexo-lp-server/services/lpTemplateService');

function isValidHtml(html) {
  if (!html || html.length < 15000) return false;
  const lower = html.toLowerCase();
  return lower.includes('<html') && lower.includes('</html>') && lower.includes('<body') && lower.includes('</body>');
}

function isTestSession(session) {
  const prompt = (session.initial_prompt || '').toLowerCase();
  const uid = (session.user_id || '').toLowerCase();
  return prompt.includes('test') || uid.startsWith('test-') || uid.startsWith('anonymous-');
}

async function main() {
  await initializeDatabase();

  try {
    const sessions = await query(`
      SELECT id, user_id, initial_prompt, current_html, created_at
      FROM sessions
      WHERE status = 'preview' AND current_html IS NOT NULL
      ORDER BY created_at DESC
    `);

    const candidates = sessions.filter((s) => isValidHtml(s.current_html) && !isTestSession(s));

    console.log(`Found ${sessions.length} preview sessions, ${candidates.length} are valid candidates.`);

    const results = [];
    for (const session of candidates) {
      try {
        const existing = await lpTemplateService.repository.findBySessionId(session.id);
        if (existing) {
          console.log(`[skip] ${session.id} already published as ${existing.id}`);
          results.push({ sessionId: session.id, skipped: true, templateId: existing.id });
          continue;
        }

        const template = await lpTemplateService.publishFromSession(session.id, session.user_id);
        console.log(`[published] ${session.id} -> ${template.id} (status=${template.status})`);
        results.push({ sessionId: session.id, templateId: template.id, status: template.status });

        // Small delay between submissions to avoid hammering the bridge.
        await new Promise((r) => setTimeout(r, 2000));
      } catch (err) {
        console.error(`[failed] ${session.id}: ${err.message}`);
        results.push({ sessionId: session.id, error: err.message });
      }
    }

    console.log('\nSummary:');
    console.table(results);
  } finally {
    closeDatabase();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
