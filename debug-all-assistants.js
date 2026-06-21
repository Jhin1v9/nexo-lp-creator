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
    const assistants = Array.from(document.querySelectorAll('.segment-assistant'));
    return assistants.map((el, i) => {
      const codes = Array.from(el.querySelectorAll('.segment-code pre')).map(pre => pre.innerText);
      const texts = Array.from(el.querySelectorAll('.markdown-container')).map(md => md.innerText.slice(0, 200));
      return { index: i, textLen: el.innerText.length, codesCount: codes.length, codesLengths: codes.map(c => c.length), texts };
    });
  });
  console.log(JSON.stringify(data, null, 2));
  await browser.close();
})().catch(err => { console.error(err); process.exit(1); });
