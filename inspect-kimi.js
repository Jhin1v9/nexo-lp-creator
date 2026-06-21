const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9226');
  const context = browser.contexts()[0];
  const p = context.pages()[0];
  const url = p.url();
  const title = await p.title();
  const html = await p.content();
  // Save full page screenshot
  await p.screenshot({ path: 'kimi-state.png', fullPage: true });
  // Extract visible overlay/login info
  const info = await p.evaluate(() => {
    const overlays = Array.from(document.querySelectorAll('div, section, dialog'))
      .filter(el => {
        const rect = el.getBoundingClientRect();
        const style = window.getComputedStyle(el);
        return rect.width > 200 && rect.height > 100 && (style.zIndex !== 'auto' && parseInt(style.zIndex,10) > 0) && style.display !== 'none';
      })
      .map(el => ({ tag: el.tagName, class: el.className, zIndex: window.getComputedStyle(el).zIndex, text: el.innerText?.slice(0,200) }));
    const login = Array.from(document.querySelectorAll('h1, h2, button, input')).map(el => ({ tag: el.tagName, class: el.className, text: el.innerText?.slice(0,100), placeholder: el.placeholder }));
    return { url: location.href, overlays: overlays.slice(0,10), loginElements: login.filter(x => /log ?in|phone|验证码|登录|sign/i.test(x.text || x.placeholder || '')).slice(0,20) };
  });
  console.log(JSON.stringify({ url, title, info }, null, 2));
  await require('fs').promises.writeFile('kimi-state.html', html);
  await browser.close();
})();
