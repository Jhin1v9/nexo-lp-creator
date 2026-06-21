const { chromium } = require('playwright-core');
(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
  const context = browser.contexts()[0] || await browser.newContext();
  const page = await context.newPage();
  await page.goto('https://www.kimi.com/features/webbridge', { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(3000);
  console.log('title:', await page.title());
  console.log('url:', page.url());
  await page.screenshot({ path: '/home/jhin/luna/nexo-lp-creator/debug-webbridge.png', fullPage: false });
  await browser.close();
})().catch(err => { console.error(err); process.exit(1); });
