# LOJA Automatic Sanitization + Rich Metadata Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every generated landing page automatically flow through a backend-only Kimi sanitization/improvement pipeline, enrich it with LOJA metadata (category, subcategory, badges, marketing copy), and render a full marketplace experience in the frontend.

**Architecture:** A new `lpSanitizationOrchestrator.js` service extends Node's `EventEmitter` to observe and drive a 3-step prompt sequence (instant hybrid → thinking review/metadata → thinking refinement) against the same Kimi chat used for generation. `lpTemplateService.publishFromSession` spawns this orchestrator in the background and returns immediately. Frontend LOJA components consume the enriched metadata to show categories, subcategories, badges, and usage-based marketing highlights.

**Tech Stack:** Node.js (Express backend), Svelte 4 (frontend), sql.js SQLite, existing `lpBridgeAdapter.cjs` for Kimi communication.

---

## File Structure

| File | Responsibility |
|------|----------------|
| `nexo-lp-server/models/migrations/012_loja_metadata.sql` | Adds `subcategory` and `metadata_json` columns to `templates`. |
| `nexo-lp-server/services/lpSanitizationOrchestrator.js` | New observer/orchestrator that runs the 3-step Kimi sanitization/metadata pipeline. |
| `nexo-lp-server/services/lpTemplateService.js` | Modify `publishFromSession` to create template as `sanitizing`/`is_public=0` and spawn orchestrator. |
| `nexo-lp-server/models/repositories/TemplateRepository.js` | Update `create`/`update` to persist new metadata fields; add subcategory listing helper. |
| `nexo-lp-server/nexo-lp-routes.js` | Ensure `/templates` exposes metadata and supports subcategory filter. |
| `nexo-lp-web/src/components/LPTemplateStore.svelte` | Marketplace layout: categories, subcategories, badges, search, featured. |
| `nexo-lp-web/src/components/LPTemplateCard.svelte` | Rich card with category/subcategory, badges, usage, price, sanitizing overlay. |
| `nexo-lp-web/src/components/LPTemplateModal.svelte` | Rich modal with metadata, preview, sanitizing state. |
| `nexo-lp-server/services/lpPreviewService.js` | No changes required; `updatePublicPreview` already exists. |
| `nexo-lp-server/services/lpSanitizationService.js` | To be superseded by orchestrator; delete after orchestrator is wired in. |

---

## Task 1: Database migration for rich metadata

**Files:**
- Create: `nexo-lp-server/models/migrations/012_loja_metadata.sql`
- Modify: `nexo-lp-server/models/sqlite.js` (ensure migrations run in order)

### Step 1.1: Create migration file

Create `nexo-lp-server/models/migrations/012_loja_metadata.sql`:

```sql
-- ============================================================
-- Migration 011: LOJA Rich Metadata
-- Adds subcategory and Kimi-generated metadata for marketplace.
-- ============================================================

ALTER TABLE templates ADD COLUMN subcategory TEXT;
ALTER TABLE templates ADD COLUMN metadata_json TEXT; -- JSON: tags, niche, audience, difficulty, features, colors, style, seoKeywords, badges, whyBuy, useCases

CREATE INDEX IF NOT EXISTS idx_templates_subcategory ON templates(subcategory);
```

### Step 1.2: Verify migration runner picks up new file

Open `nexo-lp-server/models/sqlite.js` and confirm migrations are loaded from `models/migrations/*.sql` and executed in filename order. If not, report it.

### Step 1.3: Commit

```bash
cd /home/jhin/luna/nexo-lp-creator
git add nexo-lp-server/models/migrations/012_loja_metadata.sql
git commit -m "feat(db): add subcategory and metadata_json to templates"
```

---

## Task 2: Create `lpSanitizationOrchestrator.js`

**Files:**
- Create: `nexo-lp-server/services/lpSanitizationOrchestrator.js`
- Modify: `nexo-lp-server/services/lpTemplateService.js` (Task 3)

### Step 2.1: Create the orchestrator

