const { chromium } = require('playwright-core');
(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
  const contexts = browser.contexts();
  for (const ctx of contexts) {
    for (const page of ctx.pages()) {
      const url = page.url();
      const title = await page.title().catch(() => 'no title');
      console.log(url, '|', title);
    }
  }
  await browser.close();
})().catch(err => { console.error(err); process.exit(1); });
