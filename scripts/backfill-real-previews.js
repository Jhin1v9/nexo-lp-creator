#!/usr/bin/env node
/**
 * Backfill real HTML previews for existing sessions.
 *
 * Usage:
 *   node scripts/backfill-real-previews.js sess-id-1 sess-id-2 ...
 *
 * The script stops the PM2-managed server while it runs to avoid bridge/DB
 * concurrency, regenerates each session via GenerationService, then restarts
 * the server. Sessions without an initial_prompt are skipped.
 */

const path = require('path');
const root = path.join(__dirname, '..');
process.chdir(root);

require('dotenv').config({ path: path.join(root, '.env') });

const { initializeDatabase, query } = require(path.join(root, 'nexo-lp-server/models/sqlite'));
const GenerationService = require(path.join(root, 'nexo-lp-server/services/lpGenerationService'));
const config = require(path.join(root, 'nexo-lp-server/config/nexo-lp-config'));

const { execSync } = require('child_process');

function pm2(cmd) {
  console.log(`[pm2] ${cmd}`);
  execSync(`pm2 ${cmd}`, { stdio: 'inherit' });
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const sessionIds = process.argv.slice(2);
  if (sessionIds.length === 0) {
    console.error('Usage: node scripts/backfill-real-previews.js <session-id> [...]');
    process.exit(1);
  }

  await initializeDatabase();

  const rows = await query(
    `SELECT id, status, initial_prompt, metadata_json FROM sessions WHERE id IN (${sessionIds.map(() => '?').join(',')})`,
    sessionIds
  );

  const byId = new Map(rows.map((r) => [r.id, r]));

  // Stop the server to avoid concurrency on the bridge page and DB writes.
  try {
    pm2('stop nexo-lp-server');
  } catch (e) {
    console.warn('[pm2] could not stop nexo-lp-server, continuing anyway');
  }

  let succeeded = 0;
  let failed = 0;
  let skipped = 0;

  for (const sessionId of sessionIds) {
    const row = byId.get(sessionId);
    if (!row) {
      console.warn(`[skip] ${sessionId}: session not found`);
      skipped++;
      continue;
    }
    if (!row.initial_prompt || row.initial_prompt.trim().length === 0) {
      console.warn(`[skip] ${sessionId}: no initial_prompt`);
      skipped++;
      continue;
    }

    console.log(`\n[backfill] ${sessionId}: ${row.initial_prompt}`);
    try {
      await GenerationService.startGeneration(
        sessionId,
        row.initial_prompt,
        config.stacks.default,
        { userId: 'backfill-script' }
      );
      const after = await query('SELECT status, length(current_html) AS html_len FROM sessions WHERE id=?', [sessionId]);
      console.log(`[backfill] ${sessionId}: done -> status=${after[0]?.status}, html_len=${after[0]?.html_len}`);
      succeeded++;
    } catch (err) {
      console.error(`[backfill] ${sessionId}: FAILED - ${err.message}`);
      failed++;
    }
    await sleep(2000);
  }

  console.log(`\n[backfill] finished: ${succeeded} succeeded, ${failed} failed, ${skipped} skipped`);

  // Restart the server regardless of results.
  pm2('start nexo-lp-server');
}

main().catch((err) => {
  console.error('[backfill] fatal:', err);
  try {
    pm2('start nexo-lp-server');
  } catch (e) {
    // ignore
  }
  process.exit(1);
});
