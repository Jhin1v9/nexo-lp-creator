const { chromium } = require('playwright-core');
(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
  const context = browser.contexts()[0] || await browser.newContext();
  const page = await context.newPage();
  await page.goto('chrome://extensions', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(2000);
  console.log('title:', await page.title());
  const list = await page.evaluate(() => {
    const items = Array.from(document.querySelectorAll('extensions-item'));
    return items.map(el => ({
      name: el.name || el.getAttribute('name'),
      id: el.id,
      state: el.state,
    }));
  });
  console.log(JSON.stringify(list, null, 2));
  await page.screenshot({ path: '/home/jhin/luna/nexo-lp-creator/debug-ext.png', fullPage: false });
  await browser.close();
})().catch(err => { console.error(err); process.exit(1); });
