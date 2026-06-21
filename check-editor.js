const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9226');
  const context = browser.contexts()[0];
  const p = context.pages()[0];
  const info = await p.evaluate(() => ({
    url: location.href,
    editorText: document.querySelector('.chat-input-editor')?.innerText,
    sendDisabled: document.querySelector('.send-button-container')?.classList.contains('disabled'),
    sendClass: document.querySelector('.send-button-container')?.className,
  }));
  console.log(JSON.stringify(info, null, 2));
  await browser.close();
})();
