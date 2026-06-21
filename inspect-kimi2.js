const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9226');
  const context = browser.contexts()[0];
  const p = context.pages()[0];
  console.log('URL:', p.url());
  const info = await p.evaluate(() => {
    const msgList = document.querySelector('.message-list');
    const chatBox = document.querySelector('.chat-box');
    const editor = document.querySelector('.chat-input-editor');
    const sendBtn = document.querySelector('.chat-editor-action button, [class*="send"]');
    return {
      messageListHTML: msgList?.outerHTML?.slice(0, 2000) || null,
      chatBoxHTML: chatBox?.outerHTML?.slice(0, 2000) || null,
      editorTag: editor?.tagName,
      editorContent: editor?.innerHTML?.slice(0, 500) || null,
      sendBtnHTML: sendBtn?.outerHTML?.slice(0, 300) || null,
      messageItems: Array.from(document.querySelectorAll('.message-list > *, .chat-box > *')).map(el => ({
        tag: el.tagName,
        class: el.className,
        html: el.outerHTML.slice(0, 300),
      })).slice(0, 10),
    };
  }).catch(e => ({ error: e.message }));
  console.log(JSON.stringify(info, null, 2));
  await browser.close();
})();
