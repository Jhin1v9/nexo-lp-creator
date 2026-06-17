const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9226');
  const context = browser.contexts()[0];
  const pages = context.pages();
  const page = pages.find(p => p.url().includes('kimi.com')) || pages[0];

  const info = await page.evaluate(() => {
    const items = Array.from(document.querySelectorAll('[class*="chat-content-item"], [class*="segment-"], [class*="message-content"], [class*="message-assistant"], [class*="message-user"]'));
    const lastItems = items.slice(-6).map(el => ({
      tag: el.tagName,
      className: el.className,
      dataTestid: el.getAttribute('data-testid'),
      textPreview: (el.innerText || '').substring(0, 200).replace(/\n/g, ' ')
    }));

    const allClasses = new Set();
    document.querySelectorAll('*').forEach(el => {
      if (el.className && typeof el.className === 'string') {
        el.className.split(/\s+/).forEach(c => {
          if (c.includes('chat') || c.includes('message') || c.includes('segment') || c.includes('content-item')) allClasses.add(c);
        });
      }
    });

    return {
      url: window.location.href,
      relevantClasses: Array.from(allClasses).sort(),
      lastItems
    };
  });
  console.log(JSON.stringify(info, null, 2));

  await browser.close();
})();
