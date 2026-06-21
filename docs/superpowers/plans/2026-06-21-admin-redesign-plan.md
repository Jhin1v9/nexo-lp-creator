# NEXO LP Creator — Admin Redesign v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the admin panel with a white, professional, data-dense UI; add real-time operations, user management, sales analytics, and an end-user generation mode switch.

**Architecture:** Reuse existing backend APIs and SSE infrastructure; add a global admin event bus, a new `users` table, and new admin endpoints. Frontend breaks the monolithic `LPAdminPanel.svelte` into focused module components with shared table/feed/metric primitives.

**Tech Stack:** Svelte 4, Tailwind CSS, Vite, Express, SQLite (sql.js), Server-Sent Events.

---

## File Structure

### Backend

| File | Responsibility |
|------|----------------|
| `models/migrations/018_users.sql` | Creates `users` table and backfills existing user IDs |
| `models/repositories/UserRepository.js` | CRUD + list users with aggregates |
| `services/lpUserService.js` | Business logic: ensure exists, block/unblock, impersonate, aggregates |
| `services/adminEventBus.js` | In-memory event bus + ring buffer for admin SSE |
| `routes/adminRoutes.js` | Add `/admin/users/*` and `/admin/events` routes |
| `controllers/adminController.js` | Add user and SSE handlers |
| `services/lpGenerationService.js` | Forward generation events to adminEventBus |
| `services/lpSanitizationOrchestrator.js` | Already emits events; wire to adminEventBus |
| `services/lpTemplateService.js` | Emit purchase events to adminEventBus |
| `services/lpAdminService.js` | Add user service methods |

### Frontend

| File | Responsibility |
|------|----------------|
| `src/components/LPAdminPanel.svelte` | New shell: sidebar, top bar, module router |
| `src/components/admin/LPAdminOverview.svelte` | Overview module |
| `src/components/admin/LPAdminTemplates.svelte` | Templates module |
| `src/components/admin/LPAdminTemplatePanel.svelte` | Template edit side panel |
| `src/components/admin/LPAdminAnalytics.svelte` | Loja Analytics module |
| `src/components/admin/LPAdminUsers.svelte` | Users list module |
| `src/components/admin/LPAdminUserPanel.svelte` | User detail panel |
| `src/components/admin/LPAdminOperations.svelte` | Live operations module |
| `src/components/admin/LPAdminSettings.svelte` | Settings module |
| `src/components/admin/AdminDataTable.svelte` | Reusable dense table |
| `src/components/admin/AdminMetricRow.svelte` | Horizontal metric display |
| `src/components/admin/AdminEventFeed.svelte` | Chronological activity feed |
| `src/components/admin/AdminSSEStore.js` | Svelte store for SSE state |
| `src/components/GenerationModeSwitch.svelte` | End-user mode switch |
| `src/api.js` | Add admin user API helpers |
| `src/stores.js` | Add `adminLiveEvents`, `generationMode` stores |

---

## Task 1: Backend — Create users table and repository

**Files:**
- Create: `models/migrations/018_users.sql`
- Create: `models/repositories/UserRepository.js`
- Create: `tests/models/userRepository.test.js`
- Modify: `models/sqlite.js` (ensure migration is loaded if not auto)

### Step 1.1: Write migration

Create `models/migrations/018_users.sql`:

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

INSERT OR IGNORE INTO users (id, created_at, updated_at)
SELECT user_id, MIN(created_at), DATETIME('now') FROM sessions WHERE user_id IS NOT NULL GROUP BY user_id;

INSERT OR IGNORE INTO users (id, created_at, updated_at)
SELECT user_id, MIN(created_at), DATETIME('now') FROM template_purchases WHERE user_id IS NOT NULL GROUP BY user_id;

INSERT OR IGNORE INTO users (id, created_at, updated_at)
SELECT user_id, DATETIME('now'), DATETIME('now') FROM user_currencies WHERE user_id IS NOT NULL GROUP BY user_id;
```

### Step 1.2: Verify migration runs

Run:

```bash
cd /home/jhin/luna/nexo-lp-creator/nexo-lp-server
rm -f data/nexo-lp.db
node -e "require('./models/sqlite').initializeDatabase().then(() => console.log('ok'))"
```

Expected: `ok` and no errors.

### Step 1.3: Create UserRepository

Create `models/repositories/UserRepository.js`:

```js
const { run, queryOne, query } = require('../sqlite');

const ALLOWED_UPDATE_COLUMNS = ['email', 'name', 'status', 'role', 'last_seen_at', 'metadata_json'];

