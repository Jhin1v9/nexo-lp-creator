const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9226');
  const context = browser.contexts()[0];
  const p = context.pages()[0];
  console.log('URL:', p.url());
  const requests = [];
  p.on('request', req => {
    const url = req.url();
    if (/kimi|moonshot|chat|completion/i.test(url)) {
      requests.push({ type: 'req', url, method: req.method() });
    }
  });
  p.on('response', resp => {
    const url = resp.url();
    if (/kimi|moonshot|chat|completion/i.test(url)) {
      requests.push({ type: 'resp', url, status: resp.status() });
    }
  });
  await p.evaluate(() => {
    const editor = document.querySelector('.chat-input-editor');
    if (editor) {
      editor.innerHTML = '<p><span data-lexical-text="true">test message</span></p>';
      editor.dispatchEvent(new InputEvent('input', { bubbles: true }));
    }
  });
  await p.click('.send-button-container:not(.disabled)').catch(() => {});
  await p.press('.chat-input-editor', 'Enter').catch(() => {});
  await new Promise(r => setTimeout(r, 15000));
  console.log('Captured requests:', requests.length);
  for (const r of requests.slice(0, 30)) console.log(JSON.stringify(r));
  await browser.close();
})();
