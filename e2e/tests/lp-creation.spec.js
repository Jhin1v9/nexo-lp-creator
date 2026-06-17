const { test, expect } = require('@playwright/test');

const FRONTEND_URL = 'http://localhost:5174';
const PROMPT = 'Create a modern SaaS landing page with pricing, features and testimonials';
const CDP_PORT = process.env.KIMI_CDP_PORT || '9226';

async function waitForStable(page, ms = 600) {
  await page.waitForTimeout(ms);
}

async function countKimiTabsOnPort(port) {
  try {
    const response = await fetch(`http://127.0.0.1:${port}/json/list`);
    if (!response.ok) return 0;
    const targets = await response.json();
    return targets.filter(
      (t) => t.type === 'page' && t.url && t.url.includes('kimi.com')
    ).length;
  } catch {
    return 0;
  }
}

test.describe('NEXO LP Creator - end-to-end user flow', () => {
  test('user creates a landing page and preview is styled', async ({ page }) => {
    // === 1. Open the application ===
    await page.goto(FRONTEND_URL);
    await expect(page).toHaveTitle(/NEXO|Landing Page/);

    const input = page.locator('textarea[placeholder*="landing page"]').first();
    await expect(input).toBeVisible();

    // === 2. Type the prompt and submit with Enter ===
    await input.fill(PROMPT);
    await expect(input).toHaveValue(PROMPT);
    await input.press('Enter');

    // === 3. Expect a user message bubble ===
    await expect(page.locator('text=' + PROMPT).first()).toBeVisible();

    // === 4. Wait for generation to complete ===
    await expect(
      page.locator('text=/Generation complete|View generated page/i').first()
    ).toBeVisible({ timeout: 180_000 });

    // === 5. Verify the preview is rendered and styled ===
    const previewIframe = page.locator('iframe[title="Landing Page Preview"]').first();
    await expect(previewIframe).toBeVisible({ timeout: 15_000 });

    const firstHeading = previewIframe.contentFrame().locator('h1').first();
    await expect(firstHeading).toBeVisible({ timeout: 15_000 });
    await expect(firstHeading).not.toBeEmpty();

    const previewHtml = await previewIframe.evaluate((iframe) => {
      return iframe.contentDocument?.documentElement?.outerHTML || '';
    });
    expect(previewHtml.length).toBeGreaterThan(500);
    expect(
      previewHtml.includes('cdn.tailwindcss.com') ||
      /class="[^"]*(?:bg-|text-|p-|m-|flex|grid|max-w-)[^"]*"/.test(previewHtml)
    ).toBe(true);
  });

  test('bridge keeps only one Kimi tab on the isolated CDP port', async () => {
    const count = await countKimiTabsOnPort(CDP_PORT);
    expect(count, `Expected at most 1 Kimi tab on CDP port ${CDP_PORT}, found ${count}`).toBeLessThanOrEqual(1);
  });

  test('chat messages persist after reload', async ({ page }) => {
    await page.goto(FRONTEND_URL);

    const input = page.locator('textarea[placeholder*="landing page"]').first();
    await input.fill(PROMPT);
    await input.press('Enter');

    await expect(
      page.locator('text=/Generation complete|View generated page/i').first()
    ).toBeVisible({ timeout: 180_000 });

    // Reload and expect the user prompt to still be visible.
    await page.reload();
    await waitForStable(page, 1000);
    await expect(page.locator('text=' + PROMPT).first()).toBeVisible({ timeout: 15_000 });
  });

  test('chat container scrolls to show new messages', async ({ page }) => {
    await page.goto(FRONTEND_URL);

    const input = page.locator('textarea[placeholder*="landing page"]').first();
    const chatEl = page.locator('[class*="overflow-y-auto"]').first();

    // Send one generation request; streaming creates multiple messages.
    await input.fill(PROMPT);
    await input.press('Enter');

    await expect(
      page.locator('text=/Generation complete|View generated page/i').first()
    ).toBeVisible({ timeout: 180_000 });

    const { scrollTop, scrollHeight, clientHeight } = await chatEl.evaluate((el) => ({
      scrollTop: el.scrollTop,
      scrollHeight: el.scrollHeight,
      clientHeight: el.clientHeight,
    }));

    if (scrollHeight > clientHeight) {
      expect(scrollTop + clientHeight).toBeGreaterThanOrEqual(scrollHeight - 80);
    }
  });
});
