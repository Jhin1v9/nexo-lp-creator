const { chromium } = require('playwright-core');
(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
  const context = browser.contexts()[0] || await browser.newContext();
  const page = await context.newPage();
  await page.goto('https://www.kimi.com/chat/19ee45e2-45b2-8a72-8000-092f0c986a3b?chat_enter_method=new_chat', { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(3000);
  const info = await page.evaluate(() => {
    const all = Array.from(document.querySelectorAll('[class*="segment"]')).map(el => ({
      tag: el.tagName,
      className: el.className,
      text: el.innerText.slice(0, 100),
    }));
    return all.slice(0, 30);
  });
  console.log(JSON.stringify(info, null, 2));
  await browser.close();
})().catch(err => { console.error(err); process.exit(1); });
