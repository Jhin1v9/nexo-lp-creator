const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
  const context = browser.contexts()[0];
  const pages = context.pages();
  console.log('pages:', pages.length);
  for (const p of pages) {
    const url = p.url();
    const title = await p.title().catch(() => '');
    console.log(url, '|', title);
    if (url.includes('kimi.com')) {
      const info = await p.evaluate(() => {
        const modal = document.querySelector('.login-modal-mask');
        return { hasLoginModal: !!modal, url: location.href, bodyTextStart: document.body.innerText.slice(0,300) };
      });
      console.log('Kimi page info:', info);
      await p.screenshot({ path: 'kimi-9222.png', fullPage: true });
    }
  }
  await browser.close();
})();
