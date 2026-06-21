const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9226');
  const context = browser.contexts()[0];
  const p = context.pages()[0];
  const info = await p.evaluate(() => {
    const editor = document.querySelector('.chat-input-editor');
    const sendBtn = document.querySelector('.send-button-container');
    return {
      editorText: editor?.innerText,
      sendDisabled: sendBtn?.classList.contains('disabled'),
      sendHTML: sendBtn?.outerHTML?.slice(0, 300),
      editorFocused: document.activeElement === editor,
    };
  });
  console.log(JSON.stringify(info, null, 2));
  await browser.close();
})();
