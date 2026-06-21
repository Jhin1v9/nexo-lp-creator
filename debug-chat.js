const { chromium } = require('playwright-core');

(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
  const context = browser.contexts()[0] || await browser.newContext();
  const page = await context.newPage();
  await page.goto('https://www.kimi.com/chat/19ee4497-43e2-8d85-8000-092fc5c2063d?chat_enter_method=new_chat', { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(5000);
  const title = await page.title();
  const url = page.url();
  // Scroll to bottom
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(2000);
  await page.screenshot({ path: '/home/jhin/luna/nexo-lp-creator/debug-chat.png', fullPage: false });
  // Extract visible text of last assistant messages
  const texts = await page.evaluate(() => {
    const containers = Array.from(document.querySelectorAll('.markdown-container'));
    return containers.slice(-6).map((el, i) => ({
      index: i,
      text: el.innerText.slice(0, 300),
      htmlPresent: el.innerText.includes('<!DOCTYPE') || el.innerText.includes('<html'),
    }));
  });
  console.log(JSON.stringify({ title, url, texts }, null, 2));
  await browser.disconnect();
})().catch(err => { console.error(err); process.exit(1); });
