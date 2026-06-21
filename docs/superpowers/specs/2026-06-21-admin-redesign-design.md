# NEXO LP Creator — Admin Redesign v2

**Date:** 2026-06-21  
**Status:** Approved  
**Scope:** Frontend admin visual overhaul + real-time operations + user/sales management  

---

## 1. Objective

Transform the admin panel from a dark, card-heavy, "AI-tool" interface into a white, dense, professional admin dashboard that feels like Stripe/Notion/Vercel. The admin must give real control over users, sales, templates, and live operations, while reusing every existing backend capability.

---

## 2. Scope

### In scope (Fase 1)

1. **Visual redesign of `LPAdminPanel.svelte`**
   - White background, clean borders, no cards, dense tables.
   - New sidebar navigation with text labels.
   - Minimal top bar.

2. **Generation mode switch for end users**
   - A simple UI switch in the chat/editor area lets the user pick a generation mode (e.g., Landing, Multi-page).
   - Admin settings will have a new `generation.modes` array: each mode has a `label` and a `basePrompt`.
   - The existing admin "Base prompt" field remains admin-only and acts as the global fallback / override prompt applied after the mode-specific prompt.

3. **`users` table + user management**
   - New migration creates `users` table.
   - Migration backfills existing `user_id`s from `sessions`, `template_purchases`, `user_currencies`.
   - Users module with list and detail view.
   - Actions: block/unblock, manual credit/deduct, impersonate, view sessions/purchases/published templates.

4. **Loja Analytics**
   - Sales table: template, buyer, amount, date, status.
   - Date-range filters.
   - Revenue summary (total, per template, per period).
   - CSV export.

5. **Operations (Live)**
   - Real-time SSE endpoint `/admin/events`.
   - Active jobs panel (generations + sanitizations) with progress.
   - Chronological activity feed below.
   - Buffer of last 50 events sent on connect.

6. **Templates module redesign**
   - Dense data table.
   - Quick actions inline.
   - Side panel for metadata/preview editing.
   - Bulk actions preserved.

### Out of scope (future phases)

- Admin roles/permissions (only one admin secret today).
- Email notifications to users.
- Advanced charts (only a simple sales line chart in Fase 1).
- Automated refunds.

---

## 3. Visual Design

### Color palette

| Token | Value | Usage |
|-------|-------|-------|
| `--bg-primary` | `#ffffff` | Main background |
| `--bg-secondary` | `#f8fafc` | Page/section backgrounds |
| `--border` | `#e2e8f0` | Borders, dividers |
| `--text-primary` | `#0f172a` | Headings, primary text |
| `--text-secondary` | `#475569` | Body, labels |
| `--text-muted` | `#64748b` | Meta text |
| `--accent` | `#4f46e5` | Active states, dots, links |
| `--accent-dark` | `#0f172a` | Primary buttons |

### Layout

- **Sidebar:** 240px fixed left, white, 1px right border.
  - Brand at top.
  - Nav items: Overview, Templates, Loja Analytics, Users, Operations, Settings.
  - Active item: `#f1f5f9` background, dark text.
- **Top bar:** 64px, white, bottom border.
  - Page title left.
  - Global actions right (Export CSV, Back to NEXO LP).
- **Content area:** scrollable, 32px padding.
- **Metrics:** horizontal data rows, not cards.
- **Tables:** full width, sticky header, no card wrapper.
- **Panels:** only when needed (filters, side panel), with 1px border and 12px radius.

### Typography

- Font: system-ui / Inter.
- Headings: 600 weight.
- Table text: 13px.
- Labels: 12px uppercase, muted.

---

## 4. Modules

### 4.1 Overview

- **Top metrics row:**
  - Templates aprovados
  - Vendas 24h
  - Landing pages gerando agora
  - Sanitizações ativas
- **Activity feed:** last 20 events from SSE.
- **Quick actions:**
  - Export sales CSV
  - Sanitize unreviewed templates
  - Open Operations

