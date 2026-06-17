# Import Kimi Chats + Sidebar Fix + E2E Restaurant Test

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Import existing valid Kimi chats as LOJA templates, fix the frontend sidebar project list, and verify the end-to-end auto-publish flow with a restaurant site.

**Architecture:** A one-shot Node script uses Playwright CDP to iterate over Kimi sidebar chats, opens each chat's CODE/DEPLOY tab, extracts the clean HTML, filters invalid/incomplete chats, and publishes each via `lpTemplateService.publishFromSession`. Sidebar fixes are pure Svelte/CSS. The E2E test uses the existing generation flow and polls the backend until sanitization completes.

**Tech Stack:** Node.js, Playwright CDP, Svelte, Tailwind, SQLite, internal NEXO services.

---

## Task 1: Create one-shot import script

**Files:**
- Create: `scripts/import-kimi-chats-to-loja.js`
- Read: `nexo-lp-server/services/luna/kimi-bridge.cjs` (existing Chrome connection helpers)
- Read: `nexo-lp-server/services/lpTemplateService.js` (`publishFromSession`)
- Read: `nexo-lp-server/services/lpPreviewService.js` (token generation)
- Read: `nexo-lp-server/models/repositories/SessionRepository.js`
- Read: `nexo-lp-server/models/repositories/TemplateRepository.js`

- [ ] **Step 1: Bootstrap the script**

