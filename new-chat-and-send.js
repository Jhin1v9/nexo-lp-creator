const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9226');
  const context = browser.contexts()[0];
  const p = context.pages()[0];
  await p.evaluate(() => {
    // Click sidebar new chat
    const btn = document.querySelector('.sidebar-new-chat, .new-chat-btn, [class*="new-chat"]');
    if (btn) btn.click();
  });
  await new Promise(r => setTimeout(r, 2000));
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
  // Try clicking send button specifically
  await p.evaluate(() => {
    const sendBtn = document.querySelector('.send-button-container');
    if (sendBtn) sendBtn.click();
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
