const { chromium } = require('playwright');

const CDP_URL = process.env.KIMI_CDP_URL || 'http://127.0.0.1:9226';

async function main() {
  const browser = await chromium.connectOverCDP(CDP_URL);
  const contexts = browser.contexts();
  if (contexts.length === 0) {
    console.log('No contexts found');
    await browser.close();
    return;
  }

  const ctx = contexts[0];
  const pages = ctx.pages().filter(p => !p.isClosed() && p.url().includes('kimi.com'));
  if (pages.length === 0) {
    console.log('No Kimi pages found');
    await browser.close();
    return;
  }

  // Pick the most recently active real chat page, or any Kimi page.
  const target = pages.find(p => p.url().includes('/chat/')) || pages[pages.length - 1];
  console.log(`Bringing to front: ${target.url()}`);

  await target.bringToFront();
  // Attempt to maximize viewport via CDP Page command.
  const cdpSession = await target.context().newCDPSession(target).catch(() => null);
  if (cdpSession) {
    try {
      const { windowId } = await cdpSession.send('Browser.getWindowForTarget');
      await cdpSession.send('Browser.setWindowBounds', {
        windowId,
        bounds: { windowState: 'normal' },
      });
      await cdpSession.send('Browser.setWindowBounds', {
        windowId,
        bounds: { windowState: 'maximized' },
      });
      console.log('Window maximized');
    } catch (e) {
      console.log('Could not maximize window via CDP:', e.message);
    } finally {
      await cdpSession.detach().catch(() => {});
    }
  }

  await browser.close();
}

main().catch(e => { console.error(e); process.exit(1); });
