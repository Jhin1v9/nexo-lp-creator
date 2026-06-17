const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9226');
  const context = browser.contexts()[0];
  const pages = context.pages();
  const page = pages.find(p => p.url().includes('5173')) || pages[0];
  console.log('Using page:', page.url());

  await page.bringToFront();
  await page.waitForTimeout(2000);

  // Find input
  const input = page.locator('textarea, [contenteditable="true"]').first();
  await input.fill('site de pao de queijo artesanal');
  console.log('Input filled');

  // Press Enter
  await input.press('Enter');
  console.log('Enter pressed');

  // Wait for generation
  await page.waitForTimeout(10000);

  // Take screenshot
  await page.screenshot({ path: '/home/jhin/luna/nexo-lp-creator/frontend-after-send.png' });
  console.log('Screenshot saved');

  await browser.disconnect().catch(() => {});
})();
