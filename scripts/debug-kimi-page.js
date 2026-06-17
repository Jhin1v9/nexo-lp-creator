const { chromium } = require('playwright');
const path = require('path');

const CDP_URL = process.env.KIMI_CDP_URL || 'http://127.0.0.1:9226';
const SCREENSHOT_DIR = process.env.NEXO_SCREENSHOT_DIR || path.join(__dirname, '..', 'data', 'screenshots');

async function main() {
  const browser = await chromium.connectOverCDP(CDP_URL);

  try {
    const contexts = browser.contexts();
    console.log(`Contexts: ${contexts.length}`);

    for (let ci = 0; ci < contexts.length; ci++) {
      const ctx = contexts[ci];
      const pages = ctx.pages();
      console.log(`Context ${ci}: ${pages.length} pages`);
      for (let pi = 0; pi < pages.length; pi++) {
        const p = pages[pi];
        const url = p.url();
        const title = await p.title().catch(() => 'no title');
        console.log(`  [${ci}:${pi}] ${url} | ${title}`);
        if (url.includes('kimi.com')) {
          const inputCount = await p.locator('textarea, [contenteditable="true"]').count().catch(() => 0);
          const assistantCount = await p.evaluate(() => document.querySelectorAll('.segment-assistant').length).catch(() => 0);
          const lastAssistantText = await p.evaluate(() => {
            const nodes = document.querySelectorAll('.segment-assistant');
            const last = nodes[nodes.length - 1];
            return last ? last.innerText?.slice(0, 500) : null;
          }).catch(() => null);
          const bodyText = await p.evaluate(() => document.body.innerText?.slice(0, 800)).catch(() => null);
          console.log(`    inputCount=${inputCount}, assistantCount=${assistantCount}`);
          console.log(`    lastAssistantText=${JSON.stringify(lastAssistantText)}`);
          console.log(`    bodyText=${JSON.stringify(bodyText)}`);
          // screenshot
          const ssPath = path.join(SCREENSHOT_DIR, `debug-kimi-${ci}-${pi}.png`);
          await p.screenshot({ path: ssPath, fullPage: true }).catch((e) => console.log(`    screenshot failed: ${e.message}`));
          console.log(`    screenshot: ${ssPath}`);
        }
      }
    }
  } finally {
    await browser.close().catch((e) => console.error('Failed to close browser:', e.message));
  }
}

main().catch(e => { console.error(e); process.exit(1); });
