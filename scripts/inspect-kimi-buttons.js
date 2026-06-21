#!/usr/bin/env node
process.env.NODE_ENV = process.env.NODE_ENV || 'production';
const { chromium } = require('playwright');

async function main() {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
  const context = browser.contexts()[0];
  const pages = context.pages();
  console.log('Pages:', pages.length);
  for (let i = 0; i < pages.length; i++) {
    const p = pages[i];
    const url = p.url();
    console.log(`Page ${i}: ${url}`);
    const buttons = await p.evaluate(() => {
      const all = Array.from(document.querySelectorAll('button, [role="button"], a'));
      return all
        .filter((el) => {
          const text = (el.textContent || '').trim();
          return text.length > 0 && text.length < 200;
        })
        .map((el) => ({
          tag: el.tagName,
          text: (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 120),
          className: el.className,
          id: el.id,
          ariaLabel: el.getAttribute('aria-label'),
          rect: el.getBoundingClientRect ? {
            x: el.getBoundingClientRect().x,
            y: el.getBoundingClientRect().y,
            width: el.getBoundingClientRect().width,
            height: el.getBoundingClientRect().height,
          } : null,
        }));
    });
    console.log(`Buttons on page ${i}:`, JSON.stringify(buttons, null, 2));
  }
  await browser.disconnect();
}

main().catch((err) => { console.error(err); process.exit(1); });