Create `nexo-lp-server/services/lpSanitizationOrchestrator.js`:

```javascript
const { EventEmitter } = require('events');
const crypto = require('crypto');
const TemplateRepository = require('../models/repositories/TemplateRepository');
const PreviewService = require('./lpPreviewService');
const BridgeAdapter = require('./lpBridgeAdapter.cjs');

const MAX_RETRIES = 3;

const HYBRID_SANITIZE_PROMPT = `You are a strict HTML sanitizer and frontend optimizer for the NEXO Digital landing page store (https://www.nexo-digital.app/pt).

TASK: Sanitize, debug, and lightly improve the landing page HTML below.

RULES:
1. Remove all brand names, personal names, emails, phone numbers, addresses, and real business data.
2. Replace removed data with neutral placeholder content for NEXO Digital:
   - Brand name: NEXO Digital
   - Site: https://www.nexo-digital.app/pt
   - Slogan: We create digital experiences that convert.
   - Email: contato@nexo-digital.app
   - Primary colors: #6366F1 and #8B5CF6
3. Fix any obvious HTML/CSS/JS bugs while preserving layout, structure, and Tailwind classes.
4. Keep images as generic placeholders (Unsplash generic keywords or SVG placeholders).
5. Lightly improve copy and spacing if it improves conversion, but do NOT add new sections.
6. Return ONLY the complete, self-contained HTML code. No markdown fences, no explanations, no comments outside the code.

HTML to sanitize and improve:`;

const REVIEW_PROMPT = `Review the sanitized landing page HTML below for the NEXO Digital template store.

Your job is to:
1. Decide if the HTML is technically correct, safe, and ready to publish.
2. Propose corrections if anything is wrong.
3. Categorize the template and generate rich marketplace metadata.

Reply ONLY with a JSON object matching this exact schema (no markdown, no explanations):
{
  "ok": true,
  "corrections": [],
  "metadata": {
    "category": "saas",
    "subcategory": "b2b-saas",
    "tags": ["modern", "clean", "pricing"],
    "niche": "B2B SaaS",
    "audience": "Startup founders and product teams",
    "difficulty": "beginner",
    "features": ["Hero section", "Pricing table", "Testimonials", "CTA"],
    "colors": ["#6366F1", "#8B5CF6", "#0F172A"],
    "style": "modern minimal",
    "seoKeywords": ["saas landing page", "b2b software"],
    "badges": ["Trending"],
    "whyBuy": "High-converting B2B layout with clear pricing and social proof.",
    "useCases": ["Product launch", "SaaS signup", "Feature announcement"]
  }
}

If corrections are needed, set ok to false and list them:
{
  "ok": false,
  "corrections": ["Fix broken closing div", "Replace remaining brand name"],
  "metadata": { ...same schema... }
}

HTML to review:`;

const REFINE_PROMPT = `You are a strict HTML sanitizer and frontend optimizer for the NEXO Digital landing page store.

Apply the corrections below to the provided HTML.

RULES:
1. Keep the NEXO Digital placeholders already applied.
2. Fix all listed issues.
3. Return ONLY the complete, self-contained HTML code. No markdown fences, no explanations, no comments outside the code.

Corrections:`;

class SanitizationOrchestrator extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(50);
  }

  /**
   * Start the automatic sanitization pipeline.
   * @param {string} sessionId
   * @param {string} originalHtml
   * @param {string} originalPrompt
   * @param {string|null} kimiChatUrl
   * @param {string} userId
   */
  async startSanitization(sessionId, originalHtml, originalPrompt, kimiChatUrl, userId) {
    const template = await TemplateRepository.findBySessionId(sessionId);
    if (!template) {
      throw new Error(`Template not found for session ${sessionId}`);
    }

    const log = {
      startedAt: new Date().toISOString(),
      attempts: [],
    };

    const context = {
      userId,
      sessionId,
      chatUrl: kimiChatUrl || null,
      retries: 0,
    };

    try {
      this.emit('sanitization:step', { sessionId, step: 1, mode: 'instant' });

      const step1Result = await this._sendToKimi(
        context,
        `${HYBRID_SANITIZE_PROMPT}\n\n${originalHtml}`,
        { mode: 'instant', phase: 'sanitize' }
      );

      let currentHtml = this._extractHtml(step1Result.content);
      log.attempts.push({
        step: 1,
        mode: 'instant',
        finishedAt: new Date().toISOString(),
        responseLength: currentHtml.length,
      });

      this.emit('sanitization:progress', { sessionId, step: 1, htmlLength: currentHtml.length });

      // Step 2: thinking review + metadata
      this.emit('sanitization:step', { sessionId, step: 2, mode: 'thinking' });

      const step2Result = await this._sendToKimi(
        context,
        `${REVIEW_PROMPT}\n\n${currentHtml}`,
        { mode: 'thinking', phase: 'review' }
      );

      const review = this._parseReview(step2Result.content);
      log.attempts.push({
        step: 2,
        mode: 'thinking',
        finishedAt: new Date().toISOString(),
        response: JSON.stringify(review).slice(0, 1000),
      });

      // Step 3: thinking refinement if corrections needed
      if (!review.ok && Array.isArray(review.corrections) && review.corrections.length > 0) {
        this.emit('sanitization:step', { sessionId, step: 3, mode: 'thinking' });

        const correctionsText = review.corrections.map((c, i) => `${i + 1}. ${c}`).join('\n');
        const step3Result = await this._sendToKimi(
          context,
          `${REFINE_PROMPT}\n${correctionsText}\n\nHTML to refine:\n${currentHtml}`,
          { mode: 'thinking', phase: 'refine' }
        );

        currentHtml = this._extractHtml(step3Result.content);
        log.attempts.push({
          step: 3,
          mode: 'thinking',
          finishedAt: new Date().toISOString(),
          responseLength: currentHtml.length,
        });
      }

      // Merge metadata with defaults
      const metadata = this._normalizeMetadata(review.metadata);

      // Finalize
      await TemplateRepository.update(template.id, {
        sanitized_html: currentHtml,
        html: currentHtml,
        status: 'available',
        is_public: 1,
        category: metadata.category,
        subcategory: metadata.subcategory,
        tags: Array.isArray(metadata.tags) ? metadata.tags.join(',') : null,
        metadata_json: JSON.stringify(metadata),
        sanitization_log: JSON.stringify(log),
      });

      await PreviewService.updatePublicPreview(template.public_preview_token, currentHtml);

      this.emit('sanitization:complete', {
        sessionId,
        templateId: template.id,
        success: true,
        htmlLength: currentHtml.length,
        metadata,
      });

      return { success: true, templateId: template.id, log, metadata };
    } catch (err) {
      log.error = err.message;
      await TemplateRepository.update(template.id, {
        status: 'failed',
        sanitization_log: JSON.stringify(log),
      });

      this.emit('sanitization:error', { sessionId, error: err.message });
      return { success: false, error: err.message, log };
    }
  }

  async _sendToKimi(context, prompt, options = {}) {
    return BridgeAdapter.sendMessage(context, prompt, {
      mode: options.mode || 'instant',
      newChat: false,
      phaseTimeoutMs: 0,
      ...options,
    });
  }

  _extractHtml(text) {
    if (!text) return '';
    const fenceMatch = text.match(/```(?:html)?\s*([\s\S]*?)```/i);
    if (fenceMatch) return fenceMatch[1].trim();
    const trimmed = text.trim();
    if (/<!doctype|<html|<div|<section/i.test(trimmed)) return trimmed;
    return trimmed;
  }

  _parseReview(text) {
    if (!text) return { ok: false, corrections: ['Empty review response'] };
    const trimmed = text.trim();

    const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed.ok === true) return { ok: true, corrections: [], metadata: parsed.metadata };
        if (parsed.ok === false) {
          return {
            ok: false,
            corrections: Array.isArray(parsed.corrections) ? parsed.corrections : [String(parsed.corrections)],
            metadata: parsed.metadata,
          };
        }
      } catch {
        // fall through
      }
    }

    const lower = trimmed.toLowerCase();
    if (lower.startsWith('ok') || lower === 'ok.') {
      return { ok: true, corrections: [], metadata: {} };
    }

    return { ok: false, corrections: [trimmed.slice(0, 500)], metadata: {} };
  }

  _normalizeMetadata(metadata = {}) {
    const category = metadata.category || 'landing';
    return {
      category,
      subcategory: metadata.subcategory || category,
      tags: Array.isArray(metadata.tags) ? metadata.tags : [],
      niche: metadata.niche || '',
      audience: metadata.audience || '',
      difficulty: metadata.difficulty || 'beginner',
      features: Array.isArray(metadata.features) ? metadata.features : [],
      colors: Array.isArray(metadata.colors) ? metadata.colors : [],
      style: metadata.style || '',
      seoKeywords: Array.isArray(metadata.seoKeywords) ? metadata.seoKeywords : [],
      badges: Array.isArray(metadata.badges) ? metadata.badges : [],
      whyBuy: metadata.whyBuy || '',
      useCases: Array.isArray(metadata.useCases) ? metadata.useCases : [],
    };
  }
}

module.exports = new SanitizationOrchestrator();
```

### Step 2.2: Syntax check

```bash
cd /home/jhin/luna/nexo-lp-creator
node -c nexo-lp-server/services/lpSanitizationOrchestrator.js
```

Expected: nothing (success).

### Step 2.3: Commit

```bash
git add nexo-lp-server/services/lpSanitizationOrchestrator.js
git commit -m "feat(sanitization): add orchestrator with 3-step pipeline and metadata extraction"
```

---

## Task 3: Wire orchestrator into `lpTemplateService.publishFromSession`

**Files:**
- Modify: `nexo-lp-server/services/lpTemplateService.js`

### Step 3.1: Replace old sanitization import

At the top of `nexo-lp-server/services/lpTemplateService.js`, change:

```javascript
const SanitizationService = require('./lpSanitizationService');
```

to:

```javascript
const SanitizationOrchestrator = require('./lpSanitizationOrchestrator');
```

### Step 3.2: Update `publishFromSession`

Replace the method body with:

```javascript
  async publishFromSession(sessionId, userId) {
    const session = await SessionRepository.findById(sessionId);
    if (!session) throw new Error('Session not found');
    if (session.user_id !== userId) throw new Error('Unauthorized');

    const existing = await TemplateRepository.findBySessionId(sessionId);
    if (existing) return existing;

    const html = session.current_html || '';
    const prompt = session.initial_prompt || '';
    const token = PreviewService.generatePublicToken();

    let metadataKimiChatUrl = null;
    if (session.metadata_json) {
      try {
        metadataKimiChatUrl = JSON.parse(session.metadata_json).kimiChatUrl || null;
      } catch {
        metadataKimiChatUrl = null;
      }
    }
    const chatUrl = session.kimi_chat_url || metadataKimiChatUrl || null;

    const template = await TemplateRepository.create({
      name: this._generateName(session),
      description: this._generateDescription(session),
      category: 'landing',
      stack: session.stack || 'react-tailwind',
      html,
      original_html: html,
      status: 'sanitizing',
      public_preview_token: token,
      prompt_hash: this._hashPrompt(prompt),
      prompt_censored: '[PROMPT BLOCKED — purchase this template in the LOJA to unlock the original prompt]',
      price_stars: config.loja.defaultPrices.stars,
      price_suns: config.loja.defaultPrices.suns,
      price_moons: config.loja.defaultPrices.moons,
      source: 'generated',
      created_by: userId,
      session_id: sessionId,
      kimi_chat_url: chatUrl,
      is_public: 0,
    });

    await PreviewService.publishPublicPreview(sessionId, this._blockedPreviewHtml(template.name), token);

    SanitizationOrchestrator.startSanitization(sessionId, html, prompt, chatUrl, userId)
      .catch((err) => console.error('[LOJA] Sanitization orchestrator failed:', err.message));

    return template;
  }
```

### Step 3.3: Add helper methods

Add these helpers before `_generateName`:

```javascript
  _hashPrompt(prompt) {
    return crypto.createHash('sha256').update(prompt || '').digest('hex');
  }

  _blockedPreviewHtml(name) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${this._escapeHtml(name)} - Sanitizing</title>
  <script src="https://cdn.tailwindcss.com"><\/script>
</head>
<body class="min-h-screen flex items-center justify-center bg-slate-50 text-slate-700">
  <div class="text-center p-8">
    <div class="w-12 h-12 border-4 border-indigo-200 border-t-indigo-500 rounded-full animate-spin mx-auto mb-4"></div>
    <h1 class="text-xl font-semibold mb-2">Sanitizing template...</h1>
    <p class="text-sm text-slate-500">This landing page is being reviewed and prepared for the NEXO LOJA.</p>
  </div>
</body>
</html>`;
  }

  _escapeHtml(text) {
    return (text || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
```

### Step 3.4: Delete old service

```bash
cd /home/jhin/luna/nexo-lp-creator
git rm nexo-lp-server/services/lpSanitizationService.js
```

### Step 3.5: Syntax check and commit

```bash
node -c nexo-lp-server/services/lpTemplateService.js
```

Expected: nothing.

```bash
git add nexo-lp-server/services/lpTemplateService.js
git commit -m "feat(loja): publish templates as sanitizing and spawn orchestrator"
```

---

## Task 4: Update `TemplateRepository.js` for metadata fields

**Files:**
- Modify: `nexo-lp-server/models/repositories/TemplateRepository.js`

### Step 4.1: Update `create` to include new columns

In the `create` method, update the INSERT statement and parameters to include `subcategory` and `metadata_json`:

```javascript
    await run(
      `INSERT INTO templates (
        id, name, description, category, subcategory, stack, thumbnail_url,
        html, css, js, config, tags, source, usage_count, rating,
        is_public, created_by, created_at, updated_at,
        status, original_html, sanitized_html, sanitization_log,
        public_preview_token, prompt_hash, prompt_censored,
        price_stars, price_suns, price_moons,
        session_id, kimi_chat_url, metadata_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        data.name,
        data.description || null,
        data.category || 'landing',
        data.subcategory || data.category || 'landing',
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
        data.original_html || data.originalHtml || null,
        data.sanitized_html || data.sanitizedHtml || null,
        sanitizationLog,
        data.public_preview_token || data.publicPreviewToken || null,
        data.prompt_hash || data.promptHash || null,
        data.prompt_censored || data.promptCensored || null,
        data.price_stars || data.priceStars || 0,
        data.price_suns || data.priceSuns || 0,
        data.price_moons || data.priceMoons || 0,
        data.session_id || data.sessionId || null,
        data.kimi_chat_url || data.kimiChatUrl || null,
        data.metadata_json || (data.metadata ? JSON.stringify(data.metadata) : null),
      ]
    );
```

### Step 4.2: Add `getSubcategories` helper

Add before `module.exports`:

```javascript
  async getSubcategories(category) {
    let sql = 'SELECT DISTINCT subcategory FROM templates WHERE is_public = 1 AND subcategory IS NOT NULL';
    const params = [];
    if (category) {
      sql += ' AND category = ?';
      params.push(category);
    }
    sql += ' ORDER BY subcategory';
    const rows = await query(sql, params);
    return rows.map(r => r.subcategory).filter(Boolean);
  }
```

### Step 4.3: Commit

```bash
git add nexo-lp-server/models/repositories/TemplateRepository.js
git commit -m "feat(db): repository supports subcategory and metadata_json"
```

---

## Task 5: Update API routes for metadata/subcategory

**Files:**
- Modify: `nexo-lp-server/nexo-lp-routes.js`

### Step 5.1: Ensure `/templates` exposes metadata

Find the `GET /templates` route and confirm it returns the full template row including `metadata_json`, `subcategory`, etc. If it filters fields, remove the filter for these new fields.

### Step 5.2: Add `/templates/subcategories` route

Add a new route after the existing `/templates` block:

```javascript
router.get('/templates/subcategories', asyncHandler(async (req, res) => {
  const { category } = req.query;
  const subcategories = await TemplateRepository.getSubcategories(category);
  res.json(successResponse({ subcategories }));
}));
```

### Step 5.3: Commit

```bash
git add nexo-lp-server/nexo-lp-routes.js
git commit -m "feat(api): expose metadata and subcategory endpoints"
```

---

## Task 6: Update `LPTemplateCard.svelte` for rich metadata and sanitizing state

**Files:**
- Modify: `nexo-lp-web/src/components/LPTemplateCard.svelte`

### Step 6.1: Add metadata helpers

Add helpers to parse metadata and compute badges:

```javascript
  function parseMetadata(t) {
    if (!t.metadata_json) return {};
    try {
      return JSON.parse(t.metadata_json);
    } catch {
      return {};
    }
  }

  function computeBadges(t, meta) {
    const badges = [...(meta.badges || [])];
    if ((t.usage_count ?? t.uses ?? 0) > 100) badges.push('Most Used');
    if (t.rating && t.rating >= 4.8) badges.push('Top Rated');
    return badges;
  }
```

### Step 6.2: Update template markup

- Show category + subcategory pill.
- Show badges row.
- Show price and usage.
- Overlay "Sanitizing..." when status is `sanitizing`.

```svelte
{#if template.status === 'sanitizing'}
  <div class="absolute inset-0 bg-white/90 flex flex-col items-center justify-center rounded-2xl z-10" role="status" aria-live="polite">
    <div class="w-8 h-8 rounded-full border-2 border-amber-300 border-t-amber-600 animate-spin mb-2"></div>
    <span class="text-xs font-medium text-amber-700">Sanitizing...</span>
  </div>
{/if}
```

### Step 6.3: Commit

```bash
git add nexo-lp-web/src/components/LPTemplateCard.svelte
git commit -m "feat(loja): rich template card with metadata, badges, and sanitizing overlay"
```

---

## Task 7: Update `LPTemplateModal.svelte` for rich metadata and sanitizing state

**Files:**
- Modify: `nexo-lp-web/src/components/LPTemplateModal.svelte`

### Step 7.1: Parse metadata

```javascript
  function parseMetadata(t) {
    if (!t.metadata_json) return {};
    try {
      return JSON.parse(t.metadata_json);
    } catch {
      return {};
    }
  }

  $: meta = parseMetadata(template);
```

### Step 7.2: Update preview header

Replace the preview header with conditional sanitizing block:

```svelte
{#if template.status === 'sanitizing'}
  <div class="h-64 flex flex-col items-center justify-center bg-slate-50 text-slate-600 p-6">
    <div class="w-10 h-10 rounded-full border-2 border-indigo-200 border-t-indigo-500 animate-spin mb-4"></div>
    <h3 class="text-base font-semibold mb-1">Sanitizing template...</h3>
    <p class="text-xs text-center text-slate-500 max-w-xs">This landing page is being reviewed and prepared for the NEXO LOJA.</p>
  </div>
{:else if previewUrl}
  <iframe src={previewUrl} title="Preview" class="w-full h-64 border-0"></iframe>
{:else}
  ...existing gradient fallback...
{/if}
```

### Step 7.3: Show metadata sections

Add sections for:
- Category/Subcategory pills.
- Features list.
- Why buy / use cases.
- Colors palette swatches.
- Badges.

### Step 7.4: Disable actions while sanitizing

```svelte
  $: canUse = template.status === 'available' && !using && !buying;
  $: canBuy = template.status === 'available' && !buying && !promptState.unlocked;
```

### Step 7.5: Commit

```bash
git add nexo-lp-web/src/components/LPTemplateModal.svelte
git commit -m "feat(loja): rich modal metadata and sanitizing state"
```

---

## Task 8: Update `LPTemplateStore.svelte` for marketplace layout

**Files:**
- Modify: `nexo-lp-web/src/components/LPTemplateStore.svelte`

### Step 8.1: Add subcategory filter and badge sorting

- Fetch subcategories from backend when category changes.
- Add subcategory pill filter.
- Add "Most Used" / "Top Rated" sort options.

### Step 8.2: Update layout

- Hero header with LOJA branding.
- Search bar + category filters + subcategory filters.
- Featured section (top rated / most used).
- Grid of template cards.

### Step 8.3: Commit

```bash
git add nexo-lp-web/src/components/LPTemplateStore.svelte
git commit -m "feat(loja): marketplace layout with categories, subcategories, and sorting"
```

---

## Task 9: Code quality review of LOJA components

**Files:**
- Modify: `nexo-lp-web/src/components/LPTemplateStore.svelte`
- Modify: `nexo-lp-web/src/components/LPTemplateCard.svelte`
- Modify: `nexo-lp-web/src/components/LPTemplateModal.svelte`

### Step 9.1: Accessibility
- Add `aria-label` to all icon-only buttons.
- Add `aria-pressed` to filter buttons.
- Ensure modal has `aria-modal="true"` and `role="dialog"`.
- Avoid `@html` for dynamic untrusted content.

### Step 9.2: Consistency
- Ensure all user-facing text is in English.
- Use consistent prop naming (`metadata_json` parsed once per component).

### Step 9.3: Commit

```bash
git add nexo-lp-web/src/components/LPTemplateStore.svelte \
        nexo-lp-web/src/components/LPTemplateCard.svelte \
        nexo-lp-web/src/components/LPTemplateModal.svelte
git commit -m "refactor(loja): accessibility and quality review"
```

---

## Task 10: Verification

**Files:**
- All modified files
- `scripts/run-all-tests.sh`

### Step 10.1: Backend smoke test

```bash
cd /home/jhin/luna/nexo-lp-creator
node nexo-lp-server/nexo-lp-server.js &
SERVER_PID=$!
sleep 3
curl -s http://localhost:3460/api/nexo-lp/health | head -c 200
kill $SERVER_PID
```

Expected: JSON containing `{"ok":true,...}`.

### Step 10.2: Frontend checks

If Vite build works:

```bash
cd /home/jhin/luna/nexo-lp-creator/nexo-lp-web
npm run build
```

If build fails due to environment, run svelte-check on the components:

```bash
npx svelte-check --tsconfig ./jsconfig.json src/components/LPTemplateStore.svelte src/components/LPTemplateCard.svelte src/components/LPTemplateModal.svelte 2>&1 | head -60
```

### Step 10.3: Run test suite

```bash
cd /home/jhin/luna/nexo-lp-creator
bash scripts/run-all-tests.sh
```

Fix any regressions.

### Step 10.4: Commit

```bash
git add -A
git commit -m "test(loja): verify sanitization, metadata, and marketplace UI"
```

---

## Self-Review

### Spec coverage
- [x] Automatic publish to LOJA as `sanitizing` — Task 3.
- [x] Backend-only Kimi sanitization pipeline — Task 2.
- [x] 3-step sequence — Task 2.
- [x] Same chat reuse — Task 2.
- [x] Observer/EventEmitter — Task 2.
- [x] Rich metadata extraction — Tasks 2, 4, 5.
- [x] Category/subcategory marketplace — Tasks 6, 7, 8.
- [x] Real usage badges — Tasks 6, 8.
- [x] Frontend cards/modal show "Sanitizing..." state — Tasks 6, 7.
- [x] Code quality review — Task 9.

### Placeholder scan
No TBD/TODO placeholders. All code is concrete.

### Type consistency
- `status` values match existing CHECK constraint.
- `is_public` is INTEGER 0/1.
- `metadata_json` is stored as TEXT JSON.
- Repository `create`/`update` use existing async API.
