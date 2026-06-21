const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9226');
  const context = browser.contexts()[0];
  const p = context.pages()[0];
  console.log('URL:', p.url());
  // Send a simple message
  await p.evaluate(() => {
    const editor = document.querySelector('.chat-input-editor');
    if (editor) {
      editor.innerHTML = '<p><span data-lexical-text="true">hello</span></p>';
      editor.dispatchEvent(new InputEvent('input', { bubbles: true }));
    }
  });
  await p.click('.send-button-container:not(.disabled)').catch(() => {});
  await p.press('.chat-input-editor', 'Enter').catch(() => {});
  await new Promise(r => setTimeout(r, 12000));
  const info = await p.evaluate(() => {
    const msgList = document.querySelector('.message-list');
    const messages = msgList ? Array.from(msgList.children).map((el, i) => ({
      index: i,
      tag: el.tagName,
      class: el.className,
      html: el.outerHTML.slice(0, 1000),
      text: el.innerText.slice(0, 200),
    })) : [];
    return { messageCount: messages.length, messages };
  });
  console.log(JSON.stringify(info, null, 2));
  await browser.close();
})();
