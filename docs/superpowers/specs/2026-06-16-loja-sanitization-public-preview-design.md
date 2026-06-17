# Design: LOJA + Automatic Kimi Sanitization + Rich Metadata

## Approved by
User on 2026-06-17 (chat approval).

## Scope
Implement Part E.8 adjustments for NEXO LP Creator v3.0:
1. Every user-generated landing page is **automatically** published to the public LOJA with `status = 'sanitizing'`.
2. The backend sanitizes the HTML via Kimi in the **same chat** used for generation, without frontend intervention.
3. Sanitization is a **3-step pipeline** orchestrated by an observer/EventEmitter:
   - Step 1 (`instant`): hybrid prompt — sanitize PII/branding, replace with NEXO Digital identity, fix bugs, improve copy/design.
   - Step 2 (`thinking`): review sanitized HTML and return **structured JSON** with quality verdict, corrections, and rich LOJA metadata (category, subcategory, tags, marketing badges, design tokens).
   - Step 3 (`thinking`, conditional): apply corrections and return the final HTML.
4. After successful sanitization, the template becomes `available`, `is_public = 1`, and the public preview is unlocked.
5. The LOJA becomes a full marketplace experience: categories/subcategories, real usage badges, marketing highlights, brand-aligned visual identity.
6. While sanitizing, LOJA cards show the template name and a "Sanitizing..." state with a disabled preview.
7. Code-quality review of LOJA components.

> The TODO-CLONADO mentioned `template_type: 'public'` and `status: 'active'`. The actual schema uses `is_public` (INTEGER) and `status` with CHECK `('sanitizing'|'available'|'failed')`, so this design follows the real schema.

## Data flow

```
User generates landing page
    │
    ▼
[lpGenerationService] ──► saves local preview
    │                      creates Template in LOJA (status = sanitizing, is_public = 0)
    │                      public_preview_url = /preview/public/{uuid}.html (placeholder/blocked)
    │
    ▼
[lpSanitizationOrchestrator]
    │
  step 1: mode = instant
    │   sends original HTML + hybrid sanitization/improvement prompt to same Kimi chat
    │   receives sanitized/improved HTML
    │
  step 2: mode = thinking
    │   sends updated HTML + review/metadata prompt
    │   receives JSON with ok/corrections + category/subcategory/tags/badges/design tokens
    │
  step 3: mode = thinking  (only if corrections needed)
    │   sends updated HTML + corrections + final refinement prompt
    │   receives final HTML
    │
    ▼
[lpSanitizationOrchestrator] ──► saves sanitized_html + rich metadata
                                  updates Template status = available, is_public = 1
                                  updates public preview with sanitized HTML
    │
    ▼
User sees item in LOJA as available with category, subcategory, badges, and preview unlocked
```

## Database

### Table `templates` (existing, expanded)
| Field | Type | Description |
|-------|------|-------------|
| `id` | TEXT PK | UUID |
| `name` | TEXT | Auto-generated name |
| `description` | TEXT | Short description |
| `category` | TEXT | Top-level category (e.g. saas, clinic, ecommerce) |
| `subcategory` | TEXT | Sub-category (e.g. b2b-saas, dental-clinic, fashion-store) |
| `stack` | TEXT | react-tailwind, etc. |
| `thumbnail_url` | TEXT | Thumbnail URL |
| `html` | TEXT | Final public HTML (sanitized) |
| `css` | TEXT | Extra CSS |
| `js` | TEXT | Extra JS |
| `original_html` | TEXT | HTML before sanitization |
| `sanitized_html` | TEXT | HTML after sanitization |
| `sanitization_log` | TEXT (JSON) | Attempts, errors, timings |
| `metadata_json` | TEXT (JSON) | Rich Kimi-generated metadata: tags, audience, niche, difficulty, colors, features, badges, seoKeywords, whyBuy, useCases |
| `status` | TEXT | `sanitizing` \| `available` \| `failed` |
| `public_preview_token` | TEXT | UUID for public preview |
| `prompt_hash` | TEXT | SHA-256 of original prompt |
| `prompt_censored` | TEXT | Censored placeholder prompt |
| `price_stars` | INTEGER | Price in stars |
| `price_suns` | INTEGER | Price in suns |
| `price_moons` | INTEGER | Price in moons |
| `source` | TEXT | `generated` \| `mined` \| `manual` |
| `created_by` | TEXT | user_id of creator |
| `session_id` | TEXT | FK to sessions |
| `kimi_chat_url` | TEXT | Kimi chat URL used |
| `is_public` | INTEGER | 1 when available |
| `created_at` | DATETIME | timestamp |
| `updated_at` | DATETIME | timestamp |

### New migration `012_loja_metadata.sql`
```sql
ALTER TABLE templates ADD COLUMN subcategory TEXT;
ALTER TABLE templates ADD COLUMN metadata_json TEXT;
CREATE INDEX IF NOT EXISTS idx_templates_subcategory ON templates(subcategory);
```

### Table `template_purchases` (existing)
| Field | Type | Description |
|-------|------|-------------|
| `id` | TEXT PK | UUID |
| `template_id` | TEXT FK | Purchased template |
| `user_id` | TEXT | Buyer |
| `price_stars` | INTEGER | Paid amount |
| `price_suns` | INTEGER | Paid amount |
| `price_moons` | INTEGER | Paid amount |
| `created_at` | DATETIME | timestamp |

