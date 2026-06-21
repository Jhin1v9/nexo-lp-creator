/**
 * Regenerate all session preview files from the current_html stored in the DB.
 */
const path = require('path');
const Database = require('better-sqlite3');
const PreviewService = require('../nexo-lp-server/services/lpPreviewService');
const SessionRepository = require('../nexo-lp-server/models/repositories/SessionRepository');

const dbPath = process.env.NEXO_LP_DB_PATH || path.resolve(__dirname, '../data/nexo-lp.db');
process.env.NEXO_LP_DB_PATH = dbPath;

const { initializeDatabase, closeDatabase } = require('../nexo-lp-server/models/sqlite');

async function main() {
  await initializeDatabase();

  const sessions = await SessionRepository.list({}, 1, 10000);
  let regenerated = 0;
  let skipped = 0;
  let removed = 0;

  for (const session of sessions) {
    const sessionId = session.id;
    const html = session.current_html;

    if (!html || html.trim().length === 0) {
      const filePath = PreviewService.getPreviewFilePath(sessionId);
      if (require('fs').existsSync(filePath)) {
        PreviewService.deletePreview(sessionId);
        removed += 1;
      } else {
        skipped += 1;
      }
      continue;
    }

    await PreviewService.savePreview(sessionId, html, {
      css: session.generated_css || '',
      js: session.generated_js || '',
    });
    regenerated += 1;
  }

  closeDatabase();
  console.log(`Regenerated: ${regenerated}, Removed (no html): ${removed}, Skipped (already empty): ${skipped}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