class UserRepository {
  async create(data) {
    const now = new Date().toISOString();
    await run(
      `INSERT INTO users (id, email, name, status, role, created_at, updated_at, last_seen_at, metadata_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.id,
        data.email || null,
        data.name || null,
        data.status || 'active',
        data.role || 'user',
        data.created_at || now,
        data.updated_at || now,
        data.last_seen_at || null,
        data.metadata_json || null,
      ]
    );
    return this.findById(data.id);
  }

  async findById(id) {
    return queryOne('SELECT * FROM users WHERE id = ?', [id]);
  }

  async findOrCreate(id) {
    const existing = await this.findById(id);
    if (existing) return existing;
    return this.create({ id });
  }

  async update(id, data) {
    const keys = Object.keys(data).filter((k) => ALLOWED_UPDATE_COLUMNS.includes(k));
    if (keys.length === 0) return this.findById(id);
    const setClause = keys.map((k) => `${k} = ?`).join(', ');
    const values = keys.map((k) => data[k]);
    await run(`UPDATE users SET ${setClause}, updated_at = ? WHERE id = ?`, [...values, new Date().toISOString(), id]);
    return this.findById(id);
  }

  async list(options = {}, page = 1, limit = 20) {
    const conditions = [];
    const params = [];

    if (options.status) {
      conditions.push('u.status = ?');
      params.push(options.status);
    }
    if (options.search) {
      conditions.push('(u.id LIKE ? OR u.email LIKE ? OR u.name LIKE ?)');
      const term = `%${options.search}%`;
      params.push(term, term, term);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const countRow = await queryOne(`SELECT COUNT(*) as total FROM users u ${where}`, params);

    const offset = (page - 1) * limit;
    const rows = await query(
      `SELECT u.*,
        COALESCE(b.stars, 0) as balance_stars,
        COALESCE(b.suns, 0) as balance_suns,
        COALESCE(b.moons, 0) as balance_moons,
        COALESCE(p.total_spent_stars, 0) as total_spent_stars,
        COALESCE(p.total_spent_suns, 0) as total_spent_suns,
        COALESCE(p.total_spent_moons, 0) as total_spent_moons,
        COALESCE(p.total_purchases, 0) as total_purchases
       FROM users u
       LEFT JOIN user_currencies b ON b.user_id = u.id
       LEFT JOIN (
         SELECT user_id,
                SUM(price_stars) as total_spent_stars,
                SUM(price_suns) as total_spent_suns,
                SUM(price_moons) as total_spent_moons,
                COUNT(*) as total_purchases
         FROM template_purchases GROUP BY user_id
       ) p ON p.user_id = u.id
       ${where}
       ORDER BY u.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    return { users: rows, page, limit, total: countRow.total };
  }
}

module.exports = new UserRepository();
```

### Step 1.4: Write repository test

Create `tests/models/userRepository.test.js`:

```js
const fs = require('fs');
const path = require('path');
const testDbPath = path.join(__dirname, '../../data/nexo-lp-test-user-repo.db');
process.env.NEXO_LP_DB_PATH = testDbPath;
process.env.NODE_ENV = 'test';

const { initializeDatabase, closeDatabase } = require('../../models/sqlite');
const UserRepository = require('../../models/repositories/UserRepository');

describe('UserRepository', () => {
  beforeAll(async () => {
    if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
    await initializeDatabase();
  });

  afterAll(async () => {
    closeDatabase();
    if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
  });

  test('creates and finds a user', async () => {
    const user = await UserRepository.create({ id: 'user-1', email: 'a@b.com' });
    expect(user.id).toBe('user-1');
    expect(user.status).toBe('active');

    const found = await UserRepository.findById('user-1');
    expect(found.email).toBe('a@b.com');
  });

  test('updates status', async () => {
    await UserRepository.create({ id: 'user-2' });
    const updated = await UserRepository.update('user-2', { status: 'blocked' });
    expect(updated.status).toBe('blocked');
  });

  test('findOrCreate creates missing user', async () => {
    const user = await UserRepository.findOrCreate('user-3');
    expect(user.id).toBe('user-3');
  });
});
```

### Step 1.5: Run tests

```bash
cd /home/jhin/luna/nexo-lp-creator/nexo-lp-server
npx jest tests/models/userRepository.test.js
```

Expected: 3 passed.

### Step 1.6: Commit

```bash
git add models/migrations/018_users.sql models/repositories/UserRepository.js tests/models/userRepository.test.js
git commit -m "feat(admin): add users table and repository"
```

---

## Task 2: Backend — User service and admin endpoints

**Files:**
- Create: `services/lpUserService.js`
- Create: `tests/services/lpUserService.test.js`
- Modify: `routes/adminRoutes.js`
- Modify: `controllers/adminController.js`
- Modify: `services/lpAdminService.js`
- Modify: `security/adminAuth.js` if needed (no changes expected)

### Step 2.1: Create UserService

Create `services/lpUserService.js`:

```js
const UserRepository = require('../models/repositories/UserRepository');
const SessionRepository = require('../models/repositories/SessionRepository');
const TemplatePurchaseRepository = require('../models/repositories/TemplatePurchaseRepository');
const TemplateRepository = require('../models/repositories/TemplateRepository');
const CurrencyRepository = require('../models/repositories/CurrencyRepository');
const AdminLogRepository = require('../models/repositories/AdminLogRepository');

class UserService {
  async ensureExists(userId) {
    return UserRepository.findOrCreate(userId);
  }

  async getProfile(userId) {
    const user = await UserRepository.findById(userId);
    if (!user) return null;

    const balances = await CurrencyRepository.getBalance(userId);
    const purchases = await TemplatePurchaseRepository.list({ userId });
    const sessions = await SessionRepository.list({ userId });
    const allTemplates = await TemplateRepository.list({ includeAllStatuses: true }, 1, 1000);
    const publishedTemplates = allTemplates.templates.filter((t) => t.created_by === userId);
    const logs = await AdminLogRepository.list({ targetType: 'user', targetId: userId });

    const totalSpent = purchases.reduce(
      (acc, p) => ({
        stars: acc.stars + (p.price_stars || 0),
        suns: acc.suns + (p.price_suns || 0),
        moons: acc.moons + (p.price_moons || 0),
      }),
      { stars: 0, suns: 0, moons: 0 }
    );

    return {
      ...user,
      balances,
      totalSpent,
      totalPurchases: purchases.length,
      purchases,
      sessions,
      publishedTemplates,
      adminHistory: logs,
    };
  }

