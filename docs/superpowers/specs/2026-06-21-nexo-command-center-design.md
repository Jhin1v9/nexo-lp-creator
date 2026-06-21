# Nexo Command Center — Admin Panel Design

**Date:** 2026-06-21  
**Status:** Approved  
**Scope:** Add a dark, dense, Linear/Vercel-style admin panel inside the existing Nexo LP Creator web app, plus financial integration with NEXO_DASHBOARD_PRO and Luna-friendly endpoints.

---

## 1. Summary

The Nexo LP Creator needs a single place where the operator can manage templates, generation sessions, purchases, mining jobs, and app settings. The panel must feel like a modern "mission control" — not a generic admin template.

Key decisions:
- The admin panel lives **inside** the existing Nexo LP Creator app as a new sidebar item: **Admin**.
- It uses a **dark-first, high-density UI** inspired by Linear, Vercel, and Stripe admin.
- Payments made in the LP Creator are **automatically pushed** to the NEXO_DASHBOARD_PRO cash box/finance module.
- All admin endpoints are exposed in a simple, consistent way so **Luna can call them easily**.

---

## 2. Goals

1. Manage templates in bulk: sanitize, approve, edit, delete, change price/visibility.
2. Inspect and control generation sessions: open, regenerate, delete, preview.
3. View purchases and user balances; credit/deduct currencies manually.
4. Monitor mining jobs and retry/pause them.
5. Configure app-level switches: landing vs multi-page, modern frameworks, default prices, base prompt.
6. Push every LP Creator purchase to NEXO_DASHBOARD_PRO finance automatically.
7. Provide clean admin endpoints that Luna can consume.

---

## 3. Architecture

```
┌─────────────────────────────────────────┐
│         nexo-lp-web (Svelte 4)          │
│  ┌─────────────────────────────────┐    │
│  │      LPAdminPanel.svelte        │    │
│  │  - Overview                     │    │
│  │  - Templates board              │    │
│  │  - Sessions board               │    │
│  │  - Purchases & users            │    │
│  │  - Mining jobs                  │    │
│  │  - Settings / switches          │    │
│  └─────────────────────────────────┘    │
│              │ api.js                    │
└──────────────┼──────────────────────────┘
               │ Authorization: Bearer <ADMIN_SECRET>
               ▼
┌─────────────────────────────────────────┐
│       nexo-lp-server (Express)          │
│  ┌─────────────────────────────────┐    │
│  │    /api/nexo-lp/admin/*         │    │
│  │  - requireAdmin middleware      │    │
│  │  - admin controller/service     │    │
│  └─────────────────────────────────┘    │
│              │                           │
│              ▼                           │
│  ┌─────────────────────────────────┐    │
│  │  onPurchase: push to NEXO       │    │
│  │  Dashboard finance endpoint     │    │
│  └─────────────────────────────────┘    │
└─────────────────────────────────────────┘
```

---

## 4. UI/UX Design

### 4.1 Shell
- Add an **Admin** item to the existing left sidebar of the Nexo LP Creator app.
- Clicking it renders `LPAdminPanel.svelte` in the main area.
- First-time access asks for the admin secret; store a hashed token in `localStorage`.
- Layout:
  - **Top bar:** search/command palette trigger, breadcrumb, admin badge.
  - **Left rail:** icon-only module navigation with hover tooltips.
  - **Main area:** board/table view of the selected module.
  - **Bottom terminal:** collapsible live log of background jobs.
  - **Right context panel:** slides in when an item is selected.

### 4.2 Visual Style
- Dark theme by default (`bg-slate-950`, `text-slate-200`).
- Small typography scale: `text-xs` for labels, `text-sm` for body, `text-base` for headings.
- High information density: compact tables, tight padding, 1px borders.
- Accent color: existing NEXO indigo/purple.
- Interactive states: subtle hover, focus rings, status badges.

### 4.3 Command Palette
- Trigger: `Cmd/Ctrl + K` or click on the search bar.
- Actions:
  - "Sanitize unreviewed templates"
  - "Approve template <id>"
  - "Open session <id>"
  - "Credit user <id>"
  - "Go to mining jobs"

