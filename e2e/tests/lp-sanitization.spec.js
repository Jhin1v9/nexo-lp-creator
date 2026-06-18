const { test, expect } = require('@playwright/test');

const FRONTEND_URL = 'http://localhost:5174';
const API_BASE = 'http://localhost:3460/api/nexo-lp';
const PROMPT = 'Create a modern SaaS landing page with pricing, features and testimonials';
const CDP_PORT = process.env.KIMI_CDP_PORT || '9226';

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

test.describe('NEXO LP Creator - end-to-end sanitization flow', () => {
  test('sends one prompt, publishes, and waits for sanitization to finish', async ({ page }) => {
    // Generating + sanitizing through the real Kimi bridge can take several minutes.
    test.setTimeout(600_000);

    // === 1. Generate a landing page from one prompt ===
    await page.goto(FRONTEND_URL);
    await expect(page).toHaveTitle(/NEXO|Landing Page/);

    const input = page.locator('textarea[placeholder*="landing page"]').first();
    await expect(input).toBeVisible();

    await input.fill(PROMPT);
    await expect(input).toHaveValue(PROMPT);
    await input.press('Enter');

    // === 2. Wait for generation to complete (success or explicit failure) ===
    await expect(
      page.locator('text=/Generation complete|View generated page|Generation failed/i').first()
    ).toBeVisible({ timeout: 180_000 });

    // === 3. Read the session id saved by the frontend ===
    const sessionId = await page.evaluate(() => {
      const raw = localStorage.getItem('nexo-lp-current-session');
      if (!raw) return null;
      try {
        return JSON.parse(raw).id || null;
      } catch {
        return null;
      }
    });
    expect(sessionId, 'Could not read session id from localStorage').toBeTruthy();

    // === 4. Publish the session to the LOJA (one-shot) ===
    const publishRes = await fetch(`${API_BASE}/sessions/${sessionId}/publish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    expect(publishRes.status, 'Publish endpoint failed').toBe(201);
    const publishJson = await publishRes.json();
    expect(publishJson.success).toBe(true);

    const { templateId } = publishJson.data;
    console.log(`[E2E] Published session ${sessionId} as template ${templateId}. Waiting for sanitization...`);

    // === 5. Poll the template until sanitization finishes or fails ===
    const terminalStatuses = new Set(['available', 'unreviewed', 'failed']);
    const pollDeadline = Date.now() + 600_000; // 10 minutes
    let template = null;

    while (Date.now() < pollDeadline) {
      const res = await fetch(`${API_BASE}/templates/${templateId}`);
      const json = await res.json();
      template = json.data;

      if (template && terminalStatuses.has(template.status)) {
        break;
      }

      await new Promise((r) => setTimeout(r, 5_000));
    }

    expect(template, 'Template did not reach a terminal status in time').toBeTruthy();
    console.log(`[E2E] Sanitization finished with status: ${template.status}`);
    expect(
      terminalStatuses.has(template.status),
      `Expected terminal status, got: ${template.status}`
    ).toBe(true);

    // === 6. Ensure the bridge did not leak extra Kimi tabs ===
    const count = await countKimiTabsOnPort(CDP_PORT);
    expect(
      count,
      `Expected at most 1 Kimi tab on CDP port ${CDP_PORT}, found ${count}`
    ).toBeLessThanOrEqual(1);
  });
});
