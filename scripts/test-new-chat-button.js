const { chromium } = require('playwright');
const path = require('path');

const CDP_URL = process.env.KIMI_CDP_URL || 'http://127.0.0.1:9226';
const SCREENSHOT_DIR = process.env.NEXO_SCREENSHOT_DIR || path.join(__dirname, '..', 'data', 'screenshots');

async function main() {
  const browser = await chromium.connectOverCDP(CDP_URL);

  try {
    const contexts = browser.contexts();
    if (contexts.length === 0) {
      throw new Error('No browser contexts available');
    }
    const ctx = contexts[0];
    const page = await ctx.newPage();

    try {
      await page.goto('https://www.kimi.com/?chat_enter_method=new_chat&lang=en', { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(2500);

      console.log('Initial URL:', page.url());

      // Try clicking sidebar New Chat
      const clicked = await page.evaluate(() => {
        const newChatTexts = ['New Chat', 'Novo Chat', '新建对话', '新對話', 'New conversation'];
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        let node;
        while ((node = walker.nextNode())) {
          const trimmed = node.textContent.trim();
          if (newChatTexts.some(t => trimmed === t || trimmed.includes(t))) {
            console.log('Found text:', trimmed, 'parent:', node.parentElement?.tagName, node.parentElement?.className);
            let el = node.parentElement;
            for (let i = 0; i < 8 && el; i++) {
              console.log('  checking', el.tagName, el.className, el.getAttribute('role'), el.onclick ? 'has onclick' : 'no onclick');
              if (el.tagName === 'BUTTON' || el.getAttribute('role') === 'button' || el.onclick || window.getComputedStyle(el).cursor === 'pointer') {
                el.click();
                return { clicked: true, text: trimmed, tag: el.tagName, className: el.className };
              }
              el = el.parentElement;
            }
          }
        }
        return { clicked: false };
      });
      console.log('Click result:', clicked);

      // Wait for URL change
      await page.waitForURL(/\/chat\//, { timeout: 10000 });
      console.log('SUCCESS: real chat URL');
      await page.waitForTimeout(2000);
      const inputCount = await page.locator('textarea, [contenteditable="true"]').count();
      console.log('inputCount:', inputCount);
    } catch (e) {
      console.log('FAILED:', e.message);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'test-new-chat-fail.png'), fullPage: true });
      throw e;
    }
  } finally {
    await browser.close().catch((e) => console.error('Failed to close browser:', e.message));
  }
}

main().catch(e => { console.error(e); process.exit(1); });