### 4.4 Module: Overview
- KPI cards:
  - Templates by status (available / unreviewed / sanitizing).
  - Total purchases today / this month.
  - Active generation sessions.
  - Running mining jobs.
  - Total currency in circulation.
- Recent activity feed (purchases, approvals, sanitizations).

### 4.5 Module: Templates
- Board view with columns: ID, name, status, category, price, purchases, updated at.
- Filters: status, category, search.
- Bulk actions: select multiple → sanitize, approve, delete, set price, set visibility.
- Row actions: edit metadata, preview, sanitize, approve, delete.
- Context panel:
  - Live preview iframe.
  - Metadata editor (category, subcategory, tags, description, prices).
  - Purchase count and revenue.

### 4.6 Module: Sessions
- Table: ID, project name, user, status, last message, created/updated.
- Filters: status, user, search.
- Actions: open in editor, regenerate, download HTML, delete.

### 4.7 Module: Purchases & Users
- Purchase table: template, buyer, price, date, status.
- Template popularity: how many times each template was bought.
- User balance lookup and manual credit/deduct.

### 4.8 Module: Mining Jobs
- Queue table: ID, status, progress, created, actions.
- Actions: retry, pause/resume, view result.

### 4.9 Module: Settings
- Switches:
  - Default generation mode: landing page vs multi-page.
  - Allow modern frameworks (Svelte, React, Vue) vs static HTML only.
  - Auto-publish templates after sanitization.
  - Default prices for templates.
- Textarea for base prompt prefix/suffix.

---

## 5. Backend API

### 5.1 Admin Middleware
- File: `nexo-lp-server/security/adminAuth.js`
- Reads `ADMIN_SECRET` from env.
- Validates `Authorization: Bearer <token>` header.
- Returns 401 if missing/invalid.

### 5.2 Admin Routes
All mounted under `/api/nexo-lp/admin`.

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/stats` | Dashboard KPIs |
| GET | `/templates` | List all templates with filters |
| PATCH | `/templates/:id` | Edit template metadata/prices/status |
| POST | `/templates/:id/sanitize` | Trigger re-sanitization |
| POST | `/templates/:id/approve` | Promote unreviewed → available |
| DELETE | `/templates/:id` | Hard delete template |
| POST | `/templates/bulk/sanitize` | Sanitize selected templates |
| POST | `/templates/bulk/approve` | Approve selected templates |
| POST | `/templates/bulk/delete` | Delete selected templates |
| GET | `/sessions` | List sessions with filters |
| POST | `/sessions/:id/regenerate` | Re-run generation for session |
| DELETE | `/sessions/:id` | Delete session |
| GET | `/purchases` | List purchases |
| GET | `/purchases/summary` | Purchases grouped by template |
| POST | `/currencies/:userId/credit` | Credit currency to user |
| POST | `/currencies/:userId/deduct` | Deduct currency from user |
| GET | `/mining-jobs` | List mining jobs |
| POST | `/mining-jobs/:id/retry` | Retry failed job |
| POST | `/mining-jobs/:id/pause` | Pause job |
| POST | `/mining-jobs/:id/resume` | Resume job |
| GET | `/settings` | Get app settings |
| PATCH | `/settings` | Update app settings |
| POST | `/finance/push` | Manually push a purchase to NEXO Dashboard finance |

### 5.3 Service Layer
- File: `nexo-lp-server/services/lpAdminService.js`
- Wraps repository calls and orchestration.
- Reuses existing `lpSanitizationOrchestrator`, `lpTemplateService`, `CurrencyRepository`.

---

## 6. Financial Integration with NEXO_DASHBOARD_PRO

### 6.1 Automatic Push
- Hook into the existing purchase flow (`POST /templates/:id/buy` or `lpTemplateService.purchase`).
- After a successful purchase, call NEXO Dashboard finance endpoint:
  - Base URL: `http://localhost:3456`
  - Endpoint: to be confirmed; likely `POST /api/finance/cash-entry` or `POST /api/caixa/entry`.
