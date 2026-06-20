#!/usr/bin/env node
/**
 * Generates fullscreen screenshots for published LOJA templates.
 *
 * For each public template, opens its public preview URL in Chrome via CDP,
 * waits for the page to settle, takes a full-page screenshot, saves it under
 * data/previews/thumbnails/{templateId}.png, and updates the template's
 * thumbnail_url so the LOJA cards show a real preview image.
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const fs = require('fs');
const { chromium } = require('playwright');

const API_BASE = process.env.NEXO_LP_API_URL || 'http://localhost:3460/api/nexo-lp';
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3460';
const CDP_URL = process.env.KIMI_CDP_URL || 'http://127.0.0.1:9226';
const THUMBNAIL_DIR = path.resolve(__dirname, '../data/previews/thumbnails');

async function apiGet(url) {
  const res = await fetch(`${API_BASE}${url}`);
  const json = await res.json();
  if (!json.success) {
    throw new Error(json.error?.message || `GET ${url} failed`);
  }
  return json.data;
}

async function apiPatch(url, body) {
  const res = await fetch(`${API_BASE}${url}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {}),
  });
  const json = await res.json();
  if (!json.success) {
    throw new Error(json.error?.message || `PATCH ${url} failed`);
  }
  return json.data;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  fs.mkdirSync(THUMBNAIL_DIR, { recursive: true });

  const data = await apiGet('/templates?limit=200');
  const templates = data.templates || [];
  const candidates = templates.filter(
    (t) => (t.status === 'available' || t.status === 'unreviewed') && t.is_public >= 1
  );

  console.log(`[THUMBNAILS] Found ${candidates.length} public templates (available + unreviewed)`);

  const browser = await chromium.connectOverCDP(CDP_URL);
  const context = browser.contexts()[0] || await browser.newContext();

  let captured = 0;
  let skipped = 0;
  let failed = 0;

  for (let i = 0; i < candidates.length; i++) {
    const template = candidates[i];
    const result = { templateId: template.id, success: false, path: null, error: null };
    const screenshotPath = path.join(THUMBNAIL_DIR, `${template.id}.png`);

    try {
      if (!template.public_preview_token) {
        throw new Error('Template has no public_preview_token');
      }

      // Skip templates that already have a thumbnail file on disk.
      if (fs.existsSync(screenshotPath)) {
        skipped += 1;
        console.log(`[${i + 1}/${candidates.length}] Skipping ${template.id} — thumbnail already exists`);
        continue;
      }

      const previewUrl = `${BACKEND_URL}/preview/public/${template.public_preview_token}.html`;
      console.log(`[${i + 1}/${candidates.length}] Capturing ${previewUrl}`);

      const page = await context.newPage({ viewport: { width: 1920, height: 1080 } });
      try {
        await page.goto(previewUrl, { waitUntil: 'networkidle', timeout: 60000 });
        await sleep(1500);

        await page.screenshot({ path: screenshotPath, fullPage: false, timeout: 45000 });

        const thumbnailUrl = `/preview/thumbnails/${template.id}.png`;
        await apiPatch(`/templates/${template.id}`, { thumbnail_url: thumbnailUrl });

        captured += 1;
        result.success = true;
        result.path = screenshotPath;
        console.log(`  -> saved ${screenshotPath}`);
      } finally {
        await page.close().catch(() => {});
      }
    } catch (err) {
      failed += 1;
      result.error = err.message;
      console.error(`  FAILED: ${err.message}`);
    }
  }

  await browser.close().catch(() => {});

  console.log(`[THUMBNAILS] Done: ${captured} captured, ${skipped} skipped, ${failed} failed (total ${candidates.length})`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('[THUMBNAILS] Fatal error:', err.message);
    process.exit(1);
  });
