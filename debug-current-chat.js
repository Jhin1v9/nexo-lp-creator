const { chromium } = require('playwright-core');
(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
  const context = browser.contexts()[0] || await browser.newContext();
  const page = await context.newPage();
  await page.goto('https://www.kimi.com/chat/19ee45e2-45b2-8a72-8000-092f0c986a3b?chat_enter_method=new_chat', { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(3000);
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(1000);
  const data = await page.evaluate(() => {
    const userMsgs = Array.from(document.querySelectorAll('.segment-user, [class*="segment-user"]'));
    const assistantMsgs = Array.from(document.querySelectorAll('.segment-assistant, [class*="segment-assistant"]'));
    return {
      userCount: userMsgs.length,
      assistantCount: assistantMsgs.length,
      users: userMsgs.slice(-8).map((el, i) => ({
        index: i,
        text: el.innerText.slice(0, 300),
      })),
      assistants: assistantMsgs.slice(-8).map((el, i) => {
        const code = el.querySelector('.segment-code pre');
        return {
          index: i,
          textLen: el.innerText.length,
          hasCode: !!code,
          codeLen: code ? code.innerText.length : 0,
          text: el.innerText.slice(0, 200),
        };
      }),
    };
  });
  console.log(JSON.stringify(data, null, 2));
  await browser.close();
})().catch(err => { console.error(err); process.exit(1); });
