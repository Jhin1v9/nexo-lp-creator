const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9226');
  const context = browser.contexts()[0];
  const p = context.pages()[0];
  console.log('URL:', p.url());
  p.on('response', async resp => {
    const url = resp.url();
    if (url.includes('ChatService/Chat')) {
      console.log('Chat response:', resp.status(), url);
      try {
        const body = await resp.body();
        const text = body.toString('utf8').slice(0, 500);
        console.log('Body preview:', text);
      } catch (e) {
        console.log('Body error:', e.message);
      }
    }
  });
  await p.evaluate(() => {
    const editor = document.querySelector('.chat-input-editor');
    if (editor) {
      editor.innerHTML = '<p><span data-lexical-text="true">test message 2</span></p>';
      editor.dispatchEvent(new InputEvent('input', { bubbles: true }));
    }
  });
  await p.click('.send-button-container:not(.disabled)').catch(() => {});
  await p.press('.chat-input-editor', 'Enter').catch(() => {});
  await new Promise(r => setTimeout(r, 15000));
  await browser.close();
})();
