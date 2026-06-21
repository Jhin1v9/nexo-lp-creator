const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
  const context = browser.contexts()[0];
  const pages = context.pages();
  const p = pages.find(x => x.url().includes('kimi.com')) || pages[0];
  console.log('URL:', p.url());
  const data = await p.evaluate(() => {
    const items = Array.from(document.querySelectorAll('.message-list > *')).map((el, i) => {
      const text = el.innerText || '';
      return { i, tag: el.tagName, class: el.className.slice(0,100), textStart: text.slice(0,300), textLen: text.length };
    });
    return { items };
  });
  console.log(JSON.stringify(data, null, 2));
  await browser.close();
})();
