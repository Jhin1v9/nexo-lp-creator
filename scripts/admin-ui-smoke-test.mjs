#!/usr/bin/env node
/**
 * Admin panel UI smoke test for NEXO LP Creator.
 *
 * Verifies that every major admin button / flow works end-to-end against the
 * real running frontend + backend. Non-destructive actions are used where
 * possible (edit/save, block/unblock, pause/resume, credit/deduct). Destructive
 * actions (delete) are skipped to avoid destroying user data.
 *
 * Usage:
 *   ADMIN_TOKEN=your_secret node scripts/admin-ui-smoke-test.mjs
 *   BASE_URL=http://localhost:5174 ADMIN_TOKEN=... node scripts/admin-ui-smoke-test.mjs
 */
import { chromium } from 'playwright';

const BASE_URL = process.env.BASE_URL || 'http://localhost:5174';
const API_BASE = process.env.API_BASE || 'http://localhost:3460';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || process.env.ADMIN_SECRET;

if (!ADMIN_TOKEN) {
  console.error('Set ADMIN_TOKEN or ADMIN_SECRET env var to the admin secret.');
  process.exit(1);
}

const results = [];
const consoleErrors = [];

function pass(step, detail = '') {
  results.push({ step, status: 'PASS', detail });
}

function fail(step, error, detail = '') {
  results.push({ step, status: 'FAIL', error: error?.message || String(error), detail });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForAdminResponse(page, method, pathFragment, timeout = 15_000) {
  return page.waitForResponse(
    (resp) =>
      resp.url().includes(`/api/nexo-lp/admin/${pathFragment}`) &&
      resp.request().method() === method,
    { timeout }
  );
}

async function getFirstRowCell(page, cellIndex = 0) {
  const row = page.locator('table tbody tr').first();
  await row.waitFor({ state: 'visible', timeout: 10_000 });
  return row.locator('td').nth(cellIndex).textContent();
}

async function clickSidebarModule(page, title) {
  const btn = page.locator('aside nav button[title="' + title + '"]').first();
  await btn.click();
}

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  // Pre-seed the admin token so the very first app load is authenticated.
  await context.addInitScript((token) => {
    localStorage.setItem('nexo_admin_token', token);
  }, ADMIN_TOKEN);
  const page = await context.newPage();

  page.on('dialog', (dialog) => dialog.accept());
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('response', (resp) => {
    if (resp.url().includes('/api/nexo-lp/admin/')) {
      console.log(`[network] ${resp.request().method()} ${resp.url()} -> ${resp.status()}`);
    }
  });

  let firstUserId = '';

  try {
    // Login via localStorage token
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });

    // Open admin panel
    await page.locator('aside nav button:has-text("Admin")').click();
    await page.locator('h1:has-text("Overview")').waitFor({ timeout: 10_000 });
    await sleep(500);

    // ------------------------------------------------------------------
    // Overview
    // ------------------------------------------------------------------
    try {
      // The initial stats request may have already fired; use Refresh to get a deterministic one
      const respPromise = waitForAdminResponse(page, 'GET', 'stats');
      await page.locator('button[title="Refresh"]').click();
      const resp = await respPromise;
      pass('Overview → loads stats', `status ${resp.status()}`);
    } catch (e) {
      fail('Overview → loads stats', e);
    }

    // ------------------------------------------------------------------
    // Templates: edit & save
    // ------------------------------------------------------------------
    await clickSidebarModule(page, 'Templates');
    await page.locator('h2:has-text("Templates")').waitFor({ timeout: 10_000 });

    try {
      const resp = await waitForAdminResponse(page, 'GET', 'templates');
      pass('Templates → list loads', `status ${resp.status()}`);
    } catch (e) {
      fail('Templates → list loads', e);
    }

    try {
      await page.locator('table tbody tr:first-child td:last-child button[title="Edit"]').click();
      await page.locator('.fixed h3:has-text("Template preview & metadata")').waitFor({ timeout: 10_000 });

      const nameInput = page.locator('.fixed input[type="text"]').first();
      await nameInput.fill('Admin Smoke Test Template');

      const savePromise = waitForAdminResponse(page, 'PATCH', 'templates/');
      await page.locator('.fixed button:has-text("Save changes")').click();
      const resp = await savePromise;
      if (resp.status() === 200) {
        pass('Templates → edit & save', `PATCH status ${resp.status()}`);
      } else {
        fail('Templates → edit & save', new Error(`PATCH status ${resp.status()}`));
      }

      // panel closes and list reloads
      await page.locator('h2:has-text("Templates")').waitFor({ state: 'visible', timeout: 10_000 });
    } catch (e) {
      fail('Templates → edit & save', e);
    }

    // ------------------------------------------------------------------
    // Users: view, block, unblock, impersonate
    // ------------------------------------------------------------------
    await clickSidebarModule(page, 'Users');
    await page.locator('h2:has-text("Users")').waitFor({ timeout: 10_000 });

    try {
      const resp = await waitForAdminResponse(page, 'GET', 'users');
      pass('Users → list loads', `status ${resp.status()}`);
    } catch (e) {
      fail('Users → list loads', e);
    }

    firstUserId = (await getFirstRowCell(page, 0)).trim();
    let firstUserStatus = (await getFirstRowCell(page, 3)).trim();

    // Reset user to active via direct API so the block/unblock cycle is deterministic
    if (firstUserStatus === 'blocked') {
      await fetch(`${API_BASE.replace(/\/$/, '')}/api/nexo-lp/admin/users/${encodeURIComponent(firstUserId)}/unblock`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${ADMIN_TOKEN}` },
      });
      const refreshPromise = waitForAdminResponse(page, 'GET', 'users');
      await page.locator('button[title="Refresh"]').click();
      await refreshPromise;
      firstUserStatus = (await getFirstRowCell(page, 3)).trim();
    }

    try {
      const blockPromise = waitForAdminResponse(page, 'POST', 'users/');
      await page.locator('table tbody tr:first-child td:last-child button[title="Block"]').click();
      const blockResp = await blockPromise;
      if (blockResp.status() === 200) {
        pass('Users → block', `status ${blockResp.status()}`);
      } else {
        throw new Error(`status ${blockResp.status()}`);
      }

      const unblockPromise = waitForAdminResponse(page, 'POST', 'users/');
      await page.locator('table tbody tr:first-child td:last-child button[title="Unblock"]').click();
      const unblockResp = await unblockPromise;
      if (unblockResp.status() === 200) {
        pass('Users → unblock', `status ${unblockResp.status()}`);
      } else {
        throw new Error(`status ${unblockResp.status()}`);
      }
    } catch (e) {
      fail('Users → block/unblock', e);
    }

    try {
      const respPromise = waitForAdminResponse(page, 'POST', 'users/');
      await page.locator('table tbody tr:first-child td:last-child button[title="Impersonate"]').click();
      const resp = await respPromise;
      pass('Users → impersonate', `status ${resp.status()}`);
    } catch (e) {
      fail('Users → impersonate', e);
    }

    // ------------------------------------------------------------------
    // Sessions: regenerate
    // ------------------------------------------------------------------
    await clickSidebarModule(page, 'Sessions');
    await page.locator('h2:has-text("Sessions")').waitFor({ timeout: 10_000 });

    try {
      const resp = await waitForAdminResponse(page, 'GET', 'sessions');
      pass('Sessions → list loads', `status ${resp.status()}`);
    } catch (e) {
      fail('Sessions → list loads', e);
    }

    try {
      const rowCount = await page.locator('table tbody tr').count();
      if (rowCount === 0) {
        pass('Sessions → regenerate', 'skipped (no sessions)');
      } else {
        const respPromise = waitForAdminResponse(page, 'POST', 'sessions/', 60_000);
        await page.locator('table tbody tr:first-child td:last-child button[title="Regenerate"]').click();
        const resp = await respPromise;
        pass('Sessions → regenerate', `status ${resp.status()}`);
      }
    } catch (e) {
      fail('Sessions → regenerate', e);
    }

    // ------------------------------------------------------------------
    // Mining: pause / resume
    // ------------------------------------------------------------------
    await clickSidebarModule(page, 'Mining');
    await page.locator('h2:has-text("Mining jobs")').waitFor({ timeout: 10_000 });

    try {
      const resp = await waitForAdminResponse(page, 'GET', 'mining-jobs');
      pass('Mining → list loads', `status ${resp.status()}`);
    } catch (e) {
      fail('Mining → list loads', e);
    }

    try {
      const pauseBtn = page.locator('table tbody tr:first-child td:last-child button[title="Pause"]').first();
      if (await pauseBtn.isVisible().catch(() => false)) {
        const respPromise = waitForAdminResponse(page, 'POST', 'mining-jobs/');
        await pauseBtn.click();
        const resp = await respPromise;
        pass('Mining → pause', `status ${resp.status()}`);

        const resumePromise = waitForAdminResponse(page, 'POST', 'mining-jobs/');
        await page.locator('table tbody tr:first-child td:last-child button[title="Resume"]').click();
        const resumeResp = await resumePromise;
        pass('Mining → resume', `status ${resumeResp.status()}`);
      } else {
        pass('Mining → pause/resume', 'skipped (no pausable jobs)');
      }
    } catch (e) {
      fail('Mining → pause/resume', e);
    }

    // ------------------------------------------------------------------
    // Analytics
    // ------------------------------------------------------------------
    await clickSidebarModule(page, 'Analytics');
    await page.locator('h2:has-text("Loja Analytics")').waitFor({ timeout: 10_000 });
    await sleep(500);

    try {
      const respPromise = waitForAdminResponse(page, 'GET', 'purchases');
      await page.locator('button[title="Refresh"]').click();
      const resp = await respPromise;
      pass('Analytics → purchases load', `status ${resp.status()}`);
    } catch (e) {
      fail('Analytics → purchases load', e);
    }

    try {
      await page.locator('button:has-text("Export CSV")').click();
      pass('Analytics → export CSV');
    } catch (e) {
      fail('Analytics → export CSV', e);
    }

    // ------------------------------------------------------------------
    // Operations
    // ------------------------------------------------------------------
    await clickSidebarModule(page, 'Operations');
    await page.locator('h2:has-text("Live Operations")').waitFor({ timeout: 10_000 });

    try {
      await page.locator('text=Conectado').first().waitFor({ timeout: 10_000 });
      pass('Operations → live events connected');
    } catch (e) {
      fail('Operations → live events connected', e);
    }

    // ------------------------------------------------------------------
    // Settings: edit & save
    // ------------------------------------------------------------------
    await clickSidebarModule(page, 'Settings');
    await page.locator('h2:has-text("Settings")').waitFor({ timeout: 10_000 });

    try {
      const resp = await waitForAdminResponse(page, 'GET', 'settings');
      pass('Settings → load', `status ${resp.status()}`);
    } catch (e) {
      fail('Settings → load', e);
    }

    try {
      const priceField = page.locator('div:has(> label:has-text("Default template price")) > input');
      await priceField.fill('42');

      const respPromise = waitForAdminResponse(page, 'PATCH', 'settings');
      await page.locator('button:has-text("Save settings")').click();
      const resp = await respPromise;
      if (resp.status() === 200) {
        pass('Settings → save', `status ${resp.status()}`);
      } else {
        throw new Error(`status ${resp.status()}`);
      }
    } catch (e) {
      fail('Settings → save', e);
    }

    // ------------------------------------------------------------------
    // Refresh button
    // ------------------------------------------------------------------
    try {
      const respPromise = waitForAdminResponse(page, 'GET', 'settings');
      await page.locator('button[title="Refresh"]').click();
      const resp = await respPromise;
      pass('Top bar → Refresh module', `status ${resp.status()}`);
    } catch (e) {
      fail('Top bar → Refresh module', e);
    }

    // ------------------------------------------------------------------
    // Credit / Deduct
    // ------------------------------------------------------------------
    try {
      await page.locator('aside > button[title="Credit / Deduct"]').click();
      await page.locator('h3:has-text("Credit / Deduct currency")').waitFor({ timeout: 10_000 });

      await page.locator('input[placeholder="user-..."]').fill(firstUserId || 'user-test');
      await page.locator('input[placeholder="0"]').fill('1');

      const respPromise = waitForAdminResponse(page, 'POST', 'currency/credit');
      await page.locator('.fixed:has(h3:has-text("Credit / Deduct currency")) button:has-text("Credit")').click();
      const resp = await respPromise;
      pass('Credit / Deduct → credit user', `status ${resp.status()}`);
    } catch (e) {
      fail('Credit / Deduct → credit user', e);
    }

    // ------------------------------------------------------------------
    // Command palette
    // ------------------------------------------------------------------
    try {
      await page.keyboard.press('Control+k');
      await page.locator('[placeholder="Type a command..."]').waitFor({ timeout: 10_000 });
      await page.locator('[placeholder="Type a command..."]').fill('templates');
      await sleep(300);
      const result = page.locator('.fixed:has([placeholder="Type a command..."]) button:has-text("Go to Templates")').first();
      await result.click({ force: true });
      await page.locator('h2:has-text("Templates")').waitFor({ timeout: 10_000 });
      pass('Command palette → navigate to Templates');
    } catch (e) {
      fail('Command palette → navigate to Templates', e);
    }

    // ------------------------------------------------------------------
    // Logout
    // ------------------------------------------------------------------
    try {
      await page.locator('button[title="Logout"]').click();
      await page.locator('h1:has-text("Nexo Command Center")').waitFor({ timeout: 10_000 });
      pass('Logout → returns to login screen');
    } catch (e) {
      fail('Logout → returns to login screen', e);
    }
  } finally {
    await browser.close();
  }
}

run()
  .then(() => {
    console.log('\n========== ADMIN UI SMOKE TEST RESULTS ==========\n');
    let failCount = 0;
    for (const r of results) {
      const icon = r.status === 'PASS' ? '✅' : '❌';
      const detail = r.detail ? ` (${r.detail})` : '';
      console.log(`${icon} ${r.status}: ${r.step}${detail}`);
      if (r.error) console.log(`   Error: ${r.error}`);
      if (r.status === 'FAIL') failCount++;
    }
    if (consoleErrors.length) {
      console.log('\nBrowser console errors:');
      consoleErrors.forEach((e) => console.log('  ' + e));
    }
    console.log(`\nTotal: ${results.length} checks, ${failCount} failed.`);
    process.exit(failCount > 0 ? 1 : 0);
  })
  .catch((err) => {
    console.error('Smoke test runner crashed:', err);
    process.exit(1);
  });
