#!/usr/bin/env node
/**
 * Backfill real HTML previews for sessions that already have a Kimi chat URL
 * but are missing a preview or have a mock/old preview.
 *
 * The script opens each chat in the browser, extracts the last HTML code block
 * from Kimi's last assistant message, and writes it to data/previews/{id}.html.
 */

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { initializeDatabase, query, run } = require(path.join(__dirname, '../nexo-lp-server/models/sqlite'));

async function extractLastHtml(page) {
  return page.evaluate(() => {
    const assistants = document.querySelectorAll('.segment-assistant');
    const last = assistants[assistants.length - 1];
    if (!last) return '';
    const contentBox = last.querySelector('.segment-content-box');
    if (!contentBox) return '';
    const containers = Array.from(contentBox.querySelectorAll('.markdown-container'));
    let text = '';
    for (const md of containers) {
      const codeBlocks = md.querySelectorAll('.segment-code, pre code, [class*="code-block"]');
      for (const cb of codeBlocks) {
        const contentEl = cb.querySelector('.segment-code-content') || cb.querySelector('pre code') || cb;
        const t = (contentEl.textContent || contentEl.innerText || '').trim();
        if (t) text += t + '\n\n';
      }
      const paragraphs = md.querySelectorAll('.paragraph, p, [class*="text"]');
      for (const p of paragraphs) {
        const t = (p.innerText || p.textContent || '').trim();
        if (t) text += t + '\n\n';
      }
    }
    return text.trim();
  });
}

function extractHtmlFromResponse(response) {
  if (!response) return '';
  const normalized = response.replace(/```html\s*/gi, '').replace(/```/g, '');
  const start = normalized.toLowerCase().indexOf('<!doctype');
  const start2 = normalized.toLowerCase().indexOf('<html');
  const s = start >= 0 ? start : start2;
  const end = normalized.toLowerCase().lastIndexOf('</html>');
  if (s >= 0 && end > s) {
    return normalized.slice(s, end + 7).trim();
  }
  return normalized.trim();
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  await initializeDatabase();

  const rows = await query(`
    SELECT id, status, current_html, metadata_json
    FROM sessions
    WHERE metadata_json LIKE '%kimiChatUrl%'
      AND (
        status IN ('failed', 'created')
        OR current_html IS NULL
        OR LENGTH(current_html) < 15000
      )
    ORDER BY created_at DESC
  `);

  if (rows.length === 0) {
    console.log('[backfill-all] no sessions need backfill');
    return;
  }

  console.log(`[backfill-all] ${rows.length} sessions to backfill`);

  const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
  const context = browser.contexts()[0] || await browser.newContext();
  const page = await context.newPage();

  let succeeded = 0;
  let failed = 0;
  let skipped = 0;

  for (const row of rows) {
    let metadata = {};
    try {
      metadata = JSON.parse(row.metadata_json || '{}');
    } catch (e) {
      // ignore
    }
    const chatUrl = metadata.kimiChatUrl;
    if (!chatUrl || !chatUrl.includes('/chat/')) {
      console.log(`[skip] ${row.id}: no valid chat URL`);
      skipped++;
      continue;
    }

    try {
      console.log(`\n[backfill-all] ${row.id}: ${chatUrl}`);
      await page.goto(chatUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForTimeout(4000);
      await page.waitForSelector('.segment-assistant', { timeout: 30000 });
      const fullText = await extractLastHtml(page);
      const html = extractHtmlFromResponse(fullText);

      if (!html || html.length < 100) {
        console.warn(`[backfill-all] ${row.id}: no valid HTML found`);
        failed++;
        continue;
      }

      const previewDir = path.join(__dirname, '../data/previews');
      fs.mkdirSync(previewDir, { recursive: true });
      const previewPath = path.join(previewDir, `${row.id}.html`);
      fs.writeFileSync(previewPath, html, 'utf8');

      await run(
        'UPDATE sessions SET current_html = ?, preview_url = ?, status = ? WHERE id = ?',
        [html, `/api/nexo-lp/preview/${row.id}`, 'preview', row.id]
      );

      console.log(`[backfill-all] ${row.id}: saved ${html.length} chars`);
      succeeded++;
    } catch (err) {
      console.error(`[backfill-all] ${row.id}: error - ${err.message}`);
      failed++;
    }
    await sleep(2000);
  }

  await browser.close();
  console.log(`\n[backfill-all] finished: ${succeeded} succeeded, ${failed} failed, ${skipped} skipped`);
}

main().catch((err) => {
  console.error('[backfill-all] fatal:', err);
  process.exit(1);
});
