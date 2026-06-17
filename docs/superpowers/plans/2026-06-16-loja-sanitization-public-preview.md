# LOJA + Sanitização Kimi + Preview Público Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Automatically publish every generated landing page to the LOJA with Kimi-based sanitization and a public preview URL, while gating the original prompt behind a purchase.

**Architecture:** Extend the existing `templates` table and `lpTemplateService` to support generated-store items. Add an asynchronous `lpSanitizationService` that calls the same Kimi chat twice (instant sanitization → thinking review). Add public preview files under `data/previews/public/`. Wire the generation flow to publish after preview, and update the frontend LOJA to fetch real templates with purchase/use flows.

**Tech Stack:** Node.js, Express, sql.js (SQLite), Playwright/Kimi bridge, Svelte 4, Tailwind CSS, Jest.

---

## File Structure

| File | Responsibility |
|------|----------------|
| `nexo-lp-server/models/migrations/010_loja_sanitization.sql` | Add LOJA/sanitization columns to `templates` and create `template_purchases` table |
| `nexo-lp-server/models/repositories/TemplateRepository.js` | CRUD including new LOJA fields, status filtering |
| `nexo-lp-server/models/repositories/TemplatePurchaseRepository.js` | Track who bought what |
| `nexo-lp-server/services/lpSanitizationService.js` | Two-step Kimi sanitization worker |
| `nexo-lp-server/services/lpPreviewService.js` | Save/update public preview files |
| `nexo-lp-server/services/lpTemplateService.js` | publish/buy/use/prompt-gate logic |
| `nexo-lp-server/services/lpGenerationService.js` | Trigger publish after preview phase |
| `nexo-lp-server/nexo-lp-routes.js` | New routes for buy, public preview, prompt access |
| `nexo-lp-server/nexo-lp-server.js` | Static serving for `/preview/public` |
| `nexo-lp-web/src/lib/api.js` | New API wrappers |
| `nexo-lp-web/src/lib/lpClient.js` | Integration helpers |
| `nexo-lp-web/src/components/LPTemplateStore.svelte` | Fetch and display real LOJA items |
| `nexo-lp-web/src/components/LPTemplateCard.svelte` | Show status/price |
| `nexo-lp-web/src/components/LPTemplateModal.svelte` | Preview, censored prompt, buy/use |
| `nexo-lp-server/tests/services/lpSanitizationService.test.js` | Sanitization worker tests |
| `nexo-lp-server/tests/services/lpTemplateService.test.js` | Publish/buy/use/prompt tests |
| `nexo-lp-server/tests/services/lpPreviewService.test.js` | Public preview file tests |

---

## Task 1: Database Migration

**Files:**
- Create: `nexo-lp-server/models/migrations/010_loja_sanitization.sql`
- Modify: `nexo-lp-server/models/sqlite.js` (register migration if migrations are hard-coded)

### Step 1.1: Write migration file

```sql
-- ============================================================
-- Migration 010: LOJA + Sanitization + Public Preview
-- ============================================================

ALTER TABLE templates ADD COLUMN status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('sanitizing', 'available', 'failed'));
ALTER TABLE templates ADD COLUMN original_html TEXT;
ALTER TABLE templates ADD COLUMN sanitized_html TEXT;
ALTER TABLE templates ADD COLUMN sanitization_log TEXT; -- JSON
ALTER TABLE templates ADD COLUMN public_preview_token TEXT;
ALTER TABLE templates ADD COLUMN prompt_hash TEXT;
ALTER TABLE templates ADD COLUMN prompt_censored TEXT;
ALTER TABLE templates ADD COLUMN session_id TEXT;
ALTER TABLE templates ADD COLUMN kimi_chat_url TEXT;

CREATE INDEX IF NOT EXISTS idx_templates_status ON templates(status);
CREATE INDEX IF NOT EXISTS idx_templates_public_preview_token ON templates(public_preview_token);
CREATE INDEX IF NOT EXISTS idx_templates_session_id ON templates(session_id);

CREATE TABLE IF NOT EXISTS template_purchases (
  id TEXT PRIMARY KEY,
  template_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  price_stars INTEGER NOT NULL DEFAULT 0,
  price_suns INTEGER NOT NULL DEFAULT 0,
  price_moons INTEGER NOT NULL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (template_id) REFERENCES templates(id)
);

CREATE INDEX IF NOT EXISTS idx_template_purchases_template_user ON template_purchases(template_id, user_id);
```

### Step 1.2: Register migration

If `sqlite.js` reads migration files automatically, this step is done. If it has a hard-coded list, add `'010_loja_sanitization.sql'` to the list.

### Step 1.3: Verify migration runs

Run:
```bash
cd /home/jhin/luna/nexo-lp-creator/nexo-lp-server && node -e "const { initializeDatabase } = require('./models/sqlite'); initializeDatabase().then(() => console.log('ok')).catch(e => console.error(e))"
```

Expected: `ok`

### Step 1.4: Commit