- Payload:
  ```json
  {
    "source": "nexo-lp",
    "externalId": "purchase-<id>",
    "amount": 120.00,
    "currency": "BRL",
    "description": "Compra template <template-name> por <user-id>",
    "category": "receita",
    "type": "template_sale",
    "metadata": { "templateId", "userId", "purchaseId" }
  }
  ```
- If NEXO Dashboard is unreachable, queue the push and retry.

### 6.2 Manual Push
- Admin UI has a "Push to NEXO Finance" button on purchases that were not synced.
- Endpoint: `POST /api/nexo-lp/admin/finance/push`.

### 6.3 Luna Endpoints for Finance
- Luna can call `POST /api/nexo-lp/admin/finance/push` to fix/insert missing entries.

---

## 7. Luna-Friendly Access

Luna should be able to manipulate the LP Creator without writing raw SQL. Examples:

```
POST /api/nexo-lp/admin/templates/tpl-xxx/sanitize
POST /api/nexo-lp/admin/templates/tpl-xxx/approve
PATCH /api/nexo-lp/admin/templates/tpl-xxx { "price": 99, "isPublic": true }
DELETE /api/nexo-lp/admin/templates/tpl-xxx
POST /api/nexo-lp/admin/sessions/sess-xxx/regenerate
POST /api/nexo-lp/admin/currencies/user-xxx/credit { "amount": 100, "currency": "stars" }
POST /api/nexo-lp/admin/finance/push { "purchaseId": "pur-xxx" }
```

All endpoints return consistent JSON:
```json
{ "success": true, "data": {}, "message": "..." }
```

---

## 8. Security

1. Admin routes require `ADMIN_SECRET` via Bearer token.
2. Secret stored in `.env`, never in client bundle.
3. Frontend stores only a hashed/tokenized version after first login.
4. Admin actions are logged to a new `admin_logs` table (who, what, when, result).
5. Sensitive actions (delete, bulk delete) require confirmation and are logged.

---

## 9. Data Model Additions

### 9.1 `app_settings` table
```sql
CREATE TABLE app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```
Keys:
- `generation.mode` → `landing|multi-page`
- `generation.frameworks` → JSON array
- `generation.auto_publish` → `true|false`
- `generation.base_prompt` → text
- `pricing.default_template` → number

### 9.2 `admin_logs` table
```sql
CREATE TABLE admin_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  action TEXT NOT NULL,
  target_type TEXT,
  target_id TEXT,
  payload TEXT,
  result TEXT,
  created_at TEXT NOT NULL
);
```

---

## 10. Success Criteria

- [ ] Admin item appears in sidebar and opens the Command Center.
- [ ] Operator can list, search, filter, and bulk-action templates.
- [ ] Operator can re-sanitize one or many templates from the UI.
- [ ] Operator can approve/unreview/delete templates.
- [ ] Operator can view sessions and trigger regeneration.
- [ ] Operator can view purchases and manually adjust user balances.
- [ ] Operator can see mining jobs and retry/pause them.
- [ ] Settings switches persist and affect generation defaults.
- [ ] Every purchase automatically creates a cash entry in NEXO_DASHBOARD_PRO.
- [ ] Luna can call all admin endpoints with simple HTTP requests.
- [ ] All admin actions are logged.

---

## 11. Implementation Phases (High Level)

1. **Backend scaffold:** admin middleware, controller, service, routes.
2. **Template management:** list, filters, bulk actions, edit metadata.
3. **Sessions & purchases:** tables, actions, currency adjustments.
4. **Mining jobs & settings:** queue view, switches persistence.
5. **Frontend shell:** dark UI, command palette, terminal, context panel.
6. **NEXO finance integration:** auto-push on purchase, manual push endpoint.
7. **Luna endpoints & docs:** expose and document all routes.
8. **Testing & polish:** end-to-end flows, logs, security review.
