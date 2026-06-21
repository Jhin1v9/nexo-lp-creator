const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9226');
  const context = browser.contexts()[0];
  const p = context.pages()[0];
  console.log('before send URL:', p.url());
  // Fill using the bridge's own method: focus, set innerHTML, dispatch input
  await p.evaluate((text) => {
    const editor = document.querySelector('.chat-input-editor');
    if (!editor) return 'no editor';
    editor.focus();
    editor.innerHTML = '<p dir="ltr"><span data-lexical-text="true">' + text.replace(/</g, '&lt;') + '</span></p>';
    editor.dispatchEvent(new InputEvent('input', { bubbles: true, data: text }));
    editor.dispatchEvent(new Event('change', { bubbles: true }));
    return 'filled';
  }, 'Diga apenas "olá"');
  await new Promise(r => setTimeout(r, 500));
  // Click send
  await p.click('.send-button-container:not(.disabled)').catch(e => console.log('click err', e.message));
  // Wait for response
  await new Promise(r => setTimeout(r, 15000));
  const info = await p.evaluate(() => {
    const msgList = document.querySelector('.message-list');
    const messages = msgList ? Array.from(msgList.children).map((el, i) => ({
      index: i,
      tag: el.tagName,
      class: el.className,
      html: el.outerHTML.slice(0, 1500),
      text: el.innerText.slice(0, 300),
    })) : [];
    return {
      url: location.href,
      messageCount: messages.length,
      messages,
    };
  });
  console.log(JSON.stringify(info, null, 2));
  await browser.close();
})();
