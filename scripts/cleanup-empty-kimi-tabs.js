const { chromium } = require('playwright');

const CDP_URL = process.env.KIMI_CDP_URL || 'http://127.0.0.1:9226';

async function main() {
  const browser = await chromium.connectOverCDP(CDP_URL);
  let closed = 0;
  let kept = 0;

  try {
    const contexts = browser.contexts();
    for (const ctx of contexts) {
      const pages = ctx.pages();
      for (const p of pages) {
        const url = p.url();
        if (!url.includes('kimi.com')) continue;

        const isRealChat = url.includes('/chat/');
        const assistantCount = await p.evaluate(() => document.querySelectorAll('.segment-assistant').length).catch(() => 0);

        if (!isRealChat || assistantCount === 0) {
          console.log(`Closing empty/new_chat tab: ${url}`);
          try { await p.close(); closed++; } catch (e) { console.log(`  close failed: ${e.message}`); }
        } else {
          console.log(`Keeping real chat tab: ${url} (assistants=${assistantCount})`);
          kept++;
        }
      }
    }
  } finally {
    console.log(`Closed ${closed} tabs, kept ${kept} tabs.`);
    await browser.close().catch((e) => console.error('Failed to close browser:', e.message));
  }
}

main().catch(e => { console.error(e); process.exit(1); });
