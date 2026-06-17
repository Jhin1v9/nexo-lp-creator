#!/usr/bin/env node
/**
 * One-shot importer for existing Kimi chats into the NEXO LOJA.
 *
 * - Connects to the user's Chrome via CDP (KIMI_CDP_URL).
 * - Lists sidebar chat links from https://www.kimi.com.
 * - Skips the last 2 chats (marked incomplete by the user).
 * - For each remaining chat, extracts the complete HTML from the CODE tab
 *   (or the Deploy tab / download link as fallback).
 * - Creates a NEXO session and publishes it as a LOJA template.
 * - Writes a JSON log to data/imported-chats.json.
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const fs = require('fs');
const os = require('os');
const { chromium } = require('playwright');

const { initializeDatabase } = require('../nexo-lp-server/models/sqlite');
const SessionRepository = require('../nexo-lp-server/models/repositories/SessionRepository');
const lpTemplateService = require('../nexo-lp-server/services/lpTemplateService');

const CDP_URL = process.env.KIMI_CDP_URL || 'http://127.0.0.1:9226';
const IMPORTER_USER_ID = 'import-batch';
const LOG_PATH = path.resolve(__dirname, '../data/imported-chats.json');
const KIMI_ORIGIN = 'https://www.kimi.com';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function toAbsoluteUrl(href) {
  if (!href) return null;
  if (href.startsWith('http')) return href;
  if (href.startsWith('/')) return `${KIMI_ORIGIN}${href}`;
  return `${KIMI_ORIGIN}/${href}`;
}

function validateHtml(html) {
  if (!html || typeof html !== 'string') return false;
  const h = html.trim();
  return (
    h.includes('<!DOCTYPE html>') &&
    h.includes('<html') &&
    h.includes('</html>') &&
    (h.includes('<body') || h.includes('<main') || h.includes('<section'))
  );
}

/**
 * Scroll the sidebar / page to force lazy-loaded chat links into the DOM.
 */
async function collectSidebarChatLinks(page, maxScrolls = 20) {
  const seen = new Set();
  const links = [];

  for (let i = 0; i < maxScrolls; i++) {
    const batch = await page.evaluate(() => {
      const out = [];
      document.querySelectorAll('a[href*="/chat/"]').forEach((a) => {
        const href = a.getAttribute('href');
        if (!href) return;
        const title = (a.innerText || a.textContent || '').trim().replace(/\s+/g, ' ');
        out.push({ href, title: title.slice(0, 200) });
      });
      return out;
    });

    let newFound = false;
    for (const item of batch) {
      if (!seen.has(item.href)) {
        seen.add(item.href);
        links.push(item);
        newFound = true;
      }
    }

    if (!newFound) break;

    await page.evaluate(() => {
      // Try a scrollable sidebar first, then fall back to the whole document.
      const sidebar = document.querySelector('[class*="sidebar"], [class*="chat-list"], [class*="conversation-list"]');
      if (sidebar) {
        sidebar.scrollTo(0, sidebar.scrollHeight);
      } else {
        window.scrollTo(0, document.body.scrollHeight);
      }
    });
    await sleep(400);
  }

  return links;
}

/**
 * Extract the original user prompt from the first user message in the chat.
 */
async function extractFirstUserPrompt(page) {
  const prompt = await page.evaluate(() => {
    const selectors = [
      '.segment-user .segment-content-box',
      '.segment-user',
      '[class*="segment-user"]',
      '.message-user',
      '[class*="message-user"]',
      '.user-message',
      '[class*="user-message"]',
    ];
    for (const sel of selectors) {
      const els = document.querySelectorAll(sel);
      if (els.length > 0) {
        const text = (els[0].innerText || els[0].textContent || '').trim();
        if (text) return text.slice(0, 2000);
      }
    }
    return '';
  });
  return prompt;
}

/**
 * Open the artifact CODE tab and extract the full HTML source.
 */
