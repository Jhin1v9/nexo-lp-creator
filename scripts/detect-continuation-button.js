#!/usr/bin/env node
process.env.NODE_ENV = process.env.NODE_ENV || 'production';
const fs = require('fs');
const { chromium } = require('playwright');

const { initializeDatabase, query, closeDatabase } = require('../nexo-lp-server/models/sqlite');
const BridgeAdapter = require('../nexo-lp-server/services/lpBridgeAdapter.cjs');
const { sanitizePrompt } = require('../nexo-lp-server/services/prompts/nexoPromptPack');

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function detectButtons(page) {
  return page.evaluate(() => {
    const candidates = [];
    const all = Array.from(document.querySelectorAll('button, [role="button"], a, div'));
    for (const el of all) {
      const text = (el.textContent || '').trim().replace(/\s+/g, ' ');
      if (!text) continue;
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;
      candidates.push({
        tag: el.tagName,
        text: text.slice(0, 200),
        className: el.className,
        ariaLabel: el.getAttribute('aria-label'),
        rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
      });
    }
    return candidates;
  });
}

async function main() {
  await initializeDatabase();
  const rows = await query("SELECT id, html FROM templates WHERE id='tpl-1781734622996-357byi'");
  const tpl = rows[0];
  const prompt = sanitizePrompt(tpl.html);
  const context = BridgeAdapter.initializeContext('debug-session');
  console.log('Sending long prompt...');

  // Start generation but don't await; we will poll for buttons.
  const genPromise = BridgeAdapter.sendMessage(context, prompt, { mode: 'instant', phase: 'sanitize' });

  const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
  const page = browser.contexts()[0].pages()[0];

  const seen = new Set();
  const start = Date.now();
  while (Date.now() - start < 180000) {
    await sleep(3000);
    try {
      const buttons = await detectButtons(page);
      for (const b of buttons) {
        const key = `${b.text}|${b.className}|${b.rect.x}|${b.rect.y}`;
        if (seen.has(key)) continue;
        seen.add(key);
        if (/继续|continue|展开|show more|more|load more|send anyway|confirm|确定|ok/i.test(b.text)) {
          console.log('[CANDIDATE]', JSON.stringify(b));
        }
      }
    } catch (e) {
      console.warn('poll error', e.message);
    }
  }

  console.log('Waiting generation to finish...');
  const result = await genPromise;
  fs.writeFileSync('/home/jhin/luna/nexo-lp-creator/tmp/continue-raw.html', result.content);
  console.log('Raw length:', result.content.length);
  await browser.close();
  closeDatabase();
}

main().catch((err) => { console.error(err); process.exit(1); });
