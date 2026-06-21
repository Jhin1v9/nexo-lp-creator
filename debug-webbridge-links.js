const { chromium } = require('playwright-core');
(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
  const context = browser.contexts()[0] || await browser.newContext();
  const page = await context.newPage();
  await page.goto('https://www.kimi.com/features/webbridge', { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(2000);
  const links = await page.evaluate(() => Array.from(document.querySelectorAll('a[href]')).map(a => ({ text: a.innerText.trim(), href: a.href })));
  console.log(JSON.stringify(links, null, 2));
  await browser.close();
})().catch(err => { console.error(err); process.exit(1); });