### 4.2 Templates

- **Table columns:** ID, Name, Category, Status, Price, Sales, Updated, Actions.
- **Filters:** status, category, search.
- **Bulk actions:** Approve, Sanitize, Set price, Delete.
- **Side panel (right):**
  - Preview iframe.
  - Editable fields: name, category, subcategory, price (stars/suns/moons), status.
  - Actions: Save, Sanitize, Approve, Delete.

### 4.3 Loja Analytics

- **Date filter:** start/end date inputs.
- **Summary cards:**
  - Revenue total in period
  - Revenue today
  - Templates sold in period
  - Top selling template
- **Sales table:**
  - Template name
  - Buyer (user id / name if available)
  - Amount (currency breakdown)
  - Date
  - Status
- **Export CSV:** downloads filtered results.
- **Simple line chart:** revenue per day in selected period (recharts or SVG).

### 4.4 Users

- **Users table:**
  - ID
  - Name/email (if known)
  - Status (active/blocked)
  - Stars / Suns / Moons
  - Total spent
  - Total purchases
  - Last seen
  - Actions
- **User detail view (side panel or dedicated page):**
  - Header: ID, status badge, block/unblock, impersonate.
  - Balances with inline edit (credit/deduct).
  - Tabs:
    - Sessions / LPs generated
    - Purchases
    - Templates published (templates where `created_by = user.id`)
    - Admin history (logs of actions on this user)

### 4.5 Operations (Live)

- **Connection status indicator** (SSE connected / disconnected).
- **Active jobs panel:**
  - Each job: type (generation / sanitization), subject (session/template id), current phase, progress bar, duration.
  - Auto-removes jobs when completed/errored after a short delay.
- **Activity feed:** chronological list of all events.
  - Event types: generation_start, generation_phase, generation_complete, generation_error, sanitization_step, sanitization_complete, sanitization_error, purchase.
  - Each row: timestamp, icon, description.

### 4.6 Settings

- Generation mode (admin-only default).
- Frameworks.
- Base prompt (admin-only).
- Auto-publish toggle.
- Default template price.

---

## 5. Data Model

### 5.1 New migration: `018_users.sql`

```sql
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT,
  name TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'blocked')),
  role TEXT NOT NULL DEFAULT 'user' CHECK(role IN ('user', 'admin')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_seen_at DATETIME,
  metadata_json TEXT
);

CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Backfill existing user_ids from sessions, purchases, and currency balances
INSERT OR IGNORE INTO users (id, created_at, updated_at)
SELECT user_id, MIN(created_at), DATETIME('now') FROM sessions WHERE user_id IS NOT NULL GROUP BY user_id;

INSERT OR IGNORE INTO users (id, created_at, updated_at)
SELECT user_id, MIN(created_at), DATETIME('now') FROM template_purchases WHERE user_id IS NOT NULL GROUP BY user_id;

INSERT OR IGNORE INTO users (id, created_at, updated_at)
SELECT user_id, DATETIME('now'), DATETIME('now') FROM user_currencies WHERE user_id IS NOT NULL GROUP BY user_id;
```

### 5.2 User update hook

Whenever a session, purchase, or currency operation uses a `user_id` not present in `users`, the system should upsert it. This will be handled in a small `UserService.ensureExists(userId)` helper called from relevant services.

---

## 6. Backend API

### 6.1 Existing endpoints reused

| Endpoint | Use |
|----------|-----|
| `GET /admin/templates` | Templates table |
| `PATCH /admin/templates/:id` | Edit template metadata |
| `POST /admin/templates/:id/sanitize` | Queue sanitization |
| `POST /admin/templates/bulk/sanitize` | Bulk sanitization |
| `POST /admin/templates/:id/approve` | Approve template |
| `GET /admin/sessions` | Sessions list |
| `GET /admin/purchases` | Sales list |
| `GET /admin/purchases/summary` | Revenue summary |
| `POST /admin/currencies/:userId/credit` | Credit user |
| `POST /admin/currencies/:userId/deduct` | Deduct user |
| `GET /admin/settings` / `PATCH /admin/settings` | Settings |

