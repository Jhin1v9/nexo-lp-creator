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
    const segments = Array.from(document.querySelectorAll('.segment'));
    return segments.map((el, i) => {
      const isUser = el.classList.contains('segment-user');
      const code = el.querySelector('.segment-code pre');
      const text = el.querySelector('.segment-content-box')?.innerText || el.innerText;
      return {
        index: i,
        role: isUser ? 'user' : 'assistant',
        textLen: text.length,
        hasCode: !!code,
        codeLang: el.querySelector('.segment-code-lang')?.innerText || '',
        codeLen: code ? code.innerText.length : 0,
        textPreview: text.slice(0, 150).replace(/\n/g, ' '),
      };
    });
  });
  console.log(JSON.stringify(data, null, 2));
  await browser.close();
})().catch(err => { console.error(err); process.exit(1); });