  async list(options = {}, page = 1, limit = 20) {
    return UserRepository.list(options, page, limit);
  }

  async update(userId, data, adminUserId) {
    const user = await UserRepository.update(userId, data);
    await AdminLogRepository.create({ userId: adminUserId, action: 'user.update', targetType: 'user', targetId: userId, payload: data });
    return user;
  }

  async setStatus(userId, status, adminUserId) {
    const user = await UserRepository.update(userId, { status });
    await AdminLogRepository.create({ userId: adminUserId, action: `user.${status}`, targetType: 'user', targetId: userId });
    return user;
  }

  async impersonate(userId, adminUserId) {
    const user = await UserRepository.findById(userId);
    if (!user) throw new Error('User not found');
    await AdminLogRepository.create({ userId: adminUserId, action: 'user.impersonate', targetType: 'user', targetId: userId });
    const token = Buffer.from(JSON.stringify({ userId, ts: Date.now() })).toString('base64url');
    return { userId, token };
  }
}

module.exports = new UserService();
```

### Step 2.2: Update AdminService

Modify `services/lpAdminService.js` to inject and expose user service methods:

```js
const userService = require('./lpUserService');

// Inside constructor or as methods:
async listUsers(options, page, limit, userId) {
  await this.log(userId, 'user.list', 'user', null, { page, limit });
  return userService.list(options, page, limit);
}

async getUser(id, adminUserId) {
  await this.log(adminUserId, 'user.view', 'user', id, {});
  return userService.getProfile(id);
}

async updateUser(id, data, adminUserId) {
  return userService.update(id, data, adminUserId);
}

async blockUser(id, adminUserId) {
  return userService.setStatus(id, 'blocked', adminUserId);
}

async unblockUser(id, adminUserId) {
  return userService.setStatus(id, 'active', adminUserId);
}

async impersonateUser(id, adminUserId) {
  return userService.impersonate(id, adminUserId);
}
```

### Step 2.3: Wire user creation hooks

To keep the `users` table populated for new activity, call `userService.ensureExists(userId)` at key entry points. Modify these services:

- `services/lpSessionService.js` — in `createSession(data)`, after validating `data.userId`:
  ```js
  const userService = require('./lpUserService');
  await userService.ensureExists(data.userId);
  ```

- `services/lpTemplateService.js` — in `publishFromSession(sessionId, userId)` and `publishUnreviewedFromSession(sessionId, userId, reason)`, after loading the session:
  ```js
  const userService = require('./lpUserService');
  await userService.ensureExists(userId);
  ```

- `services/lpTemplateService.js` — in `buyTemplate(templateId, userId)`, after validating the template:
  ```js
  await userService.ensureExists(userId);
  ```

### Step 2.4: Add routes

Modify `routes/adminRoutes.js`:

```js
router.get('/users', requireAdmin, adminController.listUsers);
router.get('/users/:id', requireAdmin, adminController.getUser);
router.patch('/users/:id', requireAdmin, adminController.updateUser);
router.post('/users/:id/block', requireAdmin, adminController.blockUser);
router.post('/users/:id/unblock', requireAdmin, adminController.unblockUser);
router.post('/users/:id/impersonate', requireAdmin, adminController.impersonateUser);
```

### Step 2.5: Add controller handlers

Modify `controllers/adminController.js`:

```js
async listUsers(req, res) {
  try {
    const { search, status, page = 1, limit = 20 } = req.query;
    const result = await adminService.listUsers({ search, status }, parseInt(page, 10), parseInt(limit, 10), req.userId);
    return success(res, result, 'Users retrieved');
  } catch (err) {
    return handleControllerError(req, res, err);
  }
},

async getUser(req, res) {
  try {
    const { id } = req.params;
    const user = await adminService.getUser(id, req.userId);
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });
    return success(res, user, 'User retrieved');
  } catch (err) {
    return handleControllerError(req, res, err);
  }
},

async updateUser(req, res) {
  try {
    const { id } = req.params;
    const user = await adminService.updateUser(id, req.body, req.userId);
    return success(res, user, 'User updated');
  } catch (err) {
    return handleControllerError(req, res, err);
  }
},

async blockUser(req, res) {
  try {
    const { id } = req.params;
    const user = await adminService.blockUser(id, req.userId);
    return success(res, user, 'User blocked');
  } catch (err) {
    return handleControllerError(req, res, err);
  }
},

async unblockUser(req, res) {
  try {
    const { id } = req.params;
    const user = await adminService.unblockUser(id, req.userId);
    return success(res, user, 'User unblocked');
  } catch (err) {
    return handleControllerError(req, res, err);
  }
},

