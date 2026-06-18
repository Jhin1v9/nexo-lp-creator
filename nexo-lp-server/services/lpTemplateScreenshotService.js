/**
 * NEXO Landing Page Creator v3.0 - Template Screenshot Service
 *
 * Captures viewport screenshots of public LOJA templates using Playwright.
 * Saves images under data/previews/thumbnails/{templateId}.png and returns
 * the public URL path served by /preview.
 *
 * @module services/lpTemplateScreenshotService
 * @version 3.0.0
 */

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const config = require('../config/nexo-lp-config');

const THUMBNAIL_DIR = path.join(config.preview.storagePath, 'thumbnails');
const CDP_URL = process.env.KIMI_CDP_URL || 'http://127.0.0.1:9226';
const BACKEND_URL = process.env.BACKEND_URL || config.preview.baseUrl || `http://localhost:${config.port}`;
const DEFAULT_VIEWPORT = { width: 1920, height: 1080 };

function ensureThumbnailDir() {
  if (!fs.existsSync(THUMBNAIL_DIR)) {
    fs.mkdirSync(THUMBNAIL_DIR, { recursive: true });
  }
}

function getThumbnailPath(templateId) {
  return path.join(THUMBNAIL_DIR, `${templateId}.png`);
}

function getThumbnailUrl(templateId) {
  return `/preview/thumbnails/${templateId}.png`;
}

async function connectBrowser() {
  // Prefer reusing the Luna/Kimi Chrome instance when available.
  try {
    if (CDP_URL) {
      const browser = await chromium.connectOverCDP(CDP_URL);
      if (browser.contexts().length > 0) {
        return { browser, context: browser.contexts()[0], launched: false };
      }
      await browser.close().catch(() => {});
    }
  } catch (err) {
    console.log('[ScreenshotService] CDP not available, launching local browser:', err.message);
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: DEFAULT_VIEWPORT });
  return { browser, context, launched: true };
}

class TemplateScreenshotService {
  constructor() {
    ensureThumbnailDir();
  }

  /**
   * Capture a viewport screenshot of a public template preview.
   * @param {string} templateId
   * @param {string} publicPreviewToken
   * @returns {Promise<string>} Public thumbnail URL path
   */
  async captureTemplateScreenshot(templateId, publicPreviewToken) {
    if (!templateId) throw new Error('templateId is required');
    if (!publicPreviewToken) throw new Error('publicPreviewToken is required');

    ensureThumbnailDir();

    const previewUrl = `${BACKEND_URL}/preview/public/${publicPreviewToken}.html`;
    const screenshotPath = getThumbnailPath(templateId);
    const thumbnailUrl = getThumbnailUrl(templateId);

    const { browser, context, launched } = await connectBrowser();
    let page;

    try {
      page = await context.newPage({ viewport: DEFAULT_VIEWPORT });
      // Disable arbitrary timeouts; rely on navigation/load-state signals instead.
      page.setDefaultTimeout(0);

      await page.goto(previewUrl, { waitUntil: 'networkidle', timeout: 0 });
      // Wait for fonts and the document to be fully ready before capturing.
      await page.evaluate(() => document.fonts.ready).catch(() => {});
      await page.waitForLoadState('networkidle').catch(() => {});

      await page.screenshot({ path: screenshotPath, fullPage: false });
      return thumbnailUrl;
    } finally {
      if (page) await page.close().catch(() => {});
      // Only close the browser if we launched it locally. When reusing the
      // shared Kimi Chrome via CDP we must not kill the browser process.
      if (launched && browser) await browser.close().catch(() => {});
    }
  }

  getThumbnailPath(templateId) {
    return getThumbnailPath(templateId);
  }

  getThumbnailUrl(templateId) {
    return getThumbnailUrl(templateId);
  }
}

module.exports = new TemplateScreenshotService();