async function extractFromCodeTab(page) {
  try {
    const hasPanel = await page.locator('.file-view-content, .side-console-rail.open').count() > 0;

    if (!hasPanel) {
      const clicked = await page.evaluate(() => {
        const assistants = document.querySelectorAll('.segment-assistant');
        if (!assistants.length) return false;
        const last = assistants[assistants.length - 1];

        const candidates = Array.from(last.querySelectorAll('a, button, [role="button"]'));
        for (const el of candidates) {
          const text = (el.innerText || el.textContent || el.getAttribute('href') || '').toLowerCase();
          if (
            text.includes('.html') ||
            text.includes('.jsx') ||
            text.includes('.css') ||
            text.includes('.js') ||
            text.includes('sandbox://') ||
            text.includes('download')
          ) {
            el.click();
            return true;
          }
        }

        const cards = last.querySelectorAll('[class*="file"], [class*="artifact"], [class*="attachment"], [class*="code-card"]');
        for (const el of cards) {
          el.click();
          return true;
        }
        return false;
      });

      if (clicked) {
        await page.waitForSelector('.file-view-content, .side-console-rail.open', { timeout: 5000 }).catch(() => {});
        await sleep(800);
      }
    }

    const codeTab = page.locator('.segment-mermaid-switch-item').filter({ hasText: /^Code$/i }).first();
    if (await codeTab.count() > 0) {
      const isSelected = await codeTab.evaluate((el) => el.classList.contains('selected')).catch(() => false);
      if (!isSelected) {
        await codeTab.click({ timeout: 2000 });
        await sleep(800);
      }
    }

    const html = await page.evaluate(() => {
      const content = document.querySelector('.file-view-content');
      if (!content) return '';
      const selectors = [
        '.file-view-core pre code',
        '.file-view-core pre',
        '.segment-code.code-content pre code',
        '.segment-code.code-content pre',
        '.file-view-content pre code',
        '.file-view-content pre',
        '.file-view-content code',
      ];
      let best = '';
      for (const sel of selectors) {
        content.querySelectorAll(sel).forEach((el) => {
          const t = (el.textContent || '').trim();
          if (t.length > best.length) best = t;
        });
      }
      return best;
    });

    return html && html.length > 100 ? html : null;
  } catch (err) {
    console.warn(`[CODE tab] extraction failed: ${err.message}`);
    return null;
  }
}

/**
 * Fallback: open the Deploy tab and capture the downloaded HTML file.
 */
async function extractFromDeployTab(page) {
  try {
    const deployTab = page.locator('.segment-mermaid-switch-item').filter({ hasText: /^Deploy$/i }).first();
    if (await deployTab.count() === 0) return null;

    // Start listening for downloads BEFORE clicking anything.
    const downloadPromise = page.waitForEvent('download', { timeout: 15000 }).catch(() => null);

    await deployTab.click({ timeout: 2000 });
    await sleep(800);

    const clicked = await page.evaluate(() => {
      const elements = Array.from(document.querySelectorAll('a, button, [role="button"], [class*="download"]'));
      for (const el of elements) {
        const text = (el.innerText || el.textContent || '').toLowerCase();
        const href = el.getAttribute('href') || '';
        if (
          text.includes('download') ||
          href.includes('.html') ||
          href.includes('download') ||
          el.hasAttribute('download')
        ) {
          el.click();
          return true;
        }
      }
      return false;
    });

    if (!clicked) {
      downloadPromise.catch(() => {});
      return null;
    }

    const download = await downloadPromise;
    if (!download) return null;

    const tmpPath = path.join(os.tmpdir(), `nexo-import-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.html`);
    await download.saveAs(tmpPath);
    const html = fs.readFileSync(tmpPath, 'utf8');
    fs.unlinkSync(tmpPath);
    return html;
  } catch (err) {
    console.warn(`[Deploy tab] extraction failed: ${err.message}`);
    return null;
  }
}