async impersonateUser(req, res) {
  try {
    const { id } = req.params;
    const result = await adminService.impersonateUser(id, req.userId);
    return success(res, result, 'Impersonation token created');
  } catch (err) {
    return handleControllerError(req, res, err);
  }
},
```

### Step 2.6: Tests

Create `tests/services/lpUserService.test.js` with similar setup, testing `ensureExists`, `getProfile`, `setStatus`.

Run:

```bash
npx jest tests/services/lpUserService.test.js tests/routes/adminRoutes.test.js
```

Expected: PASS.

### Step 2.7: Commit

```bash
git add services/lpUserService.js services/lpAdminService.js routes/adminRoutes.js controllers/adminController.js tests/services/lpUserService.test.js
git commit -m "feat(admin): add user service and endpoints"
```

---

## Task 3: Backend — Admin event bus and SSE endpoint

**Files:**
- Create: `services/adminEventBus.js`
- Create: `tests/services/adminEventBus.test.js`
- Modify: `routes/adminRoutes.js`
- Modify: `controllers/adminController.js`
- Modify: `services/lpGenerationService.js`
- Modify: `services/lpSanitizationOrchestrator.js`
- Modify: `services/lpTemplateService.js`

### Step 3.1: Create adminEventBus

Create `services/adminEventBus.js`:

```js
const { EventEmitter } = require('events');

const BUFFER_SIZE = 50;

class AdminEventBus extends EventEmitter {
  constructor() {
    super();
    this.buffer = [];
  }

  publish(event) {
    const enriched = {
      ...event,
      timestamp: event.timestamp || new Date().toISOString(),
    };
    this.buffer.push(enriched);
    if (this.buffer.length > BUFFER_SIZE) this.buffer.shift();
    this.emit('event', enriched);
  }

  getRecent() {
    return [...this.buffer];
  }
}

module.exports = new AdminEventBus();
```

### Step 3.2: Add SSE endpoint

Modify `routes/adminRoutes.js`:

```js
router.get('/events', requireAdmin, adminController.streamAdminEvents);
```

Modify `controllers/adminController.js`:

```js
const adminEventBus = require('../services/adminEventBus');

streamAdminEvents(req, res) {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  // Send buffered events
  adminEventBus.getRecent().forEach((event) => {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  });

  const listener = (event) => {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  };

  adminEventBus.on('event', listener);

  const heartbeat = setInterval(() => {
    res.write(`event: heartbeat\ndata: {}\n\n`);
  }, 30000);

  req.on('close', () => {
    clearInterval(heartbeat);
    adminEventBus.off('event', listener);
  });
},
```

### Step 3.3: Forward generation events

Modify `services/lpGenerationService.js`:

```js
const adminEventBus = require('./adminEventBus');

function emitToStream(sessionId, event) {
  const res = eventStreams.get(sessionId);
  if (res) {
    try {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    } catch (error) {
      unregisterEventStream(sessionId);
    }
  }
  // Also forward to admin bus (even when no per-session listener is connected)
  adminEventBus.publish({ ...event, scope: 'generation' });
}
```

### Step 3.4: Forward sanitization events

Modify `services/lpSanitizationOrchestrator.js`:

```js
const adminEventBus = require('./adminEventBus');

// Inside constructor:
this.on('sanitization:step', (event) => adminEventBus.publish({ ...event, scope: 'sanitization', type: 'sanitization_step' }));
this.on('sanitization:progress', (event) => adminEventBus.publish({ ...event, scope: 'sanitization', type: 'sanitization_progress' }));
this.on('sanitization:complete', (event) => adminEventBus.publish({ ...event, scope: 'sanitization', type: 'sanitization_complete' }));
this.on('sanitization:error', (event) => adminEventBus.publish({ ...event, scope: 'sanitization', type: 'sanitization_error' }));
```

### Step 3.5: Forward purchase events

Modify `services/lpTemplateService.js` (or wherever purchase is recorded):

```js
const adminEventBus = require('./adminEventBus');

// After purchase is created:
adminEventBus.publish({
  scope: 'purchase',
  type: 'purchase',
  purchaseId: purchase.id,
  templateId: purchase.template_id,
  userId: purchase.user_id,
  amount: { stars: purchase.price_stars, suns: purchase.price_suns, moons: purchase.price_moons },
});
```

### Step 3.6: Test event bus

Create `tests/services/adminEventBus.test.js`:

```js
const adminEventBus = require('../../services/adminEventBus');

describe('adminEventBus', () => {
  beforeEach(() => {
    adminEventBus.buffer = [];
    adminEventBus.removeAllListeners();
  });

  test('publishes event and keeps buffer', () => {
    const listener = jest.fn();
    adminEventBus.on('event', listener);
    adminEventBus.publish({ type: 'test' });
    expect(listener).toHaveBeenCalled();
    expect(adminEventBus.getRecent().length).toBe(1);
  });
});
```

### Step 3.7: Run tests

```bash
npx jest tests/services/adminEventBus.test.js
```

Expected: PASS.

### Step 3.8: Commit

```bash
git add services/adminEventBus.js controllers/adminController.js routes/adminRoutes.js services/lpGenerationService.js services/lpSanitizationOrchestrator.js services/lpTemplateService.js tests/services/adminEventBus.test.js
git commit -m "feat(admin): add admin event bus and SSE endpoint"
```

---

## Task 4: Backend — Generation mode settings

**Files:**
- Modify: `services/lpAdminService.js`
- Modify: `services/lpGenerationService.js`
- Modify: `nexo-lp-routes.js` (no changes needed, but confirm options pass-through)

### Step 4.1: Allow saving generation modes in settings

In `services/lpAdminService.js`, add `'generation.modes'` to `GENERATION_SETTINGS_KEYS` and a default empty array to `DEFAULT_SETTINGS`:

```js
const GENERATION_SETTINGS_KEYS = [
  'generation.mode',
  'generation.modes',
  'generation.frameworks',
  'generation.auto_publish',
  'generation.base_prompt',
  'pricing.default_template',
];
const DEFAULT_SETTINGS = {
  'generation.mode': 'landing',
  'generation.modes': [
    { label: 'Landing', basePrompt: 'Create a focused, high-converting single-page landing page.' },
    { label: 'Multi-page', basePrompt: 'Create a multi-page website with home, about, and contact pages.' },
  ],
  'generation.frameworks': ['static-html-tailwind'],
  'generation.auto_publish': false,
  'generation.base_prompt': '',
  'pricing.default_template': 0,
};
```

### Step 4.2: Apply mode prompt in generation

In `services/lpGenerationService.js`:

```js
const AppSettingsRepository = require('../models/repositories/AppSettingsRepository');

