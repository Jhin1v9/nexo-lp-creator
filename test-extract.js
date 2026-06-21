const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
  const context = browser.contexts()[0];
  const p = context.pages()[0];
  // capture pre snapshot
  const pre = await p.evaluate(() => Array.from(document.querySelectorAll('.segment-assistant')).map(el => {
    const box = el.querySelector('.segment-content-box');
    return box ? box.innerText : '';
  }));
  console.log('pre assistants', pre.length);
  // send a simple message
  const input = p.locator('.chat-input-editor');
  await input.fill('Responda apenas com a palavra CONFIRMADO em maiúsculas.');
  await input.press('Enter');
  // wait for response
  await p.waitForTimeout(15000);
  const post = await p.evaluate(() => Array.from(document.querySelectorAll('.segment-assistant')).map(el => {
    const box = el.querySelector('.segment-content-box');
    return box ? box.innerText : '';
  }));
  console.log('post assistants', post.length);
  // diff
  for (let i = pre.length; i < post.length; i++) {
    console.log(`NEW ASSISTANT ${i} len=${post[i].length} start=${post[i].slice(0,200)}`);
  }
  // last assistant
  console.log('LAST start', post[post.length-1]?.slice(0,200));
  await browser.close();
})();
