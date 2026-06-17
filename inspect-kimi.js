const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
  const contexts = browser.contexts();
  if (!contexts.length) {
    console.log(JSON.stringify({ error: 'no contexts' }));
    await browser.close();
    return;
  }
  const ctx = contexts[0];
  const pages = ctx.pages();
  const kimiPage = pages.find(p => p.url().includes('kimi.com/chat/19ed151a'));
  if (!kimiPage) {
    console.log(JSON.stringify({ error: 'kimi page not found', urls: pages.map(p => p.url()) }));
    await browser.close();
    return;
  }
  const title = await kimiPage.title();
  const text = await kimiPage.evaluate(() => document.body.innerText);
  console.log(JSON.stringify({ 
    title, 
    textLength: text.length, 
    textStart: text.slice(0, 600),
    textEnd: text.slice(-1200)
  }, null, 2));
  await browser.close();
})();