### 6.2 New endpoints

#### `GET /admin/users`
List users with aggregated stats.

Query params:
- `search`
- `status`
- `page`
- `limit`

Response:
```json
{
  "users": [
    {
      "id": "user-123",
      "name": null,
      "email": null,
      "status": "active",
      "balances": { "stars": 100, "suns": 5, "moons": 1 },
      "totalSpent": { "stars": 450, "suns": 0, "moons": 0 },
      "totalPurchases": 3,
      "lastSeenAt": "2026-06-21T10:00:00Z",
      "createdAt": "2026-06-01T10:00:00Z"
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 150 }
}
```

#### `GET /admin/users/:id`
Full user profile.

Response:
```json
{
  "id": "user-123",
  "name": null,
  "email": null,
  "status": "active",
  "role": "user",
  "balances": { "stars": 100, "suns": 5, "moons": 1 },
  "totalSpent": { "stars": 450, "suns": 0, "moons": 0 },
  "totalPurchases": 3,
  "sessions": [...],
  "purchases": [...],
  "publishedTemplates": [...],
  "adminHistory": [...]
}
```

#### `PATCH /admin/users/:id`
Update user fields (name, email, status, role).

#### `POST /admin/users/:id/block`
Set status to `blocked`.

#### `POST /admin/users/:id/unblock`
Set status to `active`.

#### `POST /admin/users/:id/impersonate`
Returns a one-time token/session payload that the frontend can use to open the app as that user. Implementation detail: generate a temporary session id linked to the user, or return the user id for a special "admin impersonation" mode.

#### `GET /admin/events`
SSE endpoint for real-time admin events.

Headers:
- `Content-Type: text/event-stream`
- `Cache-Control: no-cache`

Events:
```json
{
  "type": "generation_start",
  "sessionId": "sess-xxx",
  "userId": "user-123",
  "timestamp": "2026-06-21T10:00:00Z"
}
```

```json
{
  "type": "sanitization_step",
  "templateId": "tpl-xxx",
  "sessionId": "sess-xxx",
  "step": 2,
  "phase": "qa",
  "timestamp": "2026-06-21T10:00:00Z"
}
```

```json
{
  "type": "purchase",
  "purchaseId": "pur-xxx",
  "templateId": "tpl-xxx",
  "userId": "user-123",
  "amount": { "stars": 150 },
  "timestamp": "2026-06-21T10:00:00Z"
}
```

#### `GET /admin/activity/recent`
Returns the last 50 events from the in-memory buffer (fallback if SSE misses events on reconnect).

### 6.3 SSE architecture

1. **Global EventBus** in `services/adminEventBus.js`:
   - In-memory EventEmitter.
   - Maintains a ring buffer of last 50 events.
   - Exposes `publish(event)` and `subscribe(callback)`.

2. **Generation events**:
   - Modify `lpGenerationService.emitToStream` to also call `adminEventBus.publish(event)`.

3. **Sanitization events**:
   - `SanitizationOrchestrator` already emits `sanitization:*` events.
   - In `adminEventBus.js`, subscribe to the orchestrator and normalize events.

4. **Purchase events**:
   - In `lpTemplateService.recordPurchase` (or equivalent), call `adminEventBus.publish(purchaseEvent)`.

5. **SSE endpoint**:
   - On connect, send buffered events.
   - Subscribe to EventBus and forward to response.
   - On client disconnect, unsubscribe.

---

## 7. Frontend Components

### New components

