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

      const bigText = 'Please summarize this html:\n' + '<div>'.repeat(1000) + 'hello' + '</div>'.repeat(1000);

      const inputLocator = page.locator('textarea, [contenteditable="true"]').first();
      await inputLocator.evaluate((el) => el.focus());
      await inputLocator.fill('');
      await page.waitForTimeout(300);

      // Use fill for big text
      await inputLocator.fill(bigText);
      await page.waitForTimeout(300);

      // Dispatch events
      await inputLocator.evaluate((el) => {
        const data = el.value || el.innerText || '';
        el.dispatchEvent(new InputEvent('input', { bubbles: true, data }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      });
      await page.waitForTimeout(1000);

      const sendBtn = page.locator('.send-button-container').first();
      const isEnabled = await sendBtn.evaluate((el) => !el.disabled).catch(() => false);
      console.log('Send button enabled:', isEnabled);

      if (isEnabled) {
        await sendBtn.click();
      } else {
        await inputLocator.press('Enter');
      }

      await page.waitForTimeout(2000);
      console.log('After wait URL:', page.url());

      await page.waitForURL(/\/chat\//, { timeout: 10000 });
      console.log('SUCCESS:', page.url());
    } catch (e) {
      console.log('FAILED:', e.message);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'test-send-landing-fill-fail.png'), fullPage: true });
      throw e;
    }
  } finally {
    await browser.close().catch((e) => console.error('Failed to close browser:', e.message));
  }
}

main().catch(e => { console.error(e); process.exit(1); });
