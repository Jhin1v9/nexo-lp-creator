# Nexo Command Center — Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the backend foundation for the Nexo Command Center admin panel: middleware, admin API routes, service layer, database migrations, admin logs, and NEXO_DASHBOARD_PRO finance integration.

**Architecture:** Express routes mounted under `/api/nexo-lp/admin/*` protected by a Bearer-token middleware. A thin `lpAdminService.js` orchestrates existing repositories and services. Admin actions are persisted to an `admin_logs` table. Purchases automatically push a cash entry to NEXO_DASHBOARD_PRO via its finance endpoint.

**Tech Stack:** Node.js, Express, SQLite (sql.js), existing repositories/services.

---

## File Structure

| File | Responsibility |
|------|----------------|
| `nexo-lp-server/security/adminAuth.js` | Bearer-token admin guard |
| `nexo-lp-server/services/lpAdminService.js` | Business logic for admin operations |
| `nexo-lp-server/controllers/adminController.js` | HTTP handlers for admin routes |
| `nexo-lp-server/routes/adminRoutes.js` | Route definitions under `/api/nexo-lp/admin` |
| `nexo-lp-server/models/migrations/009_app_settings.sql` | Create `app_settings` table |
| `nexo-lp-server/models/migrations/010_admin_logs.sql` | Create `admin_logs` table |
| `nexo-lp-server/models/repositories/AppSettingsRepository.js` | CRUD for app settings |
| `nexo-lp-server/models/repositories/AdminLogRepository.js` | CRUD for admin logs |
| `nexo-lp-server/nexo-lp-routes.js` | Mount admin routes |
| `nexo-lp-server/.env.example` | Add `ADMIN_SECRET` and `NEXO_DASHBOARD_URL` |
| `nexo-lp-server/services/lpTemplateService.js` | Hook purchase push to NEXO finance |

---

### Task 1: Admin Authentication Middleware

**Files:**
- Create: `nexo-lp-server/security/adminAuth.js`

- [ ] **Step 1: Create the middleware file**

```javascript
function requireAdmin(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  const expected = process.env.ADMIN_SECRET;

  if (!expected) {
    return res.status(500).json({ success: false, error: 'ADMIN_SECRET not configured' });
  }
  if (!token || token !== expected) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }
  next();
}

module.exports = requireAdmin;
```

- [ ] **Step 2: Add env example**

Modify: `nexo-lp-server/.env.example`

Add at the end:
```bash
# Admin access
ADMIN_SECRET=change-me-to-a-long-random-string
NEXO_DASHBOARD_URL=http://localhost:3456
NEXO_DASHBOARD_FINANCE_TOKEN=optional-service-token
```

- [ ] **Step 3: Commit**

```bash
cd /home/jhin/luna/nexo-lp-creator
git add nexo-lp-server/security/adminAuth.js nexo-lp-server/.env.example
git commit -m "feat(admin): add admin bearer-token middleware"
```

---

### Task 2: Database Migrations

**Files:**
- Create: `nexo-lp-server/models/migrations/009_app_settings.sql`
- Create: `nexo-lp-server/models/migrations/010_admin_logs.sql`

- [ ] **Step 1: Create app_settings migration**

