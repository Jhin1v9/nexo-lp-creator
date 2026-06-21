const { chromium } = require('playwright-core');
(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
  const context = browser.contexts()[0] || await browser.newContext();
  const page = await context.newPage();
  await page.goto('https://www.kimi.com/chat/19ee4497-43e2-8d85-8000-092fc5c2063d?chat_enter_method=new_chat', { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(3000);
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(1000);
  const html = await page.evaluate(() => {
    const assistants = Array.from(document.querySelectorAll('.segment-assistant'));
    const last = assistants[assistants.length - 1];
    if (!last) return '';
    const code = last.querySelector('.segment-code');
    if (code) {
      const pre = code.querySelector('pre');
      return pre ? pre.innerText : code.innerText;
    }
    return last.innerText;
  });
  console.log('length:', html.length);
  console.log('start:', html.slice(0, 200));
  console.log('end:', html.slice(-200));
  fs = require('fs');
  fs.writeFileSync('/home/jhin/luna/nexo-lp-creator/debug-last-html.html', html);
  await browser.close();
})().catch(err => { console.error(err); process.exit(1); });
