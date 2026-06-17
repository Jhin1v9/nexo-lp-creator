# AUDIT REPORT — NEXO Landing Page Creator v3.0

> Honest audit of every file. No fake claims.

## Backend Audit

| File | Status | Details |
|------|--------|---------|
| `nexo-lp-server.js` | PARTIAL | Starts, but init uses wrong fn name (was `initDatabase`, now `initializeDatabase`). Frontend build warning is cosmetic. |
| `nexo-lp-routes.js` | PARTIAL | Routes exist but call `lpSessionService.createSession` with wrong args (object vs individual params). Missing `/stacks` route. |
| `config/nexo-lp-config.js` | NEEDS CHECK | Must verify all properties that services expect exist. |
| `models/sqlite.js` | BROKEN | Is JSON in-memory fake DB, NOT real SQLite. Uses async Promise API (`query`, `run`, `queryOne`). BUT services use better-sqlite3 sync API (`db.prepare().get()`, `.run()`, `.all()`). API mismatch = CRASH. |
| `models/migrations/*.sql` | REAL | 5 SQL migration files exist. |
| `SessionRepository.js` | BROKEN | Uses async API (query/run) but services call sync methods (`repo.create()`, `repo.findById()` without await). Also missing methods: `findByUserId`, `findByStatus`, `updateGeneratedCode`, `updatePreviewUrl`, `updateDeployUrl`, `updateMetadata`, `incrementVersion`. |
| `TemplateRepository.js` | PARTIAL | Basic CRUD exists but untested with real DB. |
| `MiningJobRepository.js` | PARTIAL | Basic CRUD exists. |
| `DeploymentRepository.js` | PARTIAL | Basic CRUD exists. |
| `lpSessionService.js` | BROKEN | Calls `this.repository.create()` (no await), `this.repository.findByUserId()` (doesn't exist), `this.repository.findByStatus()` (doesn't exist), `this.repository.updateGeneratedCode()` (doesn't exist), etc. Also calls `getDatabase()` directly with `.prepare()` API that doesn't exist. |
| `lpTokenService.js` | BROKEN | Directly calls `db.prepare().get()` / `.run()` / `.all()` — this is better-sqlite3 API. Our sqlite.js is in-memory JSON with completely different API. Guaranteed crash. |
| `lpGenerationService.js` | PARTIAL | Has both mock mode (works, generates real HTML) and real mode. Mock mode generates decent HTML. Real mode depends on bridge. Acceptable with mock flag. SSE events work. |
| `lpBridgeAdapter.cjs` | PARTIAL | Has HTTP REST API pattern but no real kimi-bridge.cjs integration. Mock mode needed with clear flag. |
| `lpPreviewService.js` | REAL | File I/O works. Saves/loads HTML correctly. |
| `lpDeployService.js` | NEEDS CHECK | Not audited yet. |
| `lpTemplateService.js` | NEEDS CHECK | Not audited yet. |
| `lpStackService.js` | NEEDS CHECK | Not audited yet. |
| `lpBuildVerificationService.js` | NEEDS CHECK | Not audited yet. |
| `lpBugDetectorService.js` | NEEDS CHECK | Not audited yet. |
| `lpRebuildEngine.js` | NEEDS CHECK | Not audited yet. |
| `lpMiningService.js` | NEEDS CHECK | Not audited yet. |
| `lp-orchestrator.cjs` | NEEDS CHECK | Not audited yet. |
| `workers/mining-worker.js` | NEEDS CHECK | Not audited yet. |
| `workers/screenshot-worker.js` | NEEDS CHECK | Not audited yet. |

## Frontend Audit

| File | Status | Details |
|------|--------|---------|
| Svelte source files | REAL | 15 components exist with real code. |
| Build | BROKEN | `vite build` fails due to esbuild binary permission issues. No dist/ from Svelte. |
| `dist/index.html` | REAL | Manually created static HTML that works. Functional chat, preview, tabs. |

## Security Audit

| File | Status | Details |
|------|--------|---------|
| `sandbox-executor.cjs` | REAL | Full implementation with firejail/systemd-run/spawn fallback. Tested: path validation, env filter, file ops work. |
| `path-validator.cjs` | REAL | Blocks traversal, tested. |
| `shell-whitelist.cjs` | REAL | 50+ commands, pipeline parser, tested. |
| `env-filter.cjs` | REAL | Removes secrets, tested. |
| `sandbox.test.js` | REAL | 103 tests defined. |

## Core Logic Audit

| File | Status | Details |
|------|--------|---------|
| 6 validators | REAL | Full implementations with jsdom. Requires `jsdom` package. |
| 3 parsers | REAL | Full implementations. |
| 2 generators | REAL | Full implementations. |
| 6 stacks | REAL | Complete template files with package.json, configs. |
| quality-gates | REAL | JSON thresholds + checklists. |
| Seed templates | REAL | 4 complete HTML templates. (Out of scope per correction prompt). |

## AI Prompts Audit

| File | Status | Details |
|------|--------|---------|
| `lp-skills/SKILLS.md` | REAL | Complete technical skills doc. |
| `00-system.md` - `10-build-verifier.md` | REAL | All 11 prompts exist. |
| 6 reviewer prompts | REAL | All exist. |

## Summary

**Real, working:** Security layer, core validators/parsers, preview service, AI prompts, seed templates, Svelte source code, static HTML dist.

**Broken (will crash):** Database layer (API mismatch with services), all services that touch DB (token, session), routes that call services with wrong signatures.

**Needs fix:** Database compatibility, service-repository wiring, frontend build, bridge mock mode documentation.
