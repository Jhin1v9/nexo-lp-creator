#!/usr/bin/env node
/**
 * E2E test: verifies the end-to-end auto-publish flow for a restaurant site.
 *
 * Environment variables:
 *   FRONTEND_URL  - URL where the NEXO frontend is running (default: http://localhost:5173)
 *   KIMI_CDP_URL  - Playwright CDP endpoint for Chrome (default: http://127.0.0.1:9226)
 *   BACKEND_URL   - URL where the NEXO backend is running (default: http://localhost:3460)
 *
 * IMPORTANT: This test requires the backend, frontend, and Chrome bridge to be running.
 * It is meant to be invoked on-demand (e.g. `npm run test:e2e:restaurant`), not as part
 * of a standard unit-test suite.
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const { chromium } = require('playwright');

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
const KIMI_CDP_URL = process.env.KIMI_CDP_URL || 'http://127.0.0.1:9226';
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3460';
const API_BASE_URL = `${BACKEND_URL}/api/nexo-lp`;
const PROMPT = 'Crie um site lindo para um restaurante italiano chamado Sapore Di Nonna';
const SESSION_STORAGE_KEY = 'nexo-lp-current-session';

const { initializeDatabase, closeDatabase } = require('../nexo-lp-server/models/sqlite');
const TemplateRepository = require('../nexo-lp-server/models/repositories/TemplateRepository');

function log(message) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [e2e-restaurant] ${message}`);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForGenerationComplete(page, timeoutMs = 300_000) {
  log('Waiting for generation to complete...');
  const start = Date.now();
  const iframe = page.locator('iframe[title="Landing Page Preview"]').first();
  const completeIndicator = page.locator('text=/Generation complete|View generated page/i').first();

  while (Date.now() - start < timeoutMs) {
    const iframeVisible = await iframe.isVisible({ timeout: 500 }).catch(() => false);
    if (iframeVisible) {
      log('Preview iframe is visible.');
      return;
    }

    const indicatorVisible = await completeIndicator.isVisible({ timeout: 500 }).catch(() => false);
    if (indicatorVisible) {
      log('Generation complete indicator is visible.');
      return;
    }

    await sleep(1000);
  }

  throw new Error(`Generation did not complete within ${timeoutMs}ms`);
}

async function pollTemplateAvailable(sessionId, timeoutMs = 300_000, intervalMs = 2000) {
  log(`Polling database for template with status='available' (sessionId=${sessionId})...`);
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    const template = await TemplateRepository.findBySessionId(sessionId);
    if (template) {
      log(`Template found: id=${template.id}, status=${template.status}, is_public=${template.is_public}`);
      if (template.status === 'available') {
        return template;
      }
    }
    await sleep(intervalMs);
  }

  throw new Error(`Template did not reach status='available' within ${timeoutMs}ms`);
}

async function fetchTemplates() {
  const url = `${API_BASE_URL}/templates`;
  log(`Fetching templates from ${url}...`);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`GET /templates failed: ${response.status} ${response.statusText}`);
  }
  const payload = await response.json();
  return payload?.data || payload;
}

async function run() {
  let browser = null;
  let page = null;

  try {
    log('============================================================');
    log('Starting restaurant auto-publish E2E verification');
    log(`FRONTEND_URL=${FRONTEND_URL}`);
    log(`KIMI_CDP_URL=${KIMI_CDP_URL}`);
    log(`BACKEND_URL=${BACKEND_URL}`);
    log('============================================================');

    log('Connecting to Chrome via Playwright CDP...');
    browser = await chromium.connectOverCDP(KIMI_CDP_URL);
    log(`Connected. Browser version: ${await browser.version()}`);

    log(`Navigating to frontend: ${FRONTEND_URL}`);
    page = await browser.newPage();
    await page.goto(FRONTEND_URL, { waitUntil: 'networkidle', timeout: 30_000 });

    log('Locating generation input...');
    const input = page.locator('textarea[placeholder*="landing page"]').first();
    await input.waitFor({ state: 'visible', timeout: 15_000 });

    log(`Filling prompt: "${PROMPT}"`);
    await input.fill(PROMPT);
    await input.press('Enter');
    log('Prompt submitted.');

    await waitForGenerationComplete(page);

    log('Extracting sessionId from localStorage...');
    const sessionRaw = await page.evaluate((key) => localStorage.getItem(key), SESSION_STORAGE_KEY);
    if (!sessionRaw) {
      throw new Error(`No session found in localStorage under key "${SESSION_STORAGE_KEY}"`);
    }
    let session;
    try {
      session = JSON.parse(sessionRaw);
    } catch (error) {
      throw new Error(`Failed to parse session from localStorage: ${error.message}`);
    }
    const sessionId = session?.id;
    if (!sessionId) {
      throw new Error('sessionId is missing from the stored session object');
    }
    log(`sessionId=${sessionId}`);

    log('Initializing database connection...');
    await initializeDatabase();

    const template = await pollTemplateAvailable(sessionId);
    log(`Template is available: id=${template.id}`);

    if (template.is_public !== 1) {
      throw new Error(`Template is not public: is_public=${template.is_public}`);
    }
    log('Template is public (is_public=1).');

    if (!template.metadata_json || template.metadata_json.trim().length === 0) {
      throw new Error('Template metadata_json is empty');
    }
    log(`Template has metadata (${template.metadata_json.length} chars).`);

    const templatesResponse = await fetchTemplates();
    const templates = templatesResponse?.templates || [];
    const foundInApi = templates.find(
      (t) => t.id === template.id || t.session_id === sessionId
    );
    if (!foundInApi) {
      throw new Error('Template was not returned by GET /templates');
    }
    log('Template appears in GET /templates response.');

    if (!template.public_preview_token) {
      throw new Error('Template has no public_preview_token');
    }
    const publicPreviewUrl = `${BACKEND_URL}/preview/public/${template.public_preview_token}.html`;
    log(`Opening public preview: ${publicPreviewUrl}`);

    const previewPage = await browser.newPage();
    await previewPage.goto(publicPreviewUrl, { waitUntil: 'networkidle', timeout: 30_000 });

    const title = await previewPage.title();
    log(`Public preview title: "${title}"`);

    const titleTrimmed = (title || '').trim();
    if (titleTrimmed.length === 0) {
      throw new Error('Public preview title is empty');
    }
    if (!titleTrimmed.includes('Sapore') && !titleTrimmed.includes('Nonna')) {
      log('Note: title does not contain "Sapore" or "Nonna", but it is non-empty.');
    }

    await previewPage.close();

    log('============================================================');
    log('Restaurant auto-publish E2E verification PASSED');
    log('============================================================');
  } catch (error) {
    log('============================================================');
    log(`FAILED: ${error.message}`);
    log('============================================================');
    throw error;
  } finally {
    if (page) {
      try {
        await page.close();
      } catch {
        // ignore cleanup errors
      }
    }
    if (browser) {
      try {
        await browser.close();
      } catch {
        // ignore cleanup errors
      }
    }
    try {
      log('Closing database connection...');
      closeDatabase();
    } catch {
      // ignore
    }
  }
}

run()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
