#!/usr/bin/env node
/**
 * Cron task: publish sessions with valid HTML that were never sent to the LOJA.
 *
 * These templates are published as "unreviewed" (discounted) and then scheduled
 * for background sanitization. When sanitization succeeds, the orchestrator
 * promotes them to 'available' and restores the full price.
 */

const path = require('path');

process.env.NODE_ENV = process.env.NODE_ENV || 'production';

const fs = require('fs');
const { initializeDatabase, closeDatabase, query } = require('../nexo-lp-server/models/sqlite');
const lpTemplateService = require('../nexo-lp-server/services/lpTemplateService');
const SanitizationOrchestrator = require('../nexo-lp-server/services/lpSanitizationOrchestrator');

const LOG_PATH = path.resolve(__dirname, '../data/cron-unreviewed-log.json');
const BATCH_LIMIT = parseInt(process.env.CRON_UNREVIEWED_LIMIT || '50', 10);
const DELAY_MS = parseInt(process.env.CRON_UNREVIEWED_DELAY_MS || '3000', 10);

function isValidHtml(html) {
  if (!html || typeof html !== 'string' || html.length < 15000) return false;
  const lower = html.toLowerCase();
  return (
    lower.includes('<!doctype html>') &&
    lower.includes('<html') &&
    lower.includes('</html>') &&
    lower.includes('<body')
  );
}

function isTestSession(session) {
  const prompt = (session.initial_prompt || '').toLowerCase();
  const uid = (session.user_id || '').toLowerCase();
  return prompt.includes('test') || uid.startsWith('test-') || uid.startsWith('anonymous-');
}

function writeLog(log) {
  fs.writeFileSync(LOG_PATH, JSON.stringify(log, null, 2));
}

async function findCandidateSessions(limit) {
  return query(`
    SELECT s.*
    FROM sessions s
    LEFT JOIN templates t ON t.session_id = s.id
    WHERE s.current_html IS NOT NULL
      AND s.status IN ('preview', 'deployed', 'review')
      AND t.id IS NULL
    ORDER BY s.updated_at DESC
    LIMIT ?
  `, [limit]);
}

async function main() {
  await initializeDatabase();

  const log = {
    startedAt: new Date().toISOString(),
    processed: 0,
    published: 0,
    failed: 0,
    skipped: 0,
    results: [],
  };

  const sanitizationPromises = [];

  try {
    const candidates = await findCandidateSessions(BATCH_LIMIT);
    console.log(`[CRON] Found ${candidates.length} candidate sessions`);

    for (const session of candidates) {
      const result = {
        sessionId: session.id,
        success: false,
        skipped: false,
        templateId: null,
        error: null,
      };

      if (isTestSession(session)) {
        result.skipped = true;
        result.error = 'test session';
        log.skipped += 1;
        log.results.push(result);
        continue;
      }

      if (!isValidHtml(session.current_html)) {
        result.skipped = true;
        result.error = 'invalid HTML';
        log.skipped += 1;
        log.results.push(result);
        continue;
      }

      try {
        const template = await lpTemplateService.publishUnreviewedFromSession(
          session.id,
          session.user_id,
          'cron-backfill'
        );
        result.success = true;
        result.templateId = template.id;
        log.published += 1;
        console.log(`[CRON] Published ${session.id} -> ${template.id}`);

        // Start sanitization and keep the process alive until the queue drains.
        // If it succeeds, the orchestrator promotes the template to 'available'.
        const p = SanitizationOrchestrator.startSanitization(
          session.id,
          session.current_html,
          session.initial_prompt || '',
          session.kimi_chat_url || null,
          session.user_id
        ).catch((err) => console.error(`[CRON] Sanitization failed for ${session.id}:`, err.message));
        sanitizationPromises.push(p);
      } catch (err) {
        result.error = err.message;
        log.failed += 1;
        console.error(`[CRON] Failed ${session.id}: ${err.message}`);
      }

      log.results.push(result);
      log.processed += 1;
      writeLog(log);

      if (DELAY_MS > 0) {
        await new Promise((resolve) => setTimeout(resolve, DELAY_MS));
      }
    }

    if (sanitizationPromises.length > 0) {
      console.log(`[CRON] Waiting for ${sanitizationPromises.length} sanitization(s) to finish...`);
      await Promise.all(sanitizationPromises);
      console.log('[CRON] Sanitization queue drained');
    }
  } finally {
    log.finishedAt = new Date().toISOString();
    writeLog(log);
    closeDatabase();
  }

  console.log(`[CRON] Done: ${log.published} published, ${log.failed} failed, ${log.skipped} skipped`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('[CRON] Fatal error:', err.message);
    process.exit(1);
  });
