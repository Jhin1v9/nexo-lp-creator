const sqlite = require('../nexo-lp-server/models/sqlite');
const TemplateRepository = require('../nexo-lp-server/models/repositories/TemplateRepository');
const BridgeAdapter = require('../nexo-lp-server/services/lpBridgeAdapter.cjs');
const { sanitizePrompt } = require('../nexo-lp-server/services/prompts/nexoPromptPack');
const fs = require('fs');
const path = require('path');

async function main() {
  await sqlite.initializeDatabase();
  const tpl = await TemplateRepository.findById('tpl-1781952277335-pb928d');
  if (!tpl) {
    console.error('Template not found');
    process.exit(1);
  }

  const userId = `debug-${tpl.id}`;
  const context = {
    userId,
    sessionId: tpl.session_id,
    chatUrl: tpl.kimi_chat_url || null,
    retries: 0,
  };

  console.log('Sending sanitize prompt...');
  const result = await BridgeAdapter.sendMessage(context, sanitizePrompt(tpl.html), {
    mode: 'instant',
    newChat: !context.chatUrl,
    hardRefresh: false,
    phaseTimeoutMs: 0,
  });

  const outDir = path.join(__dirname, '..', 'tmp');
  fs.mkdirSync(outDir, { recursive: true });
  const rawPath = path.join(outDir, `debug-sanitize-step1-raw-${tpl.id}.txt`);
  fs.writeFileSync(rawPath, result.content);
  console.log('Raw response saved to', rawPath, 'length', result.content.length);

  // Run the same extraction logic
  const SanitizationOrchestrator = require('../nexo-lp-server/services/lpSanitizationOrchestrator');
  const extracted = SanitizationOrchestrator._extractHtml(result.content);
  const valid = SanitizationOrchestrator._isValidHtml(extracted);
  console.log('Extracted length', extracted.length);
  console.log('Valid', valid);
  const extractedPath = path.join(outDir, `debug-sanitize-step1-extracted-${tpl.id}.html`);
  fs.writeFileSync(extractedPath, extracted);
  console.log('Extracted saved to', extractedPath);

  await BridgeAdapter.closeUserPage(userId).catch(() => {});
  sqlite.closeDatabase();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