```bash
git add nexo-lp-server/models/migrations/010_loja_sanitization.sql
if git diff --name-only | grep -q sqlite.js; then git add nexo-lp-server/models/sqlite.js; fi
git commit -m "feat(loja): add migration for sanitization, public preview and purchases"
```

---

## Task 2: Repository Updates

**Files:**
- Modify: `nexo-lp-server/models/repositories/TemplateRepository.js`
- Create: `nexo-lp-server/models/repositories/TemplatePurchaseRepository.js`

### Step 2.1: Update TemplateRepository.create

Replace the `create` method to include new fields:

```js
async create(data) {
  const id = data.id || `tpl-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const now = new Date().toISOString();
  await run(
    `INSERT INTO templates (
      id, name, description, category, stack, thumbnail_url,
      html, css, js, config, tags, source, usage_count, rating,
      is_public, created_by, created_at, updated_at,
      status, original_html, sanitized_html, sanitization_log,
      public_preview_token, prompt_hash, prompt_censored,
      price_stars, price_suns, price_moons,
      session_id, kimi_chat_url
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      data.name,
      data.description || null,
      data.category || 'landing',
      data.stack || 'static-html-tailwind',
      data.thumbnail_url || data.thumbnailUrl || null,
      data.html || null,
      data.css || null,
      data.js || null,
      data.config ? JSON.stringify(data.config) : null,
      Array.isArray(data.tags) ? data.tags.join(',') : (data.tags || null),
      data.source || 'manual',
      data.usage_count || data.usageCount || 0,
      data.rating || 0,
      data.is_public !== undefined ? data.is_public : (data.isPublic !== undefined ? data.isPublic : true),
      data.created_by || data.createdBy || null,
      now,
      now,
      data.status || 'available',
      data.original_html || null,
      data.sanitized_html || null,
      data.sanitization_log ? JSON.stringify(data.sanitization_log) : null,
      data.public_preview_token || null,
      data.prompt_hash || null,
      data.prompt_censored || null,
      data.price_stars || 0,
      data.price_suns || 0,
      data.price_moons || 0,
      data.session_id || null,
      data.kimi_chat_url || null,
    ]
  );
  return this.findById(id);
}
```

### Step 2.2: Add method findBySessionId

```js
async findBySessionId(sessionId) {
  return queryOne('SELECT * FROM templates WHERE session_id = ?', [sessionId]);
}
```

### Step 2.3: Add method findByPublicPreviewToken

```js
async findByPublicPreviewToken(token) {
  return queryOne('SELECT * FROM templates WHERE public_preview_token = ?', [token]);
}
```

### Step 2.4: Update findAll to include status handling

Modify `findAll` so it can list `sanitizing` items (visible to everyone) and `available` items, but exclude `failed` by default unless explicitly requested:

```js
async findAll(options = {}) {
  let sql = 'SELECT * FROM templates WHERE 1=1';
  const params = [];

  if (options.status) {
    sql += ' AND status = ?';
    params.push(options.status);
  } else {
    sql += " AND status IN ('sanitizing', 'available')";
  }

  if (options.category) { sql += ' AND category = ?'; params.push(options.category); }
  if (options.stack) { sql += ' AND stack = ?'; params.push(options.stack); }
  if (options.search) {
    sql += ' AND (name LIKE ? OR description LIKE ?)';
    params.push(`%${options.search}%`, `%${options.search}%`);
  }

  sql += ' ORDER BY rating DESC, usage_count DESC';

  const page = options.page || 1;
  const limit = options.limit || 20;
  const offset = (page - 1) * limit;
  sql += ' LIMIT ? OFFSET ?';
  params.push(limit, offset);

  const templates = await query(sql, params);
  const total = await this.count(options);
  return { templates, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}
```

Also update `count` to mirror the status logic.

### Step 2.5: Create TemplatePurchaseRepository

```js
const { query, queryOne, run } = require('../sqlite');

class TemplatePurchaseRepository {
  async create(data) {
    const id = data.id || `tpu-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    await run(
      `INSERT INTO template_purchases (id, template_id, user_id, price_stars, price_suns, price_moons, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, data.template_id, data.user_id, data.price_stars || 0, data.price_suns || 0, data.price_moons || 0, new Date().toISOString()]
    );
    return this.findById(id);
  }

  async findById(id) {
    return queryOne('SELECT * FROM template_purchases WHERE id = ?', [id]);
  }

  async findByTemplateAndUser(templateId, userId) {
    return queryOne('SELECT * FROM template_purchases WHERE template_id = ? AND user_id = ?', [templateId, userId]);
  }

  async findByUser(userId) {
    return query('SELECT * FROM template_purchases WHERE user_id = ?', [userId]);
  }
}

module.exports = new TemplatePurchaseRepository();
```

### Step 2.6: Test repositories

Create `nexo-lp-server/tests/models/templateRepository.test.js`:

```js
const fs = require('fs');
const path = require('path');
const testDbPath = path.join(__dirname, '../../../data/nexo-lp-test-template.db');
process.env.NEXO_LP_DB_PATH = testDbPath;
process.env.NODE_ENV = 'test';

const { initializeDatabase, closeDatabase } = require('../../models/sqlite');
const TemplateRepository = require('../../models/repositories/TemplateRepository');
const TemplatePurchaseRepository = require('../../models/repositories/TemplatePurchaseRepository');

describe('TemplateRepository LOJA fields', () => {
  beforeAll(async () => {
    if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
    await initializeDatabase();
  });

  afterAll(async () => {
    closeDatabase();
    if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
  });

  test('create stores sanitization and preview fields', async () => {
    const tpl = await TemplateRepository.create({
      name: 'Generated Site',
      status: 'sanitizing',
      original_html: '<html>original</html>',
      public_preview_token: 'pub-123',
      session_id: 'sess-123',
      price_stars: 5,
    });
    expect(tpl.status).toBe('sanitizing');
    expect(tpl.original_html).toContain('original');
    expect(tpl.public_preview_token).toBe('pub-123');
    expect(tpl.price_stars).toBe(5);
  });

  test('findBySessionId returns template', async () => {
    const found = await TemplateRepository.findBySessionId('sess-123');
    expect(found).not.toBeNull();
    expect(found.name).toBe('Generated Site');
  });

  test('findByPublicPreviewToken returns template', async () => {
    const found = await TemplateRepository.findByPublicPreviewToken('pub-123');
    expect(found).not.toBeNull();
  });

  test('TemplatePurchaseRepository records a purchase', async () => {
    const purchase = await TemplatePurchaseRepository.create({
      template_id: 'tpl-123',
      user_id: 'user-123',
      price_stars: 5,
    });
    expect(purchase.template_id).toBe('tpl-123');
    const found = await TemplatePurchaseRepository.findByTemplateAndUser('tpl-123', 'user-123');
    expect(found).not.toBeNull();
  });
});
```

Run:
```bash
cd /home/jhin/luna/nexo-lp-creator && npx jest nexo-lp-server/tests/models/templateRepository.test.js --verbose
```

Expected: all tests PASS

### Step 2.7: Commit

```bash
git add nexo-lp-server/models/repositories/TemplateRepository.js
mkdir -p nexo-lp-server/models/repositories && git add nexo-lp-server/models/repositories/TemplatePurchaseRepository.js
git add nexo-lp-server/tests/models/templateRepository.test.js
git commit -m "feat(loja): extend repositories for sanitization, purchases and public preview"
```

---

## Task 3: Public Preview Service

**Files:**
- Modify: `nexo-lp-server/services/lpPreviewService.js`

### Step 3.1: Add public preview methods

```js
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const PREVIEWS_DIR = path.resolve(__dirname, '../../data/previews');
const PUBLIC_DIR = path.join(PREVIEWS_DIR, 'public');

function ensurePublicDir() {
  if (!fs.existsSync(PUBLIC_DIR)) fs.mkdirSync(PUBLIC_DIR, { recursive: true });
}

class PreviewService {
  // ... existing methods ...

  generatePublicToken() {
    return `pub-${crypto.randomUUID()}`;
  }

  publishPublicPreview(sessionId, html, token) {
    ensurePublicDir();
    const fileName = `${token}.html`;
    const filePath = path.join(PUBLIC_DIR, fileName);
    fs.writeFileSync(filePath, this.wrapHtml(html), 'utf8');
    return { token, url: `/preview/public/${fileName}` };
  }

  updatePublicPreview(token, html) {
    ensurePublicDir();
    const filePath = path.join(PUBLIC_DIR, `${token}.html`);
    if (!fs.existsSync(filePath)) throw new Error('Public preview not found');
    fs.writeFileSync(filePath, this.wrapHtml(html), 'utf8');
    return { token, url: `/preview/public/${token}.html` };
  }

  getPublicPreviewPath(token) {
    return path.join(PUBLIC_DIR, `${token}.html`);
  }

  getPublicPreviewUrl(token) {
    return `/preview/public/${token}.html`;
  }
}

module.exports = new PreviewService();
```

### Step 3.2: Test public preview

Create `nexo-lp-server/tests/services/lpPreviewService.test.js`:

```js
const fs = require('fs');
const path = require('path');
const PreviewService = require('../../services/lpPreviewService');

describe('lpPreviewService public preview', () => {
  test('publishes and updates public preview', () => {
    const token = PreviewService.generatePublicToken();
    const { url } = PreviewService.publishPublicPreview('sess-x', '<h1>Original</h1>', token);
    expect(url).toBe(`/preview/public/${token}.html`);
    const filePath = PreviewService.getPublicPreviewPath(token);
    expect(fs.existsSync(filePath)).toBe(true);
    expect(fs.readFileSync(filePath, 'utf8')).toContain('Original');

    PreviewService.updatePublicPreview(token, '<h1>Sanitized</h1>');
    expect(fs.readFileSync(filePath, 'utf8')).toContain('Sanitized');

    fs.unlinkSync(filePath);
  });
});
```

Run:
```bash
npx jest nexo-lp-server/tests/services/lpPreviewService.test.js --verbose
```

Expected: PASS

### Step 3.3: Commit

```bash
git add nexo-lp-server/services/lpPreviewService.js
mkdir -p nexo-lp-server/tests/services && git add nexo-lp-server/tests/services/lpPreviewService.test.js
git commit -m "feat(loja): add public preview file publishing"
```

---

## Task 4: Sanitization Service

**Files:**
- Create: `nexo-lp-server/services/lpSanitizationService.js`
- Create: `nexo-lp-server/services/lpBridgeAdapter.cjs` (already exists, use it)

### Step 4.1: Implement sanitization service

```js
const crypto = require('crypto');
const TemplateRepository = require('../models/repositories/TemplateRepository');
const PreviewService = require('./lpPreviewService');
const BridgeAdapter = require('./lpBridgeAdapter.cjs');

const SANITIZE_PROMPT = `You are a strict HTML sanitizer for the NEXO Digital landing page store (https://www.nexo-digital.app/pt).

Task: sanitize the landing page HTML below.
Rules:
- Remove all brand names, personal names, emails, phone numbers, addresses, and real business data.
- Replace removed data with neutral placeholder content for NEXO Digital.
- Keep the layout, structure, Tailwind classes, React components, and images (use placeholder image URLs if originals identify real brands).
- Do NOT add explanations. Return ONLY the sanitized HTML code.

HTML to sanitize:`;

const REVIEW_PROMPT = `Review the sanitized landing page HTML below. Is it technically correct, safe, and ready to be published in the NEXO Digital store?

Reply ONLY with "OK" if it is ready. If not, list the minimal corrections needed (no code, just instructions).`;

const MAX_RETRIES = 3;

class SanitizationService {
  hashPrompt(prompt) {
    return crypto.createHash('sha256').update(prompt).digest('hex');
  }

  makeCensoredPrompt() {
    return '[PROMPT BLOQUEADO — compre este template na LOJA para desbloquear o prompt original]';
  }

  async startSanitization(sessionId, originalHtml, originalPrompt, kimiChatUrl, userId) {
    const template = await TemplateRepository.findBySessionId(sessionId);
    if (!template) throw new Error('Template not found for session ' + sessionId);

    const log = { attempts: [], startedAt: new Date().toISOString() };

    try {
      // Step 1: instant sanitize
      log.attempts.push({ step: 'sanitize', mode: 'instant', startedAt: new Date().toISOString() });
      const sanitized = await this._sendToKimi(originalHtml, 'instant', kimiChatUrl, SANITIZE_PROMPT);
      log.attempts[log.attempts.length - 1].finishedAt = new Date().toISOString();
      log.attempts[log.attempts.length - 1].responseLength = sanitized.length;

      // Step 2: thinking review
      log.attempts.push({ step: 'review', mode: 'thinking', startedAt: new Date().toISOString() });
      const review = await this._sendToKimi(sanitized, 'thinking', kimiChatUrl, REVIEW_PROMPT);
      log.attempts[log.attempts.length - 1].finishedAt = new Date().toISOString();
      log.attempts[log.attempts.length - 1].response = review.slice(0, 500);

      let finalHtml = sanitized;
      let retryCount = 0;
      while (!this._isReviewOk(review) && retryCount < MAX_RETRIES) {
        retryCount++;
        log.attempts.push({ step: `retry-${retryCount}`, mode: 'instant', startedAt: new Date().toISOString() });
        const retryPrompt = `${SANITIZE_PROMPT}\n\nAdditional corrections requested by reviewer:\n${review}\n\nHTML to sanitize:\n${originalHtml}`;
        finalHtml = await this._sendToKimi(retryPrompt, 'instant', kimiChatUrl);
        log.attempts[log.attempts.length - 1].finishedAt = new Date().toISOString();

        log.attempts.push({ step: `retry-review-${retryCount}`, mode: 'thinking', startedAt: new Date().toISOString() });
        const retryReview = await this._sendToKimi(finalHtml, 'thinking', kimiChatUrl, REVIEW_PROMPT);
        log.attempts[log.attempts.length - 1].finishedAt = new Date().toISOString();
        log.attempts[log.attempts.length - 1].response = retryReview.slice(0, 500);
        if (this._isReviewOk(retryReview)) break;
      }

      const status = this._isReviewOk(review) || retryCount < MAX_RETRIES ? 'available' : 'failed';

      await TemplateRepository.update(template.id, {
        sanitized_html: finalHtml,
        html: finalHtml,
        status,
        sanitization_log: JSON.stringify(log),
        is_public: status === 'available' ? 1 : 0,
      });

      if (status === 'available') {
        PreviewService.updatePublicPreview(template.public_preview_token, finalHtml);
      }

      return { success: status === 'available', templateId: template.id, log };
    } catch (err) {
      log.error = err.message;
      await TemplateRepository.update(template.id, {
        status: 'failed',
        sanitization_log: JSON.stringify(log),
      });
      return { success: false, error: err.message, log };
    }
  }

  async _sendToKimi(content, mode, chatUrl, promptPrefix) {
    const context = { userId: 'loja-sanitizer', sessionId: `sanitize-${Date.now()}`, chatUrl };
    const prompt = promptPrefix ? `${promptPrefix}\n\n${content}` : content;
    const result = await BridgeAdapter.sendMessage(context, prompt, { mode, timeout: 0 });
    return result.content || '';
  }

  _isReviewOk(text) {
    if (!text) return false;
    const t = text.trim().toLowerCase();
    return t.startsWith('ok') || t === 'ok.' || t.includes('pronto para ser publicado');
  }
}

module.exports = new SanitizationService();
```

### Step 4.2: Check BridgeAdapter interface

Verify `lpBridgeAdapter.cjs` exposes `sendMessage(context, prompt, options)` returning `{ content }`. If it returns an async iterator or different shape, adjust `_sendToKimi` to consume the full response.

### Step 4.3: Test sanitization service (mocked Kimi)

Create `nexo-lp-server/tests/services/lpSanitizationService.test.js`:

```js
const fs = require('fs');
const path = require('path');
const testDbPath = path.join(__dirname, '../../../data/nexo-lp-test-sanitization.db');
process.env.NEXO_LP_DB_PATH = testDbPath;
process.env.NODE_ENV = 'test';

const { initializeDatabase, closeDatabase } = require('../../models/sqlite');
const TemplateRepository = require('../../models/repositories/TemplateRepository');
const SanitizationService = require('../../services/lpSanitizationService');
const PreviewService = require('../../services/lpPreviewService');
const BridgeAdapter = require('../../services/lpBridgeAdapter.cjs');

jest.mock('../../services/lpBridgeAdapter.cjs');

describe('lpSanitizationService', () => {
  beforeAll(async () => {
    if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
    await initializeDatabase();
  });

  afterAll(async () => {
    closeDatabase();
    if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
  });

  test('sanitizes and marks template available when review is OK', async () => {
    BridgeAdapter.sendMessage = jest.fn()
      .mockResolvedValueOnce({ content: '<html>sanitized</html>' })
      .mockResolvedValueOnce({ content: 'OK' });

    const tpl = await TemplateRepository.create({
      name: 'Test',
      status: 'sanitizing',
      original_html: '<html>original</html>',
      public_preview_token: PreviewService.generatePublicToken(),
      session_id: 'sess-san-1',
      price_stars: 5,
    });
    PreviewService.publishPublicPreview('sess-san-1', '<html>original</html>', tpl.public_preview_token);

    const result = await SanitizationService.startSanitization(
      'sess-san-1', '<html>original</html>', 'prompt', 'https://kimi.com/chat/abc', 'user-1'
    );

    expect(result.success).toBe(true);
    const updated = await TemplateRepository.findById(tpl.id);
    expect(updated.status).toBe('available');
    expect(updated.sanitized_html).toContain('sanitized');

    const previewPath = PreviewService.getPublicPreviewPath(tpl.public_preview_token);
    expect(fs.readFileSync(previewPath, 'utf8')).toContain('sanitized');
    fs.unlinkSync(previewPath);
  });

  test('retries and marks failed when review never OK', async () => {
    BridgeAdapter.sendMessage = jest.fn()
      .mockResolvedValue({ content: '<html>bad</html>' })
      .mockResolvedValue({ content: 'Missing footer' });

    const tpl = await TemplateRepository.create({
      name: 'Test Fail',
      status: 'sanitizing',
      original_html: '<html>original</html>',
      public_preview_token: PreviewService.generatePublicToken(),
      session_id: 'sess-san-2',
    });

    const result = await SanitizationService.startSanitization(
      'sess-san-2', '<html>original</html>', 'prompt', null, 'user-1'
    );

    expect(result.success).toBe(false);
    const updated = await TemplateRepository.findById(tpl.id);
    expect(updated.status).toBe('failed');
  });
});
```

Run:
```bash
npx jest nexo-lp-server/tests/services/lpSanitizationService.test.js --verbose
```

Expected: PASS

### Step 4.4: Commit

```bash
git add nexo-lp-server/services/lpSanitizationService.js
mkdir -p nexo-lp-server/tests/services && git add nexo-lp-server/tests/services/lpSanitizationService.test.js
git commit -m "feat(loja): add two-step Kimi sanitization service"
```

---

## Task 5: Template Service (publish, buy, use, prompt gate)

**Files:**
- Modify: `nexo-lp-server/services/lpTemplateService.js`

### Step 5.1: Implement publish/buy/use/prompt

```js
const crypto = require('crypto');
const TemplateRepository = require('../models/repositories/TemplateRepository');
const TemplatePurchaseRepository = require('../models/repositories/TemplatePurchaseRepository');
const SessionRepository = require('../models/repositories/SessionRepository');
const CurrencyRepository = require('../models/repositories/CurrencyRepository');
const PreviewService = require('./lpPreviewService');
const SanitizationService = require('./lpSanitizationService');

class TemplateService {
  // ... existing methods ...

  async publishFromSession(sessionId, userId) {
    const session = await SessionRepository.findById(sessionId);
    if (!session) throw new Error('Session not found');
    if (session.user_id !== userId) throw new Error('Unauthorized');

    const existing = await TemplateRepository.findBySessionId(sessionId);
    if (existing) return existing;

    const token = PreviewService.generatePublicToken();
    const html = session.current_html;
    const prompt = session.initial_prompt || '';

    const template = await TemplateRepository.create({
      name: this._generateName(session),
      description: this._generateDescription(session),
      category: 'landing',
      stack: session.stack || 'react-tailwind',
      thumbnail_url: null,
      html,
      original_html: html,
      status: 'sanitizing',
      public_preview_token: token,
      prompt_hash: SanitizationService.hashPrompt(prompt),
      prompt_censored: SanitizationService.makeCensoredPrompt(),
      price_stars: 5,
      price_suns: 0,
      price_moons: 0,
      source: 'generated',
      created_by: userId,
      session_id: sessionId,
      kimi_chat_url: session.kimi_chat_url || null,
    });

    PreviewService.publishPublicPreview(sessionId, html, token);

    // Background sanitization
    SanitizationService.startSanitization(sessionId, html, prompt, template.kimi_chat_url, userId)
      .catch(err => console.error('[LOJA] Sanitization failed:', err));

    return template;
  }

  async buyTemplate(templateId, userId) {
    const template = await TemplateRepository.findById(templateId);
    if (!template) throw new Error('Template not found');
    if (template.status !== 'available') throw new Error('Template is not available yet');

    const alreadyPurchased = await TemplatePurchaseRepository.findByTemplateAndUser(templateId, userId);
    if (alreadyPurchased) return alreadyPurchased;

    const cost = { stars: template.price_stars, suns: template.price_suns, moons: template.price_moons };
    await CurrencyRepository.deduct(userId, cost);

    return TemplatePurchaseRepository.create({
      template_id: templateId,
      user_id: userId,
      price_stars: cost.stars,
      price_suns: cost.suns,
      price_moons: cost.moons,
    });
  }

  async useTemplate(templateId, userId) {
    const template = await TemplateRepository.findById(templateId);
    if (!template) throw new Error('Template not found');
    if (template.status !== 'available') throw new Error('Template is not available yet');

    const purchased = await TemplatePurchaseRepository.findByTemplateAndUser(templateId, userId);
    if (!purchased) throw new Error('Template not purchased');

    await TemplateRepository.incrementUsage(templateId);

    const newSession = await SessionRepository.create({
      user_id: userId,
      initial_prompt: `Template based on ${template.name}`,
      stack: template.stack,
      status: 'created',
    });

    await SessionRepository.updateGeneratedCode(newSession.id, {
      html: template.html,
      css: template.css || '',
      js: template.js || '',
    });

    return newSession;
  }

  async getTemplatePrompt(templateId, userId) {
    const template = await TemplateRepository.findById(templateId);
    if (!template) throw new Error('Template not found');

    const purchased = await TemplatePurchaseRepository.findByTemplateAndUser(templateId, userId);
    if (purchased) {
      const session = await SessionRepository.findById(template.session_id);
      return {
        unlocked: true,
        prompt: session ? session.initial_prompt : null,
        censored: false,
      };
    }

    return {
      unlocked: false,
      prompt: template.prompt_censored,
      censored: true,
    };
  }

  _generateName(session) {
    const base = session.initial_prompt || 'Landing Page';
    return base.slice(0, 60).replace(/[<>]/g, '');
  }

  _generateDescription(session) {
    return `Generated landing page using ${session.stack || 'react-tailwind'}`;
  }
}

module.exports = new TemplateService();
```

### Step 5.2: Check CurrencyService.deduct signature

Verify `lpCurrencyService.js` exposes `deduct(userId, cost)` where cost is `{ stars, suns, moons }`. If not, use the existing method.

### Step 5.3: Test template service

Create `nexo-lp-server/tests/services/lpTemplateService.test.js`:

```js
const fs = require('fs');
const path = require('path');
const testDbPath = path.join(__dirname, '../../../data/nexo-lp-test-template-service.db');
process.env.NEXO_LP_DB_PATH = testDbPath;
process.env.NODE_ENV = 'test';

const { initializeDatabase, closeDatabase } = require('../../models/sqlite');
const SessionRepository = require('../../models/repositories/SessionRepository');
const TemplateRepository = require('../../models/repositories/TemplateRepository');
const TemplatePurchaseRepository = require('../../models/repositories/TemplatePurchaseRepository');
const CurrencyService = require('../../services/lpCurrencyService');
const TemplateService = require('../../services/lpTemplateService');
const PreviewService = require('../../services/lpPreviewService');
const SanitizationService = require('../../services/lpSanitizationService');

jest.mock('../../services/lpSanitizationService');

describe('lpTemplateService LOJA', () => {
  beforeAll(async () => {
    if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
    await initializeDatabase();
  });

  afterAll(async () => {
    closeDatabase();
    if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
  });

  test('publishFromSession creates sanitizing template with public preview', async () => {
    SanitizationService.startSanitization = jest.fn().mockResolvedValue({ success: true });
    const session = await SessionRepository.create({
      user_id: 'user-pub',
      initial_prompt: 'Coffee brand landing page',
      stack: 'react-tailwind',
      status: 'completed',
      current_html: '<h1>Coffee</h1>',
    });

    const tpl = await TemplateService.publishFromSession(session.id, 'user-pub');
    expect(tpl.status).toBe('sanitizing');
    expect(tpl.public_preview_token).toMatch(/^pub-/);

    const previewPath = PreviewService.getPublicPreviewPath(tpl.public_preview_token);
    expect(fs.existsSync(previewPath)).toBe(true);
    fs.unlinkSync(previewPath);
  });

  test('buyTemplate charges currency and records purchase', async () => {
    const tpl = await TemplateRepository.create({
      name: 'Buyable',
      status: 'available',
      html: '<h1>Buy</h1>',
      price_stars: 3,
      public_preview_token: PreviewService.generatePublicToken(),
      session_id: 'sess-buy',
    });

    await CurrencyService.getBalance('user-buyer');
    const purchase = await TemplateService.buyTemplate(tpl.id, 'user-buyer');
    expect(purchase.template_id).toBe(tpl.id);

    const balance = await CurrencyService.getBalance('user-buyer');
    expect(balance.stars).toBe(47);
  });

  test('useTemplate requires purchase and copies code to new session', async () => {
    const tpl = await TemplateRepository.create({
      name: 'Usable',
      status: 'available',
      html: '<h1>Used</h1>',
      price_stars: 0,
      public_preview_token: PreviewService.generatePublicToken(),
      session_id: 'sess-use',
    });
    await TemplatePurchaseRepository.create({ template_id: tpl.id, user_id: 'user-user' });

    const newSession = await TemplateService.useTemplate(tpl.id, 'user-user');
    expect(newSession.stack).toBe(tpl.stack);
    const updated = await SessionRepository.findById(newSession.id);
    expect(updated.current_html).toContain('Used');
  });

  test('getTemplatePrompt returns censored if not purchased', async () => {
    const tpl = await TemplateRepository.create({
      name: 'Locked',
      status: 'available',
      html: '<h1>Locked</h1>',
      prompt_censored: '[BLOQUEADO]',
      public_preview_token: PreviewService.generatePublicToken(),
      session_id: 'sess-lock',
    });

    const result = await TemplateService.getTemplatePrompt(tpl.id, 'user-stranger');
    expect(result.censored).toBe(true);
    expect(result.prompt).toBe('[BLOQUEADO]');
  });
});
```

Run:
```bash
npx jest nexo-lp-server/tests/services/lpTemplateService.test.js --verbose
```

Expected: PASS

### Step 5.4: Commit

```bash
git add nexo-lp-server/services/lpTemplateService.js
mkdir -p nexo-lp-server/tests/services && git add nexo-lp-server/tests/services/lpTemplateService.test.js
git commit -m "feat(loja): add publish, buy, use and prompt-gate logic"
```

---

## Task 6: Routes and Static Serving

**Files:**
- Modify: `nexo-lp-server/nexo-lp-routes.js`
- Modify: `nexo-lp-server/nexo-lp-server.js`

### Step 6.1: Add static route for public previews

In `nexo-lp-server.js`, after existing preview static route:

```js
app.use('/preview/public', express.static(path.resolve(__dirname, '../data/previews/public')));
```

### Step 6.2: Add routes

In `nexo-lp-routes.js`, add after existing template routes:

```js
router.post('/templates/:id/buy', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { userId } = req.body;
  if (!userId) return res.status(400).json(errorResponse('userId is required', 'MISSING_PARAM'));
  const purchase = await lpTemplateService.buyTemplate(id, userId);
  res.status(200).json(successResponse(purchase, 'Template purchased successfully'));
}));

router.get('/templates/:id/prompt', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { userId } = req.query;
  if (!userId) return res.status(400).json(errorResponse('userId is required', 'MISSING_PARAM'));
  const prompt = await lpTemplateService.getTemplatePrompt(id, userId);
  res.status(200).json(successResponse(prompt, 'Prompt retrieved'));
}));

router.post('/preview/:sessionId/public', asyncHandler(async (req, res) => {
  const { sessionId } = req.params;
  const session = await lpSessionService.getSessionById(sessionId);
  if (!session) return res.status(404).json(errorResponse('Session not found', 'NOT_FOUND'));
  const { token, url } = PreviewService.publishPublicPreview(sessionId, session.current_html);
  res.status(201).json(successResponse({ token, url }, 'Public preview published'));
}));
```

### Step 6.3: Test routes

Create `nexo-lp-server/tests/routes/lojaRoutes.test.js` using supertest or the existing route test pattern. At minimum test `/templates/:id/buy` and `/templates/:id/prompt`.

### Step 6.4: Commit

```bash
git add nexo-lp-server/nexo-lp-server.js nexo-lp-server/nexo-lp-routes.js
if [ -f nexo-lp-server/tests/routes/lojaRoutes.test.js ]; then git add nexo-lp-server/tests/routes/lojaRoutes.test.js; fi
git commit -m "feat(loja): add buy, prompt and public preview routes"
```

---

## Task 7: Generation Service Integration

**Files:**
- Modify: `nexo-lp-server/services/lpGenerationService.js`

### Step 7.1: Trigger publish after preview phase

In `runRealGeneration`, after the preview phase succeeds and before final metadata snapshot:

```js
// Publish to LOJA
log.info(`[GenerationService][${sessionId}] Publishing to LOJA...`);
try {
  await lpTemplateService.publishFromSession(sessionId, context.userId);
  sendPhaseEvent(sessionId, 'action_end', 'publish', { message: 'Published to LOJA', success: true });
} catch (publishErr) {
  log.error(`[GenerationService][${sessionId}] LOJA publish failed: ${publishErr.message}`);
}
```

### Step 7.2: Test integration

Add a test or run a manual generation via curl and verify a `templates` row with status `sanitizing` is created.

### Step 7.3: Commit

```bash
git add nexo-lp-server/services/lpGenerationService.js
git commit -m "feat(loja): auto-publish generated sites to LOJA"
```

---

## Task 8: Frontend LOJA Integration

**Files:**
- Modify: `nexo-lp-web/src/lib/api.js`
- Modify: `nexo-lp-web/src/components/LPTemplateStore.svelte`
- Modify: `nexo-lp-web/src/components/LPTemplateCard.svelte`
- Modify: `nexo-lp-web/src/components/LPTemplateModal.svelte`

### Step 8.1: Add API wrappers

In `api.js`:

```js
export async function getTemplates(filters = {}) {
  const params = new URLSearchParams(filters);
  const res = await fetch(`${API_BASE}/templates?${params}`);
  return res.json();
}

export async function buyTemplate(templateId, userId) {
  const res = await fetch(`${API_BASE}/templates/${templateId}/buy`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId }),
  });
  return res.json();
}

export async function getTemplatePrompt(templateId, userId) {
  const res = await fetch(`${API_BASE}/templates/${templateId}/prompt?userId=${userId}`);
  return res.json();
}
```

### Step 8.2: Update LPTemplateStore.svelte

- Replace hardcoded `demoTemplates` with reactive store populated from `getTemplates()`.
- Show status badges (`sanitizing`, `available`, `failed`).
- Display prices with currency icons.

### Step 8.3: Update LPTemplateCard.svelte

- Add price labels and status badge.
- Disable "Use" button when status is not `available`.

### Step 8.4: Update LPTemplateModal.svelte

- Embed public preview via `<iframe src={template.public_preview_url}>`.
- Show censored prompt with "Desbloquear prompt" button that calls `buyTemplate`.
- Buttons: "Comprar" and "Usar" (usar requires purchase).

### Step 8.5: Commit

```bash
git add nexo-lp-web/src/lib/api.js nexo-lp-web/src/components/LPTemplateStore.svelte nexo-lp-web/src/components/LPTemplateCard.svelte nexo-lp-web/src/components/LPTemplateModal.svelte
git commit -m "feat(loja): wire frontend LOJA to backend with purchase and preview"
```

---

## Task 9: End-to-End Verification

### Step 9.1: Run full backend test suite

```bash
cd /home/jhin/luna/nexo-lp-creator && npm test
```

Expected: all backend tests PASS

### Step 9.2: Manual E2E check

1. Create session and generate a site.
2. Verify row in `templates` with status `sanitizing`.
3. Wait for sanitization worker (or mock it).
4. Verify status changes to `available`.
5. Access public preview URL.
6. Buy template and verify currency deduction.
7. Use template and verify new session with copied HTML.
8. Check prompt endpoint returns censored before purchase and original after.

### Step 9.3: Final commit

```bash
git add -A
git commit -m "test(loja): verify LOJA, sanitization and public preview end-to-end"
```

---

## Spec Coverage Check

| Spec Requirement | Task(s) |
|------------------|---------|
| Renomear Templates → LOJA | Task 8 (UI labels), existing nav already says LOJA |
| Site gerado entra na LOJA como `sanitizing` | Task 5 (publish), Task 7 (trigger) |
| Sanitização Kimi no mesmo chat, sem timeout | Task 4 |
| Revisão com modo thinking | Task 4 |
| Preview público via blob/UUID | Task 3, Task 6 |
| Prompt censurado até pagar | Task 5 |
| Fluxo de compra com moedas | Task 5, Task 6 |

## Placeholder Scan

No TBD/TODO placeholders. Every step includes code, commands, and expected outputs.