```javascript
#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

process.env.NODE_ENV = process.env.NODE_ENV || 'development';

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { chromium } = require('playwright');
const { initializeDatabase, closeDatabase } = require('../nexo-lp-server/models/sqlite');
const SessionRepository = require('../nexo-lp-server/models/repositories/SessionRepository');
const lpTemplateService = require('../nexo-lp-server/services/lpTemplateService');

const CDP_URL = process.env.KIMI_CDP_URL || 'http://127.0.0.1:9226';
const SKIP_FROM_BOTTOM = 2; // user said last 2 chats from bottom are incomplete

function isValidHtml(html) {
  if (!html || html.length < 500) return false;
  const lower = html.toLowerCase().trim();
  return lower.includes('<!doctype html>') && lower.includes('<html') && lower.includes('</html>') && /<(body|main|section)/i.test(html);
}

function titleFromPrompt(prompt) {
  if (!prompt) return 'Imported Project';
  const words = prompt.trim().split(/\s+/).slice(0, 5);
  return words.join(' ');
}

async function main() {
  await initializeDatabase();
  const browser = await chromium.connectOverCDP(CDP_URL);
  try {
    const context = browser.contexts()[0] || await browser.newContext();
    const page = context.pages()[0] || await context.newPage();
    // implementation in next steps
  } finally {
    await browser.close();
    closeDatabase();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 2: Add helper to list chats from sidebar**

```javascript
async function listChatUrls(page) {
  // Kimi sidebar links contain /chat/{uuid}
  return page.evaluate(() => {
    const links = Array.from(document.querySelectorAll('a[href*="/chat/"]'));
    return links
      .map((a) => ({ url: a.href, title: (a.textContent || '').trim() }))
      .filter((item, idx, arr) => arr.findIndex((i) => i.url === item.url) === idx);
  });
}
```

- [ ] **Step 3: Add helper to extract HTML from CODE/DEPLOY tab**

```javascript
async function extractHtmlFromChat(page, chatUrl) {
  await page.goto(chatUrl, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);

  // Try to open CODE tab by text content
  const codeTab = await page.$('text=CODE');
  const deployTab = await page.$('text=Deploy');
  if (codeTab) await codeTab.click();
  else if (deployTab) await deployTab.click();
  await page.waitForTimeout(1000);

  // Look for a download HTML link or a code block containing the full HTML
  const html = await page.evaluate(() => {
    // 1. download link
    const downloadLink = Array.from(document.querySelectorAll('a, button')).find((el) =>
      (el.textContent || '').toLowerCase().includes('download html')
    );
    if (downloadLink) {
      // Return the href if present; caller can fetch it
      return { type: 'link', href: downloadLink.href || null };
    }
    // 2. code block text
    const code = document.querySelector('pre code, .segment-code-content, [class*="code"]');
    if (code) return { type: 'code', html: code.innerText || code.textContent || '' };
    return { type: 'none' };
  });

  if (html.type === 'code') return html.html;
  if (html.type === 'link' && html.href) {
    const response = await page.evaluate((url) => fetch(url).then((r) => r.text()), html.href);
    return response;
  }
  return '';
}
```

- [ ] **Step 4: Iterate chats, skip last 2, validate, publish**

```javascript
async function main() {
  await initializeDatabase();
  const browser = await chromium.connectOverCDP(CDP_URL);
  const imported = [];
  try {
    const context = browser.contexts()[0] || await browser.newContext();
    const page = context.pages()[0] || await context.newPage();
    await page.goto('https://www.kimi.com', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    const chats = await listChatUrls(page);
    console.log(`Found ${chats.length} chats`);

    // Skip last N from bottom as requested by user
    const chatsToProcess = chats.slice(0, Math.max(0, chats.length - SKIP_FROM_BOTTOM));

    for (const chat of chatsToProcess) {
      console.log(`Processing: ${chat.title || '(no title)'} — ${chat.url}`);
      const html = await extractHtmlFromChat(page, chat.url);
      if (!isValidHtml(html)) {
        console.log('  -> invalid/empty HTML, skipping');
        continue;
      }

      // Detect original prompt from first user message in chat
      const prompt = await page.evaluate(() => {
        const userMsg = document.querySelector('.segment-user .segment-content-box, [class*="user"] [class*="content"]');
        return userMsg ? (userMsg.innerText || userMsg.textContent || '').trim() : '';
      });

      const session = await SessionRepository.create({
        user_id: 'import-batch',
        initial_prompt: prompt || chat.title || 'Imported landing page',
        stack: 'static-html-tailwind',
        status: 'preview',
        current_html: html,
      });

      const result = await lpTemplateService.publishFromSession(session.id, 'import-batch');
      imported.push({ chatUrl: chat.url, sessionId: session.id, templateId: result.templateId, name: titleFromPrompt(prompt) });
      console.log(`  -> published template ${result.templateId}`);
    }
  } finally {
    await browser.close();
    closeDatabase();
  }

  console.log(`\nImported ${imported.length} templates`);
  fs.writeFileSync(path.join(__dirname, '..', 'data', 'imported-chats.json'), JSON.stringify(imported, null, 2));
}
```

- [ ] **Step 5: Make script executable and add to package scripts**

Add to `package.json` scripts:

```json
"import:kimi-chats": "node scripts/import-kimi-chats-to-loja.js"
```

Run: `npm run import:kimi-chats`
Expected: script lists chats, skips last 2, publishes valid ones, writes `data/imported-chats.json`.

- [ ] **Step 6: Commit**

```bash
git add scripts/import-kimi-chats-to-loja.js package.json
git commit -m "feat: add one-shot script to import existing Kimi chats into LOJA"
```

---

## Task 2: Fix frontend sidebar

**Files:**
- Modify: `nexo-lp-web/src/components/LPSidebar.svelte` (or equivalent)
- Read: `nexo-lp-web/src/stores/sessionStore.js` or API call that returns sessions

- [ ] **Step 1: Locate sidebar component and session name usage**

Search for `Untitled Project` or `recent projects` in `nexo-lp-web/src`.

```bash
grep -rn "Untitled Project\|RECENT PROJECTS\|recent projects" nexo-lp-web/src/
```

- [ ] **Step 2: Add helper to derive project title from prompt**

In the same Svelte component or a new `nexo-lp-web/src/lib/projectName.js`:

```javascript
export function projectNameFromPrompt(prompt, fallback = 'Untitled Project') {
  if (!prompt || typeof prompt !== 'string') return fallback;
  const cleaned = prompt.trim().replace(/[\n\r]+/g, ' ');
  const words = cleaned.split(/\s+/).filter(Boolean);
  if (words.length === 0) return fallback;
  const title = words.slice(0, 5).join(' ');
  return title.length > 40 ? title.slice(0, 40) + '…' : title;
}
```

- [ ] **Step 3: Replace session display name**

Wherever the sidebar renders the project name, change:

```svelte
<span>{session.name || 'Untitled Project'}</span>
```

to:

```svelte
<script>
  import { projectNameFromPrompt } from '../lib/projectName.js';
</script>

<span>{projectNameFromPrompt(session.initial_prompt, session.name)}</span>
```

- [ ] **Step 4: Make project list scrollable**

Wrap the recent projects list in a container with Tailwind classes:

```svelte
<div class="flex-1 overflow-y-auto max-h-[60vh] pr-1">
  <!-- project items -->
</div>
```

Adjust `max-h-[60vh]` based on actual sidebar layout.

- [ ] **Step 5: Fix dropdown to open downward**

For the 3-dot menu container, ensure parent has `relative` and dropdown has:

```svelte
<div class="absolute top-full right-0 mt-1 w-40 bg-white rounded-lg shadow-lg z-50 border">
  <!-- menu items -->
</div>
```

If the component uses a library (e.g. Popper, Floating UI), configure `placement="bottom-end"`.

- [ ] **Step 6: Run frontend dev server and verify visually**

```bash
cd nexo-lp-web && npm run dev
```

Verify:
- Old projects show names from their prompts.
- List scrolls when there are many projects.
- 3-dot menu opens downward and is clickable.

- [ ] **Step 7: Commit**

```bash
git add nexo-lp-web/src/
git commit -m "fix: sidebar project names from prompt, scroll, dropdown direction"
```

---

## Task 3: E2E restaurant test

**Files:**
- Create: `scripts/e2e-restaurant-test.js`
- Read: `nexo-lp-server/services/lpGenerationService.js` (generation API)
- Read: `nexo-lp-server/models/repositories/TemplateRepository.js`
- Read: `nexo-lp-server/services/lpSanitizationOrchestrator.js`

- [ ] **Step 1: Create E2E test script**

```javascript
#!/usr/bin/env node
const path = require('path');
process.env.NODE_ENV = process.env.NODE_ENV || 'test';
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { chromium } = require('playwright');
const { initializeDatabase, closeDatabase } = require('../nexo-lp-server/models/sqlite');
const TemplateRepository = require('../nexo-lp-server/models/repositories/TemplateRepository');

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
const CDP_URL = process.env.KIMI_CDP_URL || 'http://127.0.0.1:9226';
const PROMPT = 'Crie um site lindo para um restaurante italiano chamado Sapore Di Nonna';

async function waitFor(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function pollTemplate(sessionId, timeoutMs = 5 * 60 * 1000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const template = await TemplateRepository.findBySessionId(sessionId);
    if (template && template.status === 'available') return template;
    if (template) console.log(`  status=${template.status}`);
    await waitFor(5000);
  }
  throw new Error('Timeout waiting for template to become available');
}

async function main() {
  await initializeDatabase();
  const browser = await chromium.connectOverCDP(CDP_URL);
  const context = browser.contexts()[0] || await browser.newContext();
  const page = await context.newPage();

  try {
    await page.goto(FRONTEND_URL, { waitUntil: 'networkidle' });
    // Adjust selectors to match actual frontend
    await page.fill('[placeholder*="prompt"], textarea, [contenteditable]', PROMPT);
    await page.click('button:has-text("Generate"), button:has-text("Criar"), button[type="submit"]');

    console.log('Generation started...');
    // Wait until generation completes (frontend shows preview or success state)
    await page.waitForSelector('iframe, .preview, .success', { timeout: 5 * 60 * 1000 });

    // Extract sessionId from URL or localStorage
    const sessionId = await page.evaluate(() => {
      const match = window.location.pathname.match(/\/sessions\/(\w+)/);
      return match ? match[1] : localStorage.getItem('currentSessionId');
    });
    console.log(`Session ID: ${sessionId}`);

    console.log('Polling template...');
    const template = await pollTemplate(sessionId);
    console.log(`Template available: ${template.id}`);

    // Verify public preview
    const previewUrl = `${FRONTEND_URL}/preview/public/${template.public_preview_token}.html`;
    const previewPage = await context.newPage();
    await previewPage.goto(previewUrl, { waitUntil: 'networkidle' });
    const title = await previewPage.title();
    console.log(`Preview title: ${title}`);

    // Verify template appears in public list
    const response = await page.evaluate(async () => {
      const res = await fetch('/templates');
      return res.json();
    });
    const found = response.templates.find((t) => t.id === template.id);
    console.log(`Found in public list: ${!!found}`);
  } finally {
    await browser.close();
    closeDatabase();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 2: Start full stack before running**

```bash
# terminal 1
npm run dev:backend
# terminal 2
cd nexo-lp-web && npm run dev
```

- [ ] **Step 3: Run the E2E script**

```bash
node scripts/e2e-restaurant-test.js
```

Expected output:
```
Generation started...
Session ID: sess-...
Polling template...
  status=sanitizing
  status=available
Template available: tpl-...
Preview title: Sapore Di Nonna — ...
Found in public list: true
```

- [ ] **Step 4: Commit**

```bash
git add scripts/e2e-restaurant-test.js
git commit -m "test: add e2e restaurant auto-publish verification"
```

---

## Self-Review

- **Spec coverage:**
  - Import existing chats → Task 1
  - Sidebar naming/scroll/dropdown → Task 2
  - E2E restaurant test → Task 3
- **Placeholder scan:** No TBD/TODO; all code shown.
- **Type consistency:** `session.initial_prompt` used in Task 2 matches session schema. `publishFromSession` signature used in Task 1 matches existing service.