```sql
CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

- [ ] **Step 2: Create admin_logs migration**

```sql
CREATE TABLE IF NOT EXISTS admin_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  action TEXT NOT NULL,
  target_type TEXT,
  target_id TEXT,
  payload TEXT,
  result TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_admin_logs_target ON admin_logs(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_admin_logs_created_at ON admin_logs(created_at);
```

- [ ] **Step 3: Verify migrations run**

Restart the server and check the database schema:

```bash
cd /home/jhin/luna/nexo-lp-creator && pm2 restart nexo-lp-server
node -e "const sqlite=require('./nexo-lp-server/models/sqlite'); sqlite.initializeDatabase().then(()=>sqlite.query(\"SELECT name FROM sqlite_master WHERE type='table' AND name IN ('app_settings','admin_logs')\").then(r=>console.log(r)).then(()=>sqlite.closeDatabase())"
```

Expected output: two rows with `app_settings` and `admin_logs`.

- [ ] **Step 4: Commit**

```bash
git add nexo-lp-server/models/migrations/009_app_settings.sql nexo-lp-server/models/migrations/010_admin_logs.sql
git commit -m "feat(admin): add app_settings and admin_logs migrations"
```

---

### Task 3: AppSettingsRepository

**Files:**
- Create: `nexo-lp-server/models/repositories/AppSettingsRepository.js`

- [ ] **Step 1: Implement repository**

```javascript
const { queryOne, query, run } = require('../sqlite');

class AppSettingsRepository {
  async get(key, defaultValue = null) {
    const row = await queryOne('SELECT value FROM app_settings WHERE key = ?', [key]);
    if (!row) return defaultValue;
    try {
      return JSON.parse(row.value);
    } catch {
      return row.value;
    }
  }

  async set(key, value) {
    const serialized = typeof value === 'string' ? value : JSON.stringify(value);
    const now = new Date().toISOString();
    await run(
      'INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at',
      [key, serialized, now]
    );
    return this.get(key);
  }

  async getAll(prefix = null) {
    const sql = prefix
      ? "SELECT key, value FROM app_settings WHERE key LIKE ? || '%'"
      : 'SELECT key, value FROM app_settings';
    const params = prefix ? [prefix] : [];
    const rows = await query(sql, params);
    return rows.reduce((acc, row) => {
      try {
        acc[row.key] = JSON.parse(row.value);
      } catch {
        acc[row.key] = row.value;
      }
      return acc;
    }, {});
  }
}

module.exports = new AppSettingsRepository();
```

- [ ] **Step 2: Test repository**

Create a quick test script:

```bash
cd /home/jhin/luna/nexo-lp-creator/nexo-lp-server
node -e "
const sqlite = require('./models/sqlite');
const repo = require('./models/repositories/AppSettingsRepository');
(async () => {
  await sqlite.initializeDatabase();
  await repo.set('test.key', { foo: 'bar' });
  const v = await repo.get('test.key');
  console.log(v);
  const all = await repo.getAll();
  console.log(all);
  sqlite.closeDatabase();
})();
"
```

Expected output: `{ foo: 'bar' }` and the settings object.

- [ ] **Step 3: Commit**

```bash
git add nexo-lp-server/models/repositories/AppSettingsRepository.js
git commit -m "feat(admin): add AppSettingsRepository"
```

---

### Task 4: AdminLogRepository

**Files:**
- Create: `nexo-lp-server/models/repositories/AdminLogRepository.js`

- [ ] **Step 1: Implement repository**

```javascript
const { query, queryOne, run } = require('../sqlite');

class AdminLogRepository {
  async create({ userId = null, action, targetType = null, targetId = null, payload = null, result = null }) {
    const id = `log-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const now = new Date().toISOString();
    await run(
      'INSERT INTO admin_logs (id, user_id, action, target_type, target_id, payload, result, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [id, userId, action, targetType, targetId, payload ? JSON.stringify(payload) : null, result ? JSON.stringify(result) : null, now]
    );
    return this.findById(id);
  }

  async findById(id) {
    return queryOne('SELECT * FROM admin_logs WHERE id = ?', [id]);
  }

  async list({ targetType, targetId, limit = 100, offset = 0 } = {}) {
    let sql = 'SELECT * FROM admin_logs WHERE 1=1';
    const params = [];
    if (targetType) {
      sql += ' AND target_type = ?';
      params.push(targetType);
    }
    if (targetId) {
      sql += ' AND target_id = ?';
      params.push(targetId);
    }
    sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);
    return query(sql, params);
  }
}

module.exports = new AdminLogRepository();
```

- [ ] **Step 2: Quick test**

```bash
cd /home/jhin/luna/nexo-lp-creator/nexo-lp-server
node -e "
const sqlite = require('./models/sqlite');
const repo = require('./models/repositories/AdminLogRepository');
(async () => {
  await sqlite.initializeDatabase();
  const log = await repo.create({ action: 'test', targetType: 'template', targetId: 'tpl-1', payload: { x: 1 } });
  console.log(log);
  const list = await repo.list({ targetType: 'template' });
  console.log(list.length);
  sqlite.closeDatabase();
})();
"
```

Expected: log object and list length >= 1.

- [ ] **Step 3: Commit**

```bash
git add nexo-lp-server/models/repositories/AdminLogRepository.js
git commit -m "feat(admin): add AdminLogRepository"
```

---

### Task 5: Admin Service Layer

**Files:**
- Create: `nexo-lp-server/services/lpAdminService.js`

- [ ] **Step 1: Implement service**

```javascript
const TemplateRepository = require('../models/repositories/TemplateRepository');
const SessionRepository = require('../models/repositories/SessionRepository');
const TemplatePurchaseRepository = require('../models/repositories/TemplatePurchaseRepository');
const CurrencyRepository = require('../models/repositories/CurrencyRepository');
const MiningJobRepository = require('../models/repositories/MiningJobRepository');
const AppSettingsRepository = require('../models/repositories/AppSettingsRepository');
const AdminLogRepository = require('../models/repositories/AdminLogRepository');
const lpSanitizationOrchestrator = require('./lpSanitizationOrchestrator');
const lpGenerationService = require('./lpGenerationService');

class AdminService {
  async log(userId, action, targetType, targetId, payload, result) {
    return AdminLogRepository.create({ userId, action, targetType, targetId, payload, result });
  }

  async getStats() {
    const templates = await TemplateRepository.findAll({ limit: 10000 });
    const templateStatus = templates.templates.reduce((acc, t) => {
      acc[t.status] = (acc[t.status] || 0) + 1;
      return acc;
    }, {});
    const sessions = await SessionRepository.findByStatus('preview') || [];
    const purchases = await TemplatePurchaseRepository.list({ limit: 10000 });
    const jobs = await MiningJobRepository.list({ limit: 10000 });
    return {
      templates: { total: templates.total, byStatus: templateStatus },
      sessions: { active: sessions.length },
      purchases: { total: purchases.length },
      jobs: { total: jobs.length },
    };
  }

  async listTemplates(filters = {}) {
    return TemplateRepository.findAll({ ...filters, limit: filters.limit || 1000 });
  }

  async updateTemplate(id, data, userId) {
    const allowed = ['name', 'description', 'category', 'subcategory', 'metadata_json', 'price', 'is_public', 'status'];
    const updates = {};
    for (const key of allowed) {
      if (data[key] !== undefined) updates[key] = data[key];
    }
    const result = await TemplateRepository.update(id, updates);
    await this.log(userId, 'update_template', 'template', id, updates, { success: !!result });
    return result;
  }

  async approveTemplate(id, userId) {
    const result = await TemplateRepository.approve(id);
    await this.log(userId, 'approve_template', 'template', id, {}, { success: !!result });
    return result;
  }

  async deleteTemplate(id, userId) {
    const result = await TemplateRepository.delete(id);
    await this.log(userId, 'delete_template', 'template', id, {}, { success: result });
    return result;
  }

  async sanitizeTemplate(id, userId) {
    const tpl = await TemplateRepository.findById(id);
    if (!tpl) throw new Error('Template not found');
    const session = await SessionRepository.findById(tpl.session_id);
    const result = await lpSanitizationOrchestrator.startSanitization(
      tpl.session_id,
      tpl.original_html || tpl.html || session?.current_html || '',
      session?.prompt || '',
      session?.kimi_chat_url || null,
      `admin-sanitize-${id}`
    );
    await this.log(userId, 'sanitize_template', 'template', id, {}, result);
    return result;
  }

  async listSessions(filters = {}) {
    const sqlBase = 'SELECT * FROM sessions WHERE 1=1';
    const params = [];
    if (filters.status) {
      sqlBase += ' AND status = ?';
      params.push(filters.status);
    }
    if (filters.search) {
      sqlBase += ' AND (id LIKE ? OR initial_prompt LIKE ?)';
      params.push(`%${filters.search}%`, `%${filters.search}%`);
    }
    sqlBase += ' ORDER BY updated_at DESC LIMIT ?';
    params.push(filters.limit || 1000);
    const { query } = require('../models/sqlite');
    return query(sqlBase, params);
  }

  async regenerateSession(id, userId) {
    const session = await SessionRepository.findById(id);
    if (!session) throw new Error('Session not found');
    const result = await lpGenerationService.generate(id, session.prompt || session.initial_prompt || 'Regenerate from admin', session.user_id);
    await this.log(userId, 'regenerate_session', 'session', id, {}, { success: true, htmlLength: result?.html?.length });
    return result;
  }

  async deleteSession(id, userId) {
    // Reuse existing session delete if available, otherwise implement
    const result = await SessionRepository.delete?.(id);
    await this.log(userId, 'delete_session', 'session', id, {}, { success: result });
    return result;
  }

  async listPurchases(filters = {}) {
    return TemplatePurchaseRepository.list({ ...filters, limit: filters.limit || 1000 });
  }

  async creditCurrency(userId, currency, amount, actorId) {
    const result = await CurrencyRepository.credit(userId, currency, amount);
    await this.log(actorId, 'credit_currency', 'user', userId, { currency, amount }, { success: true, balance: result });
    return result;
  }

  async deductCurrency(userId, currency, amount, actorId) {
    const result = await CurrencyRepository.deduct(userId, currency, amount);
    await this.log(actorId, 'deduct_currency', 'user', userId, { currency, amount }, { success: true, balance: result });
    return result;
  }

  async listMiningJobs(filters = {}) {
    return MiningJobRepository.list({ ...filters, limit: filters.limit || 1000 });
  }

  async retryMiningJob(id, userId) {
    const result = await MiningJobRepository.updateStatus(id, 'pending');
    await this.log(userId, 'retry_mining_job', 'mining_job', id, {}, { success: true });
    return result;
  }

  async getSettings() {
    return AppSettingsRepository.getAll('generation.') || {};
  }

  async updateSettings(settings, userId) {
    const allowed = ['generation.mode', 'generation.frameworks', 'generation.auto_publish', 'generation.base_prompt', 'pricing.default_template'];
    const result = {};
    for (const key of allowed) {
      if (settings[key] !== undefined) {
        result[key] = await AppSettingsRepository.set(key, settings[key]);
      }
    }
    await this.log(userId, 'update_settings', 'app', null, settings, result);
    return result;
  }
}

module.exports = new AdminService();
```

- [ ] **Step 2: Verify SessionRepository.delete exists**

If `SessionRepository.delete` does not exist, add it first in a separate commit.

```bash
cd /home/jhin/luna/nexo-lp-creator/nexo-lp-server
grep -n "delete" models/repositories/SessionRepository.js
```

If missing, add:

```javascript
async delete(id) {
  const result = await run('DELETE FROM sessions WHERE id = ?', [id]);
  return result.changes > 0;
}
```

- [ ] **Step 3: Commit**

```bash
git add nexo-lp-server/services/lpAdminService.js
git commit -m "feat(admin): add admin service layer"
```

---

### Task 6: Admin Controller

**Files:**
- Create: `nexo-lp-server/controllers/adminController.js`

- [ ] **Step 1: Implement controller**

```javascript
const adminService = require('../services/lpAdminService');

function respond(res, data, message = 'OK') {
  return res.json({ success: true, data, message });
}

function error(res, status, message) {
  return res.status(status).json({ success: false, error: message });
}

class AdminController {
  async getStats(req, res) {
    try {
      const stats = await adminService.getStats();
      respond(res, stats);
    } catch (err) {
      error(res, 500, err.message);
    }
  }

  async listTemplates(req, res) {
    try {
      const result = await adminService.listTemplates(req.query);
      respond(res, result);
    } catch (err) {
      error(res, 500, err.message);
    }
  }

  async updateTemplate(req, res) {
    try {
      const result = await adminService.updateTemplate(req.params.id, req.body, req.userId || 'admin');
      respond(res, result, 'Template updated');
    } catch (err) {
      error(res, 500, err.message);
    }
  }

  async approveTemplate(req, res) {
    try {
      const result = await adminService.approveTemplate(req.params.id, req.userId || 'admin');
      respond(res, result, 'Template approved');
    } catch (err) {
      error(res, 500, err.message);
    }
  }

  async deleteTemplate(req, res) {
    try {
      const result = await adminService.deleteTemplate(req.params.id, req.userId || 'admin');
      respond(res, result, 'Template deleted');
    } catch (err) {
      error(res, 500, err.message);
    }
  }

  async sanitizeTemplate(req, res) {
    try {
      const result = await adminService.sanitizeTemplate(req.params.id, req.userId || 'admin');
      respond(res, result, 'Sanitization started');
    } catch (err) {
      error(res, 500, err.message);
    }
  }

  async bulkSanitizeTemplates(req, res) {
    try {
      const { ids } = req.body;
      const results = [];
      for (const id of ids || []) {
        try {
          const r = await adminService.sanitizeTemplate(id, req.userId || 'admin');
          results.push({ id, success: r.success, error: null });
        } catch (err) {
          results.push({ id, success: false, error: err.message });
        }
      }
      respond(res, results, 'Bulk sanitization completed');
    } catch (err) {
      error(res, 500, err.message);
    }
  }

  async bulkApproveTemplates(req, res) {
    try {
      const { ids } = req.body;
      const results = [];
      for (const id of ids || []) {
        try {
          const r = await adminService.approveTemplate(id, req.userId || 'admin');
          results.push({ id, success: !!r, error: null });
        } catch (err) {
          results.push({ id, success: false, error: err.message });
        }
      }
      respond(res, results, 'Bulk approve completed');
    } catch (err) {
      error(res, 500, err.message);
    }
  }

  async bulkDeleteTemplates(req, res) {
    try {
      const { ids } = req.body;
      const results = [];
      for (const id of ids || []) {
        try {
          const r = await adminService.deleteTemplate(id, req.userId || 'admin');
          results.push({ id, success: r, error: null });
        } catch (err) {
          results.push({ id, success: false, error: err.message });
        }
      }
      respond(res, results, 'Bulk delete completed');
    } catch (err) {
      error(res, 500, err.message);
    }
  }

  async listSessions(req, res) {
    try {
      const result = await adminService.listSessions(req.query);
      respond(res, result);
    } catch (err) {
      error(res, 500, err.message);
    }
  }

  async regenerateSession(req, res) {
    try {
      const result = await adminService.regenerateSession(req.params.id, req.userId || 'admin');
      respond(res, result, 'Session regeneration started');
    } catch (err) {
      error(res, 500, err.message);
    }
  }

  async deleteSession(req, res) {
    try {
      const result = await adminService.deleteSession(req.params.id, req.userId || 'admin');
      respond(res, result, 'Session deleted');
    } catch (err) {
      error(res, 500, err.message);
    }
  }

  async listPurchases(req, res) {
    try {
      const result = await adminService.listPurchases(req.query);
      respond(res, result);
    } catch (err) {
      error(res, 500, err.message);
    }
  }

  async creditCurrency(req, res) {
    try {
      const { currency, amount } = req.body;
      const result = await adminService.creditCurrency(req.params.userId, currency, amount, req.userId || 'admin');
      respond(res, result, 'Currency credited');
    } catch (err) {
      error(res, 500, err.message);
    }
  }

  async deductCurrency(req, res) {
    try {
      const { currency, amount } = req.body;
      const result = await adminService.deductCurrency(req.params.userId, currency, amount, req.userId || 'admin');
      respond(res, result, 'Currency deducted');
    } catch (err) {
      error(res, 500, err.message);
    }
  }

  async listMiningJobs(req, res) {
    try {
      const result = await adminService.listMiningJobs(req.query);
      respond(res, result);
    } catch (err) {
      error(res, 500, err.message);
    }
  }

  async retryMiningJob(req, res) {
    try {
      const result = await adminService.retryMiningJob(req.params.id, req.userId || 'admin');
      respond(res, result, 'Mining job retried');
    } catch (err) {
      error(res, 500, err.message);
    }
  }

  async getSettings(req, res) {
    try {
      const result = await adminService.getSettings();
      respond(res, result);
    } catch (err) {
      error(res, 500, err.message);
    }
  }

  async updateSettings(req, res) {
    try {
      const result = await adminService.updateSettings(req.body, req.userId || 'admin');
      respond(res, result, 'Settings updated');
    } catch (err) {
      error(res, 500, err.message);
    }
  }
}

module.exports = new AdminController();
```

- [ ] **Step 2: Commit**

```bash
git add nexo-lp-server/controllers/adminController.js
git commit -m "feat(admin): add admin controller"
```

---

### Task 7: Admin Routes

**Files:**
- Create: `nexo-lp-server/routes/adminRoutes.js`
- Modify: `nexo-lp-server/nexo-lp-routes.js`

- [ ] **Step 1: Create admin routes**

```javascript
const express = require('express');
const requireAdmin = require('../security/adminAuth');
const adminController = require('../controllers/adminController');

const router = express.Router();
router.use(requireAdmin);

router.get('/stats', adminController.getStats.bind(adminController));
router.get('/templates', adminController.listTemplates.bind(adminController));
router.patch('/templates/:id', adminController.updateTemplate.bind(adminController));
router.post('/templates/:id/approve', adminController.approveTemplate.bind(adminController));
router.delete('/templates/:id', adminController.deleteTemplate.bind(adminController));
router.post('/templates/:id/sanitize', adminController.sanitizeTemplate.bind(adminController));
router.post('/templates/bulk/sanitize', adminController.bulkSanitizeTemplates.bind(adminController));
router.post('/templates/bulk/approve', adminController.bulkApproveTemplates.bind(adminController));
router.post('/templates/bulk/delete', adminController.bulkDeleteTemplates.bind(adminController));

router.get('/sessions', adminController.listSessions.bind(adminController));
router.post('/sessions/:id/regenerate', adminController.regenerateSession.bind(adminController));
router.delete('/sessions/:id', adminController.deleteSession.bind(adminController));

router.get('/purchases', adminController.listPurchases.bind(adminController));
router.post('/currencies/:userId/credit', adminController.creditCurrency.bind(adminController));
router.post('/currencies/:userId/deduct', adminController.deductCurrency.bind(adminController));

router.get('/mining-jobs', adminController.listMiningJobs.bind(adminController));
router.post('/mining-jobs/:id/retry', adminController.retryMiningJob.bind(adminController));

router.get('/settings', adminController.getSettings.bind(adminController));
router.patch('/settings', adminController.updateSettings.bind(adminController));

module.exports = router;
```

- [ ] **Step 2: Mount routes in main router**

Modify `nexo-lp-server/nexo-lp-routes.js` near the other `router.use` calls:

```javascript
const adminRoutes = require('./routes/adminRoutes');
// ... existing routes ...
router.use('/admin', adminRoutes);
```

- [ ] **Step 3: Test a route**

Set a temporary ADMIN_SECRET and test:

```bash
cd /home/jhin/luna/nexo-lp-creator
export ADMIN_SECRET=test123
curl -s http://localhost:3460/api/nexo-lp/admin/stats -H "Authorization: Bearer test123" | head -c 500
```

Expected: JSON with `success: true` and stats.

- [ ] **Step 4: Commit**

```bash
git add nexo-lp-server/routes/adminRoutes.js nexo-lp-server/nexo-lp-routes.js
git commit -m "feat(admin): add admin routes and mount under /api/nexo-lp/admin"
```

---

### Task 8: NEXO_DASHBOARD_PRO Finance Integration

**Files:**
- Create: `nexo-lp-server/services/nexoDashboardFinanceService.js`
- Modify: `nexo-lp-server/services/lpTemplateService.js`

- [ ] **Step 1: Implement finance service**

```javascript
async function pushCashEntry(entry) {
  const baseUrl = process.env.NEXO_DASHBOARD_URL || 'http://localhost:3456';
  const endpoint = `${baseUrl}/api/finance/cash-entry`;
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(process.env.NEXO_DASHBOARD_FINANCE_TOKEN
          ? { Authorization: `Bearer ${process.env.NEXO_DASHBOARD_FINANCE_TOKEN}` }
          : {}),
      },
      body: JSON.stringify(entry),
    });
    if (!response.ok) {
      throw new Error(`NEXO Dashboard returned ${response.status}`);
    }
    return await response.json();
  } catch (err) {
    console.error('[NexoDashboardFinance] push failed:', err.message);
    throw err;
  }
}

async function recordTemplatePurchase(purchase, template) {
  return pushCashEntry({
    source: 'nexo-lp',
    externalId: purchase.id,
    amount: purchase.price || template.price || 0,
    currency: purchase.currency || 'BRL',
    description: `Venda template ${template.name || template.id} (${purchase.user_id})`,
    category: 'receita',
    type: 'template_sale',
    metadata: {
      templateId: template.id,
      userId: purchase.user_id,
      purchaseId: purchase.id,
    },
  });
}

module.exports = { pushCashEntry, recordTemplatePurchase };
```

- [ ] **Step 2: Hook into purchase flow**

Find the purchase method in `nexo-lp-server/services/lpTemplateService.js` and add after successful purchase:

```javascript
const nexoFinance = require('./nexoDashboardFinanceService');
// ... inside purchase method, after creating purchase record:
try {
  await nexoFinance.recordTemplatePurchase(purchaseRecord, template);
} catch (err) {
  console.error('[lpTemplateService] failed to push purchase to NEXO finance:', err.message);
  // Non-blocking: purchase still succeeds
}
```

- [ ] **Step 3: Add manual push endpoint to admin controller**

Add to `adminController.js`:

```javascript
async pushFinance(req, res) {
  try {
    const { purchaseId } = req.body;
    const purchase = await TemplatePurchaseRepository.findById(purchaseId);
    if (!purchase) return error(res, 404, 'Purchase not found');
    const template = await TemplateRepository.findById(purchase.template_id);
    const result = await require('./nexoDashboardFinanceService').recordTemplatePurchase(purchase, template);
    respond(res, result, 'Purchase pushed to NEXO finance');
  } catch (err) {
    error(res, 500, err.message);
  }
}
```

Add route in `adminRoutes.js`:
```javascript
router.post('/finance/push', adminController.pushFinance.bind(adminController));
```

- [ ] **Step 4: Commit**

```bash
git add nexo-lp-server/services/nexoDashboardFinanceService.js nexo-lp-server/services/lpTemplateService.js nexo-lp-server/controllers/adminController.js nexo-lp-server/routes/adminRoutes.js
git commit -m "feat(admin): integrate NEXO Dashboard finance push"
```

---

### Task 9: Restart and Smoke Test

- [ ] **Step 1: Restart server**

```bash
cd /home/jhin/luna/nexo-lp-creator && pm2 restart nexo-lp-server
```

- [ ] **Step 2: Smoke test key endpoints**

```bash
export ADMIN_SECRET=test123
curl -s -H "Authorization: Bearer test123" http://localhost:3460/api/nexo-lp/admin/stats
curl -s -H "Authorization: Bearer test123" "http://localhost:3460/api/nexo-lp/admin/templates?limit=5"
curl -s -H "Authorization: Bearer test123" "http://localhost:3460/api/nexo-lp/admin/sessions?limit=5"
curl -s -H "Authorization: Bearer test123" http://localhost:3460/api/nexo-lp/admin/settings
```

All should return `success: true`.

- [ ] **Step 3: Verify unauthorized access is blocked**

```bash
curl -s http://localhost:3460/api/nexo-lp/admin/stats
```

Expected: `401 Unauthorized`.

- [ ] **Step 4: Commit any fixes**

```bash
git add -A
git commit -m "fix(admin): smoke test backend admin API"
```

---

## Self-Review Checklist

- [x] Admin middleware guards all routes.
- [x] Database migrations create `app_settings` and `admin_logs`.
- [x] Repositories for settings and logs exist.
- [x] Service layer covers templates, sessions, purchases, currencies, mining jobs, settings.
- [x] Controller exposes consistent JSON responses.
- [x] Routes are mounted under `/api/nexo-lp/admin`.
- [x] NEXO finance integration pushes purchases automatically and manually.
- [x] Admin actions are logged.
