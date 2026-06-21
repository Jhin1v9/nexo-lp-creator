#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
process.env.NODE_ENV = process.env.NODE_ENV || 'production';

const { initializeDatabase, closeDatabase, query } = require('../nexo-lp-server/models/sqlite');
const BridgeAdapter = require('../nexo-lp-server/services/lpBridgeAdapter.cjs');
const { sanitizePrompt } = require('../nexo-lp-server/services/prompts/nexoPromptPack');

async function main() {
  await initializeDatabase();
  const rows = await query("SELECT id, html FROM templates WHERE id='tpl-1781734622996-357byi'");
  const tpl = rows[0];
  const prompt = sanitizePrompt(tpl.html);
  const context = BridgeAdapter.initializeContext('inspect-session');
  const outDir = path.join(__dirname, '..', 'tmp', 'inspect');
  fs.mkdirSync(outDir, { recursive: true });

  console.log('Sending to Kimi...');
  const result = await BridgeAdapter.sendMessage(context, prompt, { mode: 'instant', phase: 'sanitize' });

  const bridge = await BridgeAdapter.ensureBridge();
  const session = bridge.userSessions.get(context.userId);
  const page = session?.page;
  if (page) {
    const pageHtml = await page.content().catch(() => '');
    fs.writeFileSync(path.join(outDir, 'page-content.html'), pageHtml);
    await page.screenshot({ path: path.join(outDir, 'screenshot.png'), fullPage: true });
    console.log('Saved page-content.html and screenshot.png to', outDir);

    // Try to find artifact/code tab buttons
    const buttons = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('button, [role="button"], a, div, span'))
        .filter(el => {
          const rect = el.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0;
        })
        .map(el => ({
          tag: el.tagName,
          class: el.className,
          text: el.textContent.trim().slice(0, 80),
          ariaLabel: el.getAttribute('aria-label'),
          title: el.getAttribute('title'),
        }));
    });
    fs.writeFileSync(path.join(outDir, 'buttons.json'), JSON.stringify(buttons, null, 2));
    console.log('Saved buttons.json, total buttons:', buttons.length);
  } else {
    console.log('No page found');
  }

  console.log('Raw response length:', result.content.length);
  console.log('Contains </html>:', /<\/html\s*>/i.test(result.content));
  closeDatabase();
  process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });
