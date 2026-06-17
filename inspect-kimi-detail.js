const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9226');
  const context = browser.contexts()[0];
  const pages = context.pages();
  const page = pages.find(p => p.url().includes('kimi.com')) || pages[0];

  const info = await page.evaluate(() => {
    const assistants = Array.from(document.querySelectorAll('.segment-assistant'));
    const lastAssistant = assistants[assistants.length - 1];
    if (!lastAssistant) return { error: 'no assistant found' };

    const extract = (el, depth = 0) => {
      if (!el || depth > 6) return null;
      return {
        tag: el.tagName,
        className: el.className,
        dataTestid: el.getAttribute('data-testid'),
        text: (el.innerText || '').substring(0, 400).replace(/\n/g, '\\n'),
        children: Array.from(el.children).slice(0, 8).map(c => extract(c, depth + 1))
      };
    };

    const codeBlocks = Array.from(lastAssistant.querySelectorAll('pre code, .segment-code, .segment-code-content, [class*="code-block"]')).map(el => ({
      className: el.className,
      text: (el.innerText || '').substring(0, 800).replace(/\n/g, '\\n')
    }));

    return {
      url: window.location.href,
      assistantCount: assistants.length,
      lastAssistantTree: extract(lastAssistant, 0),
      codeBlocks
    };
  });
  console.log(JSON.stringify(info, null, 2));

  await browser.close();
})();