| Component | Responsibility |
|-----------|----------------|
| `LPAdminPanel.svelte` | Main shell, sidebar, top bar, module routing. |
| `LPAdminOverview.svelte` | Metrics + activity feed + quick actions. |
| `LPAdminTemplates.svelte` | Templates table + filters + bulk actions. |
| `LPAdminTemplatePanel.svelte` | Side panel for template editing. |
| `LPAdminAnalytics.svelte` | Sales filters, summary, table, chart, export. |
| `LPAdminUsers.svelte` | Users table + filters. |
| `LPAdminUserPanel.svelte` | User detail side panel with tabs. |
| `LPAdminOperations.svelte` | Live jobs + activity feed. |
| `LPAdminSettings.svelte` | Settings form. |
| `AdminDataTable.svelte` | Reusable dense table with sorting/pagination. |
| `AdminMetricRow.svelte` | Horizontal metric display. |
| `AdminEventFeed.svelte` | Reusable chronological feed. |
| `AdminSSEStore.js` | Svelte store managing SSE connection and event state. |

### Generation mode switch (end-user)

- Component: `GenerationModeSwitch.svelte` placed in `LPChatArea.svelte` near the input or in a toolbar.
- Reads available modes from admin settings (`generation.modes` array stored as JSON in `app_settings`).
- Each mode object: `{ label: "Landing", basePrompt: "..." }`.
- The selected mode is stored in a Svelte store and sent with each generation request.
- The existing admin "Base prompt" field is appended after the mode-specific prompt, acting as global instruction/fallback.

---

## 8. Key Flows

### 8.1 Sanitization flow (corrected)

1. Admin clicks "Sanitize" on a template.
2. Frontend calls `POST /admin/templates/:id/sanitize`.
3. Backend queues sanitization and returns `{ queued: true }`.
4. Frontend shows "Sanitização iniciada — acompanhe na aba Operações".
5. `SanitizationOrchestrator` emits `sanitization_step` events.
6. Admin sees progress in Operations.
7. On success, status becomes `approved` and `is_public = 2`.
8. Template appears in the public store.

### 8.2 User impersonation flow

1. Admin opens user detail.
2. Clicks "Impersonate".
3. Backend creates/returns a session for that user.
4. Frontend opens `/chat?impersonate=<token>` or sets a store flag.
5. App loads as the target user.
6. A banner shows "Você está agindo como user-123" with exit button.

### 8.3 Sales export flow

1. Admin filters Loja Analytics by date.
2. Clicks "Export CSV".
3. Frontend downloads CSV generated from the current filtered data (no extra backend endpoint needed for Fase 1).

---

## 9. Testing Strategy

### Backend

- Unit tests for `UserRepository` and `UserService`.
- Tests for `/admin/users` endpoints.
- Tests for `/admin/events` SSE (verify headers and buffered events).
- Update existing sanitization tests to expect `approved` status.

### Frontend

- Build passes without errors.
- Visual regression: screenshots of new admin modules.
- Manual tests:
  - Sanitization shows live progress in Operations.
  - User block/unblock works.
  - CSV export downloads correct data.

---

## 10. Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| User table backfill is slow on large DB | Use `INSERT OR IGNORE` with indexed `user_id` columns; run in migration |
| SSE global connection drops | Auto-reconnect with exponential backoff; show status indicator |
| Impersonate security issue | Use one-time token, validate admin auth, log all impersonations |
| UI feels still card-heavy | Strict design review: metrics as rows, tables without card wrappers |

---

## 11. Acceptance Criteria

- [ ] Admin panel is white, clean, no card stacks.
- [ ] All existing admin features still work (templates, sessions, settings, purchases).
- [ ] Users table exists and is populated.
- [ ] New Users module lists users with stats.
- [ ] Loja Analytics has date filters, summary, sales table, CSV export.
- [ ] Operations shows live generations and sanitizations with progress.
- [ ] Sanitization success moves template to `approved` status.
- [ ] Frontend shows "Sanitização iniciada" instead of "Template sanitized".
- [ ] End-user can switch generation mode in the chat/editor UI.
