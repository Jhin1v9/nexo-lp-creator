const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9226');
  const context = browser.contexts()[0];
  const p = context.pages()[0];
  await p.goto('https://www.kimi.com/?chat_enter_method=new_chat&lang=en', { waitUntil: 'domcontentloaded' });
  await new Promise(r => setTimeout(r, 3000));
  await context.clearCookies();
  await p.evaluate(() => localStorage.clear());
  await p.reload({ waitUntil: 'domcontentloaded' });
  await new Promise(r => setTimeout(r, 3000));
  const info = await p.evaluate(() => ({
    url: location.href,
    editorText: document.querySelector('.chat-input-editor')?.innerText?.slice(0, 200),
    sendDisabled: document.querySelector('.send-button-container')?.classList.contains('disabled'),
  }));
  console.log(JSON.stringify(info, null, 2));
  await browser.close();
})();
