const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9226');
  const context = browser.contexts()[0];
  const p = context.pages()[0];
  const input = p.locator('.chat-input-editor');
  await input.click();
  await input.fill('Diga apenas "olá"');
  await input.press('Enter');
  await new Promise(r => setTimeout(r, 15000));
  const info = await p.evaluate(() => {
    const msgList = document.querySelector('.message-list');
    return {
      url: location.href,
      messageCount: msgList ? msgList.children.length : 0,
      firstMessageHTML: msgList?.children[0]?.outerHTML?.slice(0, 2000) || null,
    };
  });
  console.log(JSON.stringify(info, null, 2));
  await browser.close();
})();
