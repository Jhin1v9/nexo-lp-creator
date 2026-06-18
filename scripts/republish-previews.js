require('dotenv').config();
const path = require('path');
process.env.NEXO_LP_DB_PATH = path.resolve('./data/nexo-lp.db');

const { initializeDatabase, closeDatabase } = require('../nexo-lp-server/models/sqlite');
const TemplateRepository = require('../nexo-lp-server/models/repositories/TemplateRepository');
const PreviewService = require('../nexo-lp-server/services/lpPreviewService');

async function main() {
  await initializeDatabase();
  const result = await TemplateRepository.findAll({ limit: 1000 });
  const templates = result.templates || [];
  console.log('Found', templates.length, 'templates');
  let updated = 0;
  for (const t of templates) {
    if (!t.public_preview_token) continue;
    const html = t.sanitized_html || t.html;
    if (!html) continue;
    try {
      await PreviewService.updatePublicPreview(t.public_preview_token, html);
      updated++;
    } catch (e) {
      console.error('Failed to update', t.id, e.message);
    }
  }
  console.log('Republished', updated, 'previews');
  closeDatabase();
}

main().catch((e) => { console.error(e); process.exit(1); });
