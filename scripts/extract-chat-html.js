#!/usr/bin/env node
/**
 * Extract the last HTML code block from a specific Kimi Web chat and save it
 * as a session preview. Useful to backfill previews for sessions that already
 * have a working Kimi chat but failed to capture the HTML.
 *
 * Usage:
 *   node scripts/extract-chat-html.js <session-id> <kimi-chat-url>
 */

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { initializeDatabase, query, run } = require(path.join(__dirname, '../nexo-lp-server/models/sqlite'));

const sessionId = process.argv[2];
const chatUrl = process.argv[3];

if (!sessionId || !chatUrl) {
  console.error('Usage: node scripts/extract-chat-html.js <session-id> <kimi-chat-url>');
  process.exit(1);
}

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

async function main() {
  await initializeDatabase();

  const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
  const context = browser.contexts()[0] || await browser.newContext();
  const page = await context.newPage();

  console.log(`[extract] navigating to ${chatUrl}`);
  await page.goto(chatUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(5000);

  // Wait for at least one assistant message.
  try {
    await page.waitForSelector('.segment-assistant', { timeout: 30000 });
  } catch (e) {
    console.warn('[extract] no .segment-assistant found, taking what we have');
  }

  const fullText = await extractLastHtml(page);
  const html = extractHtmlFromResponse(fullText);

  await browser.close();

  if (!html || html.length < 100) {
    console.error('[extract] could not find valid HTML in chat');
    console.error('[extract] raw preview:', fullText.slice(0, 500));
    process.exit(1);
  }

  const previewDir = path.join(__dirname, '../data/previews');
  fs.mkdirSync(previewDir, { recursive: true });
  const previewPath = path.join(previewDir, `${sessionId}.html`);
  fs.writeFileSync(previewPath, html, 'utf8');

  const previewUrl = `/api/nexo-lp/preview/${sessionId}`;
  await run(
    'UPDATE sessions SET current_html = ?, preview_url = ?, status = ? WHERE id = ?',
    [html, previewUrl, 'preview', sessionId]
  );

  console.log(`[extract] saved ${html.length} chars to ${previewPath}`);
  console.log(`[extract] session ${sessionId} updated to preview`);
}

main().catch((err) => {
  console.error('[extract] fatal:', err);
  process.exit(1);
});
