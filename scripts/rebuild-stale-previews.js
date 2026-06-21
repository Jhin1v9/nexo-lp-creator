/**
 * Rebuild preview files that still contain old mock HTML.
 * Rewrites them from the session's current_html when a real HTML exists.
 */
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const PreviewService = require('../nexo-lp-server/services/lpPreviewService');
const SessionRepository = require('../nexo-lp-server/models/repositories/SessionRepository');

const dbPath = process.env.NEXO_LP_DB_PATH || path.resolve(__dirname, '../data/nexo-lp.db');
process.env.NEXO_LP_DB_PATH = dbPath;

const { initializeDatabase, closeDatabase } = require('../nexo-lp-server/models/sqlite');

const MOCK_MARKERS = [
  'NEXO AI',
  'Criado sob medida',
  'A melhor experiência',
  'Quero saber mais',
  'Powerful Features',
  'What Our Users Say',
  'Sua melhor escolha em',
  'Ready to Get Started?',
];

function looksMock(html) {
  return MOCK_MARKERS.some((m) => html.includes(m));
}

async function main() {
  await initializeDatabase();
  const previewsDir = path.resolve(__dirname, '../data/previews');
  const files = fs.readdirSync(previewsDir).filter((f) => f.endsWith('.html'));

  let scanned = 0;
  let rebuilt = 0;
  let skipped = 0;
  let removed = 0;

  for (const file of files) {
    const sessionId = file.replace(/\.html$/, '');
    const filePath = path.join(previewsDir, file);
    const html = fs.readFileSync(filePath, 'utf-8');
    scanned += 1;

    if (!looksMock(html)) continue;

    const session = await SessionRepository.findById(sessionId);
    if (!session || !session.current_html || looksMock(session.current_html)) {
      // No real HTML to rebuild from — delete stale mock preview.
      fs.unlinkSync(filePath);
      removed += 1;
      console.log(`[REMOVE] ${sessionId}: no real HTML available`);
      continue;
    }

    await PreviewService.savePreview(sessionId, session.current_html);
    rebuilt += 1;
    console.log(`[REBUILD] ${sessionId}: preview rebuilt from current_html (${session.current_html.length} chars)`);
  }

  closeDatabase();
  console.log(`\nScanned: ${scanned}, Rebuilt: ${rebuilt}, Removed: ${removed}, Already OK: ${skipped}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
