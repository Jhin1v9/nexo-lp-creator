const { chromium } = require('playwright-core');

(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
  const context = browser.contexts()[0] || await browser.newContext();
  const page = await context.newPage();
  await page.goto('https://www.kimi.com/chat/19ee4497-43e2-8d85-8000-092fc5c2063d?chat_enter_method=new_chat', { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(3000);
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(1000);
  const data = await page.evaluate(() => {
    const result = [];
    const assistants = Array.from(document.querySelectorAll('.segment-assistant, [class*="assistant"]'));
    assistants.slice(-6).forEach((el, idx) => {
      const mds = Array.from(el.querySelectorAll('.markdown-container'));
      result.push({
        assistantIndex: idx,
        mdCount: mds.length,
        mds: mds.map((md, i) => ({
          index: i,
          text: md.innerText.slice(0, 200),
          html: md.outerHTML.slice(0, 300),
          className: md.className,
        })),
      });
    });
    return result;
  });
  console.log(JSON.stringify(data, null, 2));
  await page.screenshot({ path: '/home/jhin/luna/nexo-lp-creator/debug-dom.png', fullPage: false });
  await browser.close();
})().catch(err => { console.error(err); process.exit(1); });
