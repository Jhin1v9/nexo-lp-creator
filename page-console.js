const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9226');
  const context = browser.contexts()[0];
  const p = context.pages()[0];
  const logs = [];
  p.on('console', msg => logs.push({ type: msg.type(), text: msg.text() }));
  p.on('pageerror', err => logs.push({ type: 'pageerror', text: err.message }));
  await p.evaluate(() => {
    const editor = document.querySelector('.chat-input-editor');
    if (editor) {
      editor.focus();
      document.execCommand('selectAll', false, null);
      document.execCommand('insertText', false, 'Diga apenas "olá"');
      editor.dispatchEvent(new InputEvent('input', { bubbles: true }));
    }
  });
  await new Promise(r => setTimeout(r, 500));
  await p.evaluate(() => document.querySelector('.send-button-container')?.click());
  await new Promise(r => setTimeout(r, 5000));
  console.log(JSON.stringify(logs.slice(0, 30), null, 2));
  await browser.close();
})();
