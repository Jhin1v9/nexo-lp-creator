/**
 * E2E test: create a landing page through the NEXO LP Creator frontend.
 * Runs in a visible browser so the user can watch the flow.
 * The backend should be running with Luna bridge enabled for the real Chrome experience.
 */
const { chromium } = require('playwright');

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
const API_URL = process.env.API_URL || 'http://localhost:3460/api/nexo-lp';
const NO_KEEP_OPEN = process.env.NO_KEEP_OPEN === '1';

async function waitForBackend() {
  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch(`${API_URL}/health`);
      if (res.ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error('Backend not healthy');
}

async function main() {
  await waitForBackend();

  console.log(`Opening visible browser at ${FRONTEND_URL}`);
  const browser = await chromium.launch({
    headless: false,
    slowMo: 300,
    args: ['--disable-blink-features=AutomationControlled'],
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });

  const page = await context.newPage();

  // Capture console errors
  const consoleErrors = [];
  page.on('console', (msg) => {
    const type = msg.type();
    if (type === 'error') {
      consoleErrors.push(msg.text());
      console.log('[PAGE ERROR]', msg.text());
    }
  });

  page.on('pageerror', (err) => {
    consoleErrors.push(err.message);
    console.log('[PAGE EXCEPTION]', err.message);
  });

  try {
    await page.goto(FRONTEND_URL, { waitUntil: 'networkidle' });
    console.log('Frontend loaded');

    // Wait for the chat input
    const textarea = page.locator('textarea[placeholder*="Describe the landing page"]').first();
    await textarea.waitFor({ state: 'visible', timeout: 15000 });

    // Type prompt
    const prompt = 'Create a SaaS hero landing page with a pricing section';
    await textarea.fill(prompt);
    console.log('Prompt filled');

    // Send with Enter (more reliable than button selector)
    await textarea.press('Enter');
    console.log('Enter pressed, message sent');

    // Wait for generation to complete.
    // The frontend auto-switches to Preview tab and shows a notification when done.
    // We poll until the iframe appears in the Preview tab or a timeout.
    console.log('Waiting for generation to complete...');

    // Wait up to 5 minutes for Luna real generation, or 30s for mock
    const maxWait = 5 * 60 * 1000;
    const pollInterval = 1000;
    const start = Date.now();
    let previewVisible = false;

    while (Date.now() - start < maxWait) {
      // Try to switch to Preview tab and look for the iframe
      const previewTab = page.getByRole('button', { name: /Preview/i }).first();
      if (await previewTab.isVisible().catch(() => false)) {
        await previewTab.click();
      }

      const iframe = page.locator('iframe').first();
      if (await iframe.isVisible().catch(() => false)) {
        try {
          const frame = await iframe.contentFrame();
          const body = await frame.$('body');
          if (body) {
            const text = await body.textContent();
            if (text && text.length > 50) {
              previewVisible = true;
              console.log('Preview loaded with content');
              break;
            }
          }
        } catch {
          // iframe not ready yet
        }
      }

      await new Promise((r) => setTimeout(r, pollInterval));
    }

    if (!previewVisible) {
      throw new Error('Preview did not appear within timeout');
    }

    // Take screenshot
    await page.screenshot({ path: '/tmp/nexo-lp-e2e-result.png', fullPage: false });
    console.log('Screenshot saved to /tmp/nexo-lp-e2e-result.png');

    // Try ZIP deploy
    const deployTab = page.getByRole('button', { name: /Deploy/i }).first();
    if (await deployTab.isVisible().catch(() => false)) {
      await deployTab.click();
      const zipOption = page.locator('text=ZIP Download');
      if (await zipOption.isVisible().catch(() => false)) {
        await zipOption.click();
        const deployButton = page.locator('button').filter({ hasText: /Download ZIP|Deploy/i }).first();
        await deployButton.click();
        console.log('ZIP deploy clicked');
        await page.waitForTimeout(2000);
      }
    }

    if (consoleErrors.length === 0) {
      console.log('E2E test passed with no console errors');
    } else {
      console.log(`E2E test completed with ${consoleErrors.length} console errors`);
    }
  } catch (error) {
    console.error('E2E test failed:', error.message);
    await page.screenshot({ path: '/tmp/nexo-lp-e2e-error.png', fullPage: false });
    console.log('Error screenshot saved to /tmp/nexo-lp-e2e-error.png');
    throw error;
  } finally {
    if (NO_KEEP_OPEN) {
      await browser.close();
    } else {
      console.log('Browser left open. Close it manually when done.');
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