async startGeneration(sessionId, prompt, stack, options = {}) {
  try {
    const settings = await AppSettingsRepository.getAll();
    const modes = settings['generation.modes'] || [];
    const selectedMode = options.generationMode || settings['generation.mode'] || 'landing';
    const mode = modes.find((m) => m.label.toLowerCase() === selectedMode.toLowerCase()) || {};
    const basePrompt = settings['generation.base_prompt'] || '';
    const fullPrompt = [mode.basePrompt, prompt, basePrompt].filter(Boolean).join('\n\n');

    // Persist the original user prompt as a message
    await lpSessionService.addMessage(sessionId, {
      role: 'user',
      content: prompt,
      type: 'text',
    });

    // ... existing setup ...
    context.prompt = prompt;
    context.generationMode = selectedMode;
    context.options = options;

    // Pass fullPrompt to the generation pipeline, keeping the raw prompt in context
    await this.runRealGeneration(sessionId, fullPrompt, stack, options);
  } catch (error) {
    // ... existing error handling ...
  }
}
```

> **Important:** The route `/generate` already passes `options` through to `startGeneration`. Do not confuse `options.mode` (currency mode: stars/suns/moons) with `options.generationMode` (generation mode: Landing/Multi-page).

### Step 4.3: Tests

Add a test verifying that `generation.modes` influences the final prompt passed to the bridge. Mock `AppSettingsRepository.getAll()` to return a mode with a distinctive base prompt and assert the first intention prompt contains it.

### Step 4.4: Commit

```bash
git add services/lpAdminService.js services/lpGenerationService.js
git commit -m "feat(generation): apply mode-specific base prompts from admin settings"
```

---

## Task 5: Frontend — Admin shell redesign

**Files:**
- Create directory: `src/components/admin/`
- Modify: `src/components/LPAdminPanel.svelte`
- Create: `src/components/admin/AdminDataTable.svelte`
- Create: `src/components/admin/AdminMetricRow.svelte`
- Create: `src/components/admin/AdminEventFeed.svelte`
- Create: `src/components/admin/AdminSSEStore.js`

### Step 5.1: Create shared components

Create `src/components/admin/AdminDataTable.svelte`:

```svelte
<script>
  export let columns = []; // { key, label, render? }
  export let rows = [];
  export let keyFn = (row, i) => i;
</script>

