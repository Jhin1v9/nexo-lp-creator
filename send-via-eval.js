const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9226');
  const context = browser.contexts()[0];
  const p = context.pages()[0];
  await p.evaluate(() => {
    const editor = document.querySelector('.chat-input-editor');
    if (editor) {
      editor.focus();
      document.execCommand('selectAll', false, null);
      document.execCommand('insertText', false, 'Diga apenas "olá"');
      editor.dispatchEvent(new InputEvent('input', { bubbles: true }));
      editor.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true, cancelable: true }));
      editor.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true, cancelable: true }));
    }
  });
  await new Promise(r => setTimeout(r, 15000));
  const info = await p.evaluate(() => {
    const msgList = document.querySelector('.message-list');
    const messages = msgList ? Array.from(msgList.children).map((el, i) => ({
      index: i,
      tag: el.tagName,
      class: el.className,
      html: el.outerHTML.slice(0, 2500),
      text: el.innerText.slice(0, 400),
    })) : [];
    return { url: location.href, messageCount: messages.length, messages };
  });
  console.log(JSON.stringify(info, null, 2));
  await browser.close();
})();