## Services

### `lpSanitizationOrchestrator.js` (new)
- Extends `EventEmitter` to act as the internal observer.
- `startSanitization(sessionId, originalHtml, originalPrompt, kimiChatUrl, userId)`
  - Creates a sanitization context reusing the same `userId` and `chatUrl` from the original generation session (continues in the same Kimi chat).
  - Emits events: `sanitization:step`, `sanitization:progress`, `sanitization:complete`, `sanitization:error`.
  - **Step 1 (instant):** sends hybrid prompt + original HTML. Expects **only full HTML code** in return.
  - **Step 2 (thinking):** sends review/metadata prompt + sanitized HTML. Expects **JSON** with:
    - `ok: boolean`
    - `corrections?: string[]`
    - `metadata: { category, subcategory, tags, niche, audience, difficulty, features, colors, style, seoKeywords, badges, whyBuy, useCases }`
  - **Step 3 (thinking, conditional):** if corrections exist, sends refinement prompt + current HTML + corrections. Expects **only full HTML code**.
  - Extracts HTML from markdown code blocks or raw response.
  - On success: updates template to `status = 'available'`, `is_public = 1`, saves `sanitized_html`, `html`, `metadata_json`, `category`, `subcategory`, and `sanitization_log`, updates public preview file.
  - On failure after retries: updates template to `status = 'failed'` and persists error log.
  - No hard timeout; relies on bridge-level timeout configuration.

### `lpTemplateService.js` (modify)
- `publishFromSession(sessionId, userId)`
  - Validates session ownership.
  - Creates template with `status = 'sanitizing'`, `is_public = 0`.
  - Generates `public_preview_token`.
  - Publishes a **placeholder/blocked** public preview.
  - Spawns `lpSanitizationOrchestrator.startSanitization(...)` in the background.
  - Returns the created template immediately.
- `buyTemplate`, `useTemplate`, `getTemplatePrompt` remain as currently implemented.

### `lpPreviewService.js` (modify)
- `publishPublicPreview(sessionId, html, token)` saves `data/previews/public/{token}.html`.
- `updatePublicPreview(token, html)` overwrites with sanitized HTML.
- `getPublicPreviewUrl(token)` returns `/preview/public/{token}.html`.

### `lpGenerationService.js` (modify)
- After the `preview` phase, call `lpTemplateService.publishFromSession(sessionId, userId)` as it already does.

## Routes

Existing routes are already implemented in `nexo-lp-routes.js`:
- `GET /templates`
- `GET /templates/:id`
- `POST /templates/:id/buy`
- `POST /templates/:id/use`
- `GET /templates/:id/prompt`
- `POST /preview/:sessionId/public`
- `GET /preview/public/:token.html`

No new routes required for this adjustment, but the `/templates` route must expose the new metadata fields and support subcategory filtering.

## Frontend

### `LPTemplateStore.svelte` (modify)
- Fetch real templates from backend via `api.getTemplates()`.
- Display **category pills** and **subcategory filters**.
- Show **marketing badges** (e.g. "Most Used", "Trending", "New") based on `metadata_json.badges` and real `usage_count`.
- Show "Sanitizing..." state for templates not yet available.
- Premium marketplace layout: hero section, search, category sidebar/grid, featured templates.

### `LPTemplateCard.svelte` (modify)
- Show category, subcategory, tags, badges, price, real usage count, rating.
- Show "Sanitizing..." overlay and disable preview when status is `sanitizing`.
- Hover reveal of key metadata (features, whyBuy).

### `LPTemplateModal.svelte` (modify)
- When `template.status === 'sanitizing'`:
  - Display template title.
  - Display censored prompt placeholder.
  - Show spinner with "Sanitizing..." message instead of the iframe preview.
  - Disable "Buy" and "Use" buttons.
- When `template.status === 'available'`:
  - Show public preview iframe.
  - Show metadata: category, subcategory, tags, badges, features, whyBuy, useCases.
  - Show buy/use buttons normally.

### Code-quality review
- Review `LPTemplateStore.svelte`, `LPTemplateCard.svelte`, `LPTemplateModal.svelte`:
  - Accessibility (button labels, disabled states, focus traps).
  - Empty/error states.
  - Avoid duplicate state sources.
  - Consistent naming and English labels.

## Security and costs
- Sanitization uses `instant` and `thinking` modes through the existing bridge adapter.
- Max 3 attempts per step before marking `failed`.
- `sanitizing` items are visible in LOJA but cannot be bought or used.
- Original prompt is never exposed without purchase.

## Out of scope
- Manual "Publish to LOJA" modal / Recent Projects filter (publication is now fully automatic).
- Adding `template_type` column or `status = 'active'` (schema mismatch with existing CHECK constraint).

## Expected verification
1. Generation creates a template with `status = 'sanitizing'`.
2. Sanitization orchestrator updates it to `available`, saves `sanitized_html`, `category`, `subcategory`, `metadata_json`.
3. Public preview is accessible only after sanitization completes.
4. Purchase deducts currency and unlocks usage.
5. Prompt is censored for non-buyers; original for buyers.
6. LOJA cards and modal correctly show the "Sanitizing..." state.
7. LOJA shows categories, subcategories, badges, and rich metadata.