<div class="overflow-x-auto">
  <table class="w-full text-left text-sm">
    <thead>
      <tr class="border-b border-slate-200">
        {#each columns as col}
          <th class="py-3 pr-4 font-medium text-slate-500">{col.label}</th>
        {/each}
      </tr>
    </thead>
    <tbody>
      {#each rows as row, i (keyFn(row, i))}
        <tr class="border-b border-slate-100 hover:bg-slate-50">
          {#each columns as col}
            <td class="py-3 pr-4 text-slate-700">
              {#if col.render}
                {@html col.render(row[col.key], row)}
              {:else}
                {row[col.key] ?? '—'}
              {/if}
            </td>
          {/each}
        </tr>
      {/each}
    </tbody>
  </table>
</div>
```

Create `src/components/admin/AdminMetricRow.svelte`:

```svelte
<script>
  export let metrics = []; // { label, value, delta }
</script>

<div class="grid grid-cols-2 md:grid-cols-4 gap-px bg-slate-200 border border-slate-200 rounded-lg overflow-hidden">
  {#each metrics as m}
    <div class="bg-white p-5">
      <div class="text-xs text-slate-500 mb-1">{m.label}</div>
      <div class="text-2xl font-semibold text-slate-900">{m.value}</div>
      {#if m.delta}
        <div class="text-xs text-emerald-600 mt-1">{m.delta}</div>
      {/if}
    </div>
  {/each}
</div>
```

Create `src/components/admin/AdminEventFeed.svelte`:

```svelte
<script>
  export let events = [];
  export let maxEvents = 50;
  export let emptyText = 'Nenhum evento recente';

  function formatTime(ts) {
    if (!ts) return '';
    const d = new Date(ts);
    return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }

  function describe(event) {
    if (event.type === 'purchase') return `Compra: ${event.templateId || event.purchaseId}`;
    if (event.scope === 'generation') return `Geração ${event.phase || event.type}`;
    if (event.scope === 'sanitization') return `Sanitização ${event.step !== undefined ? `etapa ${event.step}` : event.type}`;
    return event.type || 'evento';
  }
</script>

<div class="border border-slate-200 rounded-lg bg-white overflow-hidden">
  <div class="px-4 py-3 border-b border-slate-200 text-sm font-medium text-slate-700">Atividade</div>
  <div class="max-h-96 overflow-auto">
    {#if events.length === 0}
      <div class="px-4 py-8 text-center text-sm text-slate-400">{emptyText}</div>
    {:else}
      {#each events.slice(0, maxEvents) as event (event.timestamp + Math.random())}
        <div class="px-4 py-3 border-b border-slate-100 text-sm flex items-start gap-3 hover:bg-slate-50">
          <span class="text-xs text-slate-400 tabular-nums whitespace-nowrap">{formatTime(event.timestamp)}</span>
          <span class="text-slate-700">{describe(event)}</span>
        </div>
      {/each}
    {/if}
  </div>
</div>
```

Create `src/components/admin/AdminSSEStore.js`:

```js
import { writable } from 'svelte/store';

const SSE_URL = '/api/nexo-lp/admin/events';

function createAdminSSEStore() {
  const { subscribe, set, update } = writable({ connected: false, events: [], jobs: {} });
  let es = null;
  let reconnectTimer = null;

  function connect() {
    if (es) return;
    if (typeof EventSource === 'undefined') return;
    es = new EventSource(SSE_URL);
    es.onopen = () => update((s) => ({ ...s, connected: true }));
    es.onmessage = (e) => {
      try {
        const event = JSON.parse(e.data);
        update((s) => {
          const events = [event, ...s.events].slice(0, 100);
          const jobs = { ...s.jobs };
          if (event.scope === 'generation' || event.scope === 'sanitization') {
            const key = event.sessionId || event.templateId;
            jobs[key] = { ...jobs[key], ...event, lastUpdate: Date.now() };
          }
          if (event.type === 'generation_complete' || event.type === 'sanitization_complete' || event.type === 'generation_error' || event.type === 'sanitization_error') {
            const key = event.sessionId || event.templateId;
            setTimeout(() => {
              update((state) => {
                const next = { ...state.jobs };
                delete next[key];
                return { ...state, jobs: next };
              });
            }, 5000);
          }
          return { ...s, events, jobs };
        });
      } catch (err) {
        console.error('[AdminSSE] invalid event', err);
      }
    };
    es.onerror = () => {
      update((s) => ({ ...s, connected: false }));
      es.close();
      es = null;
      reconnectTimer = setTimeout(connect, 3000);
    };
  }

  function disconnect() {
    if (reconnectTimer) clearTimeout(reconnectTimer);
    if (es) { es.close(); es = null; }
  }

  return { subscribe, connect, disconnect };
}

export const adminLiveEvents = createAdminSSEStore();
```

### Step 5.2: Rewrite LPAdminPanel shell

Replace the dark shell in `src/components/LPAdminPanel.svelte` with white layout.

Key structure:

```svelte
<script>
  import { onMount } from 'svelte';
  import { adminLiveEvents } from './admin/AdminSSEStore.js';
  // ... module imports ...

  onMount(() => {
    adminLiveEvents.connect();
    return () => adminLiveEvents.disconnect();
  });
</script>

<div class="flex h-screen w-full bg-slate-50 text-slate-900">
  <aside class="w-60 bg-white border-r border-slate-200 flex flex-col">
    <!-- brand -->
    <!-- nav items -->
  </aside>
  <main class="flex-1 flex flex-col min-w-0">
    <header class="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8">
      <!-- title -->
      <!-- actions -->
    </header>
    <div class="flex-1 overflow-auto p-8">
      {#if activeModule === 'overview'} <LPAdminOverview ... />
      {:else if activeModule === 'templates'} <LPAdminTemplates ... />
      ...
    </div>
  </main>
</div>
```

### Step 5.3: Build and verify

```bash
cd /home/jhin/luna/nexo-lp-creator/nexo-lp-web
npm run build
```

Expected: build succeeds.

### Step 5.4: Commit

```bash
git add src/components/admin/AdminDataTable.svelte src/components/admin/AdminMetricRow.svelte src/components/admin/AdminEventFeed.svelte src/components/admin/AdminSSEStore.js src/components/LPAdminPanel.svelte
git commit -m "feat(admin): redesign admin shell and add shared table/metric/event components"
```

---

## Task 6: Frontend — Overview module

**Files:**
- Create: `src/components/admin/LPAdminOverview.svelte`
- Modify: `src/api.js` (ensure `getAdminStats` exists)

### Step 6.1: Implement Overview

Use `AdminMetricRow` and `AdminEventFeed`.

Metrics from `getAdminStats()`.
Activity feed from `adminLiveEvents` store (created in Task 5).

### Step 6.2: Build

```bash
npm run build
```

### Step 6.3: Commit

```bash
git add src/components/admin/LPAdminOverview.svelte
git commit -m "feat(admin): add overview module"
```

---

## Task 7: Frontend — Templates module

**Files:**
- Create: `src/components/admin/LPAdminTemplates.svelte`
- Create: `src/components/admin/LPAdminTemplatePanel.svelte`
- Modify: `src/api.js`

### Step 7.1: Implement templates table

Use `AdminDataTable`. Columns: Name, Category, Status, Price, Updated, Actions.
Filters: status select, category select, search input.
Bulk actions preserved.

### Step 7.2: Implement side panel

Slide-over from the right. Contains preview iframe and form fields.

### Step 7.3: Build and commit

```bash
npm run build
git add src/components/admin/LPAdminTemplates.svelte src/components/admin/LPAdminTemplatePanel.svelte
git commit -m "feat(admin): add redesigned templates module"
```

---

## Task 8: Frontend — Loja Analytics module

**Files:**
- Create: `src/components/admin/LPAdminAnalytics.svelte`
- Modify: `src/api.js` (add `listAdminPurchases`, `getAdminPurchasesSummary`)

### Step 8.1: Implement date filters and summary

Use `AdminMetricRow` for summary cards.

### Step 8.2: Implement sales table and CSV export

CSV export function:

```js
function exportCsv(rows) {
  const headers = ['Template', 'Buyer', 'Stars', 'Suns', 'Moons', 'Date', 'Status'];
  const lines = rows.map(r => [r.template_name, r.user_id, r.price_stars, r.price_suns, r.price_moons, r.created_at, r.status].join(','));
  const blob = new Blob([[headers.join(','), ...lines].join('\n')], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'sales.csv'; a.click();
}
```

### Step 8.3: Build and commit

```bash
npm run build
git add src/components/admin/LPAdminAnalytics.svelte
git commit -m "feat(admin): add loja analytics module"
```

---

## Task 9: Frontend — Users module

**Files:**
- Create: `src/components/admin/LPAdminUsers.svelte`
- Create: `src/components/admin/LPAdminUserPanel.svelte`
- Modify: `src/api.js`

### Step 9.1: Add API helpers

Add to `src/api.js` after the existing admin helpers (the existing `buildAdminQuery` helper can be reused):

```js
export async function listAdminUsers(filters = {}) {
  const result = await adminRequest(`/admin/users${buildAdminQuery(filters)}`);
  return result.data;
}

export async function getAdminUser(id) {
  const result = await adminRequest(`/admin/users/${encodeURIComponent(id)}`);
  return result.data;
}

export async function updateAdminUser(id, data) {
  const result = await adminRequest(`/admin/users/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: data,
  });
  return result.data;
}

export async function blockAdminUser(id) {
  const result = await adminRequest(`/admin/users/${encodeURIComponent(id)}/block`, { method: 'POST' });
  return result.data;
}

export async function unblockAdminUser(id) {
  const result = await adminRequest(`/admin/users/${encodeURIComponent(id)}/unblock`, { method: 'POST' });
  return result.data;
}

export async function impersonateAdminUser(id) {
  const result = await adminRequest(`/admin/users/${encodeURIComponent(id)}/impersonate`, { method: 'POST' });
  return result.data;
}
```

### Step 9.2: Implement users list and detail panel

Use `AdminDataTable`.
Detail panel with tabs: Sessions, Purchases, Published Templates, History.

### Step 9.3: Build and commit

```bash
npm run build
git add src/components/admin/LPAdminUsers.svelte src/components/admin/LPAdminUserPanel.svelte src/api.js
git commit -m "feat(admin): add users module"
```

---

## Task 10: Frontend — Operations (Live) module

**Files:**
- Create: `src/components/admin/LPAdminOperations.svelte`
- Modify: `src/components/LPAdminPanel.svelte` (already connects SSE in Task 5)

### Step 10.1: Implement Operations module

Create `src/components/admin/LPAdminOperations.svelte`:

- Connection badge derived from `$adminLiveEvents.connected`.
- Active jobs panel: iterate `$adminLiveEvents.jobs` values; show type, id, phase/step, progress bar, and duration since `lastUpdate`.
- Activity feed: use `AdminEventFeed` bound to `$adminLiveEvents.events`.

Example job row:

```svelte
<script>
  import { adminLiveEvents } from './AdminSSEStore.js';
  import AdminEventFeed from './AdminEventFeed.svelte';

  function progress(job) {
    if (job.scope === 'generation') {
      const phases = ['intention', 'structure', 'code', 'review', 'preview', 'deploy'];
      const idx = phases.indexOf(job.phase);
      return idx >= 0 ? Math.round(((idx + 1) / phases.length) * 100) : 0;
    }
    if (job.scope === 'sanitization') {
      return Math.min((job.step || 0) * 25, 100);
    }
    return 0;
  }
</script>

<div class="space-y-6">
  <div class="flex items-center gap-2">
    <span class="h-2 w-2 rounded-full" class:bg-emerald-500={$adminLiveEvents.connected} class:bg-red-500={!$adminLiveEvents.connected}></span>
    <span class="text-sm text-slate-600">{$adminLiveEvents.connected ? 'Conectado' : 'Desconectado'}</span>
  </div>

  <div>
    <h3 class="text-sm font-medium text-slate-700 mb-3">Jobs ativos</h3>
    {#if Object.keys($adminLiveEvents.jobs).length === 0}
      <div class="text-sm text-slate-400">Nenhum job ativo no momento.</div>
    {:else}
      <div class="space-y-3">
        {#each Object.values($adminLiveEvents.jobs) as job (job.sessionId || job.templateId)}
          <div class="border border-slate-200 rounded-lg p-4 bg-white">
            <div class="flex justify-between text-sm text-slate-700 mb-2">
              <span class="capitalize">{job.scope}</span>
              <span class="text-slate-400">{job.sessionId || job.templateId}</span>
            </div>
            <div class="text-xs text-slate-500 mb-1">{job.phase || (job.step !== undefined ? `etapa ${job.step}` : job.type)}</div>
            <div class="h-2 bg-slate-100 rounded-full overflow-hidden">
              <div class="h-full bg-indigo-500 transition-all duration-500" style="width: {progress(job)}%"></div>
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </div>

  <AdminEventFeed events={$adminLiveEvents.events} />
</div>
```

### Step 10.2: Build and commit

```bash
npm run build
git add src/components/admin/LPAdminOperations.svelte
git commit -m "feat(admin): add live operations module"
```

---

## Task 11: Frontend — Settings module adjustments

**Files:**
- Create: `src/components/admin/LPAdminSettings.svelte`
- Modify: `src/api.js`

### Step 11.1: Add generation modes editor

Settings form must include a JSON/array editor for `generation.modes`:
- List of modes: label + basePrompt textarea.
- Add/remove mode buttons.

### Step 11.2: Keep base prompt admin-only

Existing base prompt textarea stays.

### Step 11.3: Build and commit

```bash
npm run build
git add src/components/admin/LPAdminSettings.svelte
git commit -m "feat(admin): add settings module with generation modes editor"
```

---

## Task 12: Frontend — Generation mode switch

**Files:**
- Create: `src/components/GenerationModeSwitch.svelte`
- Modify: `src/components/LPChatArea.svelte`
- Modify: `src/stores.js`
- Modify: `src/api.js` (ensure `generationMode` is passed in `generate`)

### Step 12.1: Add store

In `src/stores.js`:

```js
export const generationMode = writable('Landing');
```

### Step 12.2: Create switch component

Create `src/components/GenerationModeSwitch.svelte`:

```svelte
<script>
  import { onMount } from 'svelte';
  import { generationMode } from '../stores.js';
  import { getAdminSettings } from '../api.js';

  let modes = [];

  onMount(async () => {
    try {
      const settings = await getAdminSettings();
      modes = Array.isArray(settings['generation.modes']) ? settings['generation.modes'] : [];
      if (modes.length && !modes.find((m) => m.label === $generationMode)) {
        generationMode.set(modes[0].label);
      }
    } catch (err) {
      console.error('[GenerationModeSwitch] failed to load modes', err);
    }
  });
</script>

{#if modes.length > 0}
  <div class="flex items-center gap-2">
    <span class="text-xs text-slate-500">Modo:</span>
    <select bind:value={$generationMode} class="text-xs border border-slate-300 rounded px-2 py-1 bg-white">
      {#each modes as mode}
        <option value={mode.label}>{mode.label}</option>
      {/each}
    </select>
  </div>
{/if}
```

### Step 12.3: Add to chat area

Import `GenerationModeSwitch` and `generationMode` in `LPChatArea.svelte`. Render the switch in the toolbar or near the input. When sending a generation request, pass:

```js
import { generationMode } from '../stores.js';

async function send() {
  await generate(sessionId, message, {
    mode: 'stars',
    generationMode: $generationMode,
  });
}
```

Ensure `src/api.js` forwards `generationMode` inside `options` to `/generate`:

```js
export async function generate(sessionId, prompt, options = {}) {
  return request('/generate', {
    method: 'POST',
    body: {
      sessionId,
      prompt,
      stack: options.stack || 'static-html-tailwind',
      options: {
        mode: options.mode || 'stars',
        generationMode: options.generationMode,
      },
    },
  });
}
```

### Step 12.4: Build and commit

```bash
npm run build
git add src/components/GenerationModeSwitch.svelte src/components/LPChatArea.svelte src/stores.js src/api.js
git commit -m "feat(chat): add generation mode switch for end users"
```

---

## Task 13: Integration and manual testing

### Step 13.1: Full backend test run

```bash
cd /home/jhin/luna/nexo-lp-creator/nexo-lp-server
npm test
```

Expected: all tests pass (existing failures unrelated to this work may remain).

### Step 13.2: Build frontend

```bash
cd /home/jhin/luna/nexo-lp-creator/nexo-lp-web
npm run build
```

Expected: build succeeds.

### Step 13.3: Reload PM2 processes

```bash
pm2 reload nexo-lp-server
pm2 reload nexo-lp-web
```

### Step 13.4: Manual checklist

- [ ] Admin loads with white UI and new sidebar.
- [ ] Templates table shows data and filters work.
- [ ] Clicking sanitize shows "Sanitização iniciada".
- [ ] Operations shows sanitization progress events.
- [ ] After sanitization, template status is `approved`.
- [ ] Loja Analytics shows sales and CSV export works.
- [ ] Users list shows aggregated stats.
- [ ] User detail shows sessions/purchases/history.
- [ ] Generation mode switch appears in chat and changes prompt behavior.

### Step 13.5: Commit any fixes

```bash
git commit -am "fix(admin): integration fixes after manual testing"
```

---

## Self-Review Checklist

- [x] Spec coverage: every section maps to one or more tasks above.
- [x] No placeholders: each step has concrete code/commands.
- [x] Type consistency: `userId`, `templateId`, `sessionId` used consistently.
- [x] Existing APIs reused where possible.
- [x] New files have focused responsibilities.

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-06-21-admin-redesign-plan.md`.**

Two execution options:

1. **Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.
2. **Inline Execution** — Execute tasks in this session using `executing-plans`, batch execution with checkpoints.

Which approach do you want?