async function extractCompleteHtml(page) {
  let html = await extractFromCodeTab(page);
  if (html) {
    console.log(`  Extracted ${html.length} chars from CODE tab`);
    return html;
  }

  html = await extractFromDeployTab(page);
  if (html) {
    console.log(`  Extracted ${html.length} chars from Deploy tab/download`);
    return html;
  }

  throw new Error('Could not extract HTML from CODE or Deploy tab');
}

async function importChat(page, link, index, total) {
  const fullUrl = toAbsoluteUrl(link.href);
  console.log(`[${index + 1}/${total}] ${fullUrl}`);

  const result = {
    url: fullUrl,
    title: link.title,
    success: false,
    sessionId: null,
    templateId: null,
    htmlLength: 0,
    error: null,
  };

  try {
    await page.goto(fullUrl, { waitUntil: 'networkidle', timeout: 60000 });
    await sleep(1500);

    const html = await extractCompleteHtml(page);
    if (!validateHtml(html)) {
      throw new Error('Extracted content failed HTML validation');
    }

    const prompt = await extractFirstUserPrompt(page);

    const session = await SessionRepository.create({
      userId: IMPORTER_USER_ID,
      stack: 'static-html-tailwind',
      status: 'preview',
      current_html: html,
      initial_prompt: prompt,
    });

    await SessionRepository.updateMetadata(session.id, { kimiChatUrl: fullUrl });

    const template = await lpTemplateService.publishFromSession(session.id, IMPORTER_USER_ID);

    result.success = true;
    result.sessionId = session.id;
    result.templateId = template.id;
    result.htmlLength = html.length;

    console.log(`  -> session ${session.id}, template ${template.id}`);
  } catch (err) {
    result.error = err.message;
    console.error(`  FAILED: ${err.message}`);
  }

  return result;
}

async function main() {
  console.log(`[IMPORT] Connecting to Chrome at ${CDP_URL}`);

  await initializeDatabase();

  const browser = await chromium.connectOverCDP(CDP_URL);
  const contexts = browser.contexts();
  if (!contexts || contexts.length === 0) {
    throw new Error('No browser contexts found via CDP');
  }

  const context = contexts[0];
  let page = context.pages().find((p) => p.url().includes('kimi.com'));
  let pageCreated = false;

  if (!page) {
    page = await context.newPage();
    pageCreated = true;
  }

  try {
    console.log(`[IMPORT] Navigating to ${KIMI_ORIGIN}`);
    await page.goto(KIMI_ORIGIN, { waitUntil: 'networkidle', timeout: 60000 });
    await sleep(2000);

    const allLinks = await collectSidebarChatLinks(page);
    console.log(`[IMPORT] Found ${allLinks.length} sidebar chat links`);

    if (allLinks.length <= 2) {
      throw new Error('Not enough chats to skip the last 2');
    }

    const linksToImport = allLinks.slice(0, -2);
    const skipped = allLinks.slice(-2);

    console.log(`[IMPORT] Processing ${linksToImport.length} chats (skipped ${skipped.length})`);

    const results = [];
    for (let i = 0; i < linksToImport.length; i++) {
      const result = await importChat(page, linksToImport[i], i, linksToImport.length);
      results.push(result);
      await sleep(500);
    }

    const log = {
      importedAt: new Date().toISOString(),
      cdpUrl: CDP_URL,
      totalFound: allLinks.length,
      processed: linksToImport.length,
      skipped: skipped.map((l) => ({ url: toAbsoluteUrl(l.href), title: l.title })),
      results,
    };

    fs.writeFileSync(LOG_PATH, JSON.stringify(log, null, 2));
    console.log(`[IMPORT] Log written to ${LOG_PATH}`);

    const okCount = results.filter((r) => r.success).length;
    console.log(`[IMPORT] Done: ${okCount}/${linksToImport.length} imported successfully`);
  } finally {
    if (pageCreated && page) {
      try {
        await page.close();
      } catch (e) {
        // ignore
      }
    }
    if (browser && typeof browser.disconnect === 'function') {
      await browser.disconnect();
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('[IMPORT] Fatal error:', err.message);
    process.exit(1);
  });
