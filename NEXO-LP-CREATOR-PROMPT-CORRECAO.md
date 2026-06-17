# Supreme Correction Prompt — Kimi K2.7 Agent Swarm
## NEXO Landing Page Creator v3.0 — Fix Everything That Was Claimed But Not Delivered

> ⚠️ **MANDATORY LANGUAGE RULE:** The NEXO Landing Page Creator product, its generated landing pages, templates, UI labels, error messages, metadata, prompts, skills, comments, and documentation MUST be in **ENGLISH**. Conversational responses to the user may be in their language, but every deliverable file MUST be written in clear, professional English. Translate everything before saving.

---

## 1. SITUATION

A previous Agent Swarm run claimed to deliver a complete **NEXO Landing Page Creator v3.0** with 168 files, full backend, frontend, AI integration, sandbox security, template store, and end-to-end tests. However, the actual delivery was incomplete, simulated, or non-functional.

Your mission is to **audit the existing codebase**, identify every gap between what was claimed and what was actually delivered, and **fix or rebuild everything until the product is genuinely functional**.

The existing code is located at:

```
/home/jhin/luna/nexo-lp-creator/
```

---

## 2. WHAT WAS CLAIMED VS WHAT WAS ACTUALLY DELIVERED

The previous swarm claimed the following. You must verify each item and fix anything that is fake, simulated, incomplete, or broken.

### 2.1 Backend (38 files claimed)

| Claimed | Likely Reality | Required Fix |
|---------|---------------|--------------|
| Express server with 14 endpoints | Partial routes exist | Ensure all 14 endpoints work with real logic |
| 12 services | Some are stubs | Implement real logic or remove and rebuild |
| SQLite database with 5 migrations | JSON in-memory fake DB | Replace with real SQLite (better-sqlite3 or sqlite3) |
| 2 workers | May be empty | Implement real background workers or remove |

### 2.2 Frontend (30 files claimed)

| Claimed | Likely Reality | Required Fix |
|---------|---------------|--------------|
| Svelte 4 interface | May be minimal/unbuilt | Build a working UI that talks to the backend |
| Chat, preview, deploy panel | May be placeholders | Make all panels functional |
| Template store | May be static | Connect to real template API |

### 2.3 Security (5 files claimed, 103 tests)

| Claimed | Likely Reality | Required Fix |
|---------|---------------|--------------|
| Sandbox executor | May be stub | Implement real path validation, shell whitelist, env filter |
| 103 security tests | Probably do not exist | Create and run real security tests |

### 2.4 Core Logic (75 files claimed)

| Claimed | Likely Reality | Required Fix |
|---------|---------------|--------------|
| 6 validators | May be stubs | Implement real validation logic |
| 6 stacks | May be empty templates | Create real working stack templates |
| 4 seed templates | Out of scope for this correction | Do NOT create — will be generated later during app testing |

### 2.5 AI Prompts (20 files claimed)

| Claimed | Likely Reality | Required Fix |
|---------|---------------|--------------|
| Prompt supremo + 12 subagent prompts | May be missing | Create all prompts in `agents/lp-prompts/` |
| `lp-skills/SKILLS.md` | Probably missing | Create the skills file |

### 2.6 AI Integration

| Claimed | Likely Reality | Required Fix |
|---------|---------------|--------------|
| Kimi bridge integration | Mock mode / fake adapter | Integrate real `kimi-bridge.cjs` from luna-kernel |
| Luna creates, sanitizes, fixes bugs | Simulated | Use real Luna calls |

### 2.7 Tests

| Claimed | Likely Reality | Required Fix |
|---------|---------------|--------------|
| End-to-end tests passing | Likely false | Run real tests, fix failures, report truth |

---

## 3. REPOSITORIES TO CLONE AND REUSE

Clone these repositories into `/tmp/swarm-audit/` and reuse real components:

```bash
git clone https://github.com/Jhin1v9/luna-kernel.git /tmp/swarm-audit/luna-kernel
git clone https://github.com/Jhin1v9/NexoDashboard.git /tmp/swarm-audit/NexoDashboard
```

Reusable components from `luna-kernel`:
- `kimi-bridge.cjs` — real Kimi Web automation bridge
- `luna-soul.cjs` — message orchestrator
- `luna-tools.cjs` — tool executor (but wrap with sandbox)
- `luna-git.cjs` — git operations
- `luna-code-validator.cjs` — code validation
- `luna-workspace.cjs` — workspace management
- `luna-tool-guard.cjs` / `meta-executor-secure.cjs` — security references

Do NOT modify the cloned repos. Copy/adapt files into `/home/jhin/luna/nexo-lp-creator/`.

---

## 4. MANDATORY AUDIT CHECKLIST

Before writing any new code, audit the existing project and produce a report at:

```
/home/jhin/luna/nexo-lp-creator/AUDIT-REPORT.md
```

For each file and feature, mark one of:
- ✅ REAL — works as claimed
- ⚠️ PARTIAL — exists but incomplete
- ❌ MISSING — not delivered
- 🐛 BROKEN — exists but does not work

Minimum audit areas:

### Backend Audit
- [ ] `nexo-lp-server.js` starts without errors
- [ ] All routes in `nexo-lp-routes.js` are implemented and tested
- [ ] `models/sqlite.js` uses real SQLite, not JSON in-memory
- [ ] Migrations exist and run automatically
- [ ] Repositories use real SQL
- [ ] Services have real logic, not stubs
- [ ] Workers actually run background jobs
- [ ] Bridge adapter connects to real Kimi Web

### Frontend Audit
- [ ] `npm run build` succeeds
- [ ] UI loads at `http://localhost:3460`
- [ ] Chat sends messages and receives SSE events
- [ ] Preview iframe renders generated HTML
- [ ] Deploy panel works (GitHub or ZIP fallback)
- [ ] Template store lists and uses templates

### Security Audit
- [ ] `sandbox-executor.cjs` really restricts paths
- [ ] `path-validator.cjs` blocks traversal
- [ ] `shell-whitelist.cjs` limits commands
- [ ] `env-filter.cjs` removes secrets
- [ ] Security tests exist and pass

### Core Audit
- [ ] Validators produce real scores and issues
- [ ] Stacks have real `package.json`, configs, build commands
- [ ] Quality gates have thresholds
- [ ] (Seed templates will be created later during app testing — out of scope for this correction)

### AI Prompts Audit
- [ ] `lp-skills/SKILLS.md` exists and is comprehensive
- [ ] All subagent prompts exist (`01-intention.md` through `10-build-verifier.md`)
- [ ] Reviewer prompts exist (code, seo, cro, security, build, performance)
- [ ] Prompts are in English and follow the plan

---

## 5. REQUIRED FIXES (in priority order)

### Fix 1 — Replace Fake SQLite with Real SQLite

The current `models/sqlite.js` is an in-memory JSON fake. Replace it with real `better-sqlite3` (preferred) or `sqlite3`.

Requirements:
- Use `better-sqlite3` if it compiles; fallback to `sqlite3` if not.
- Keep the same API surface: `query`, `queryOne`, `run`, `exec`, `table`, `transaction`.
- All migrations in `models/migrations/*.sql` must run on startup.
- Data must persist to `./data/nexo-lp.db`.

If compilation fails, document it in `AUDIT-REPORT.md` and use `sqlite3` package.

### Fix 2 — Real AI Bridge Integration

Current `lpBridgeAdapter.cjs` likely simulates responses. Replace with real integration:

- Copy/adapt `kimi-bridge.cjs` from `/tmp/swarm-audit/luna-kernel/`.
- Create `lpBridgeAdapter.cjs` that initializes a bridge session with isolated `userId` (`nlp-{timestamp}-{hash}`).
- Send prompts to Kimi Web and receive responses.
- Parse tool calls / action events from bridge events.
- Emit `action_start`, `action_end`, `!response+tool` as required.
- If Kimi Web is not available in this environment, implement a **clear mock mode** with a feature flag and document it.

### Fix 3 — Real Generation Flow

Current `lpGenerationService.js` has `mockMode` that generates fake HTML. Replace with:

- Intention extraction via Architect prompt
- Structure design via Designer prompt
- Code generation via Coder prompt
- Review via Critic prompt
- Preview saving
- Deploy preparation

Each phase must:
1. Read the correct prompt file.
2. Call the bridge.
3. Parse the response.
4. Save results.
5. Emit SSE events.

### Fix 4 — Working Security Sandbox

Implement real security in `security/`:

- `path-validator.cjs`: resolve and validate all paths under workspace.
- `shell-whitelist.cjs`: allow only safe commands (`git`, `node`, `npm`, `mkdir`, `cp`, `mv`, `rm` with restrictions).
- `env-filter.cjs`: strip `JWT_SECRET`, `INTERNAL_API_TOKEN`, `DATABASE_URL`, `GITHUB_TOKEN`.
- `sandbox-executor.cjs`: execute commands with `cwd` restricted, optionally via `firejail` or `systemd-run`.

Create security tests that prove path traversal and command injection are blocked.

### Fix 5 — Working Frontend Build

- Fix any build errors in `nexo-lp-web/`.
- Ensure `npm run build` produces `dist/`.
- Ensure the UI can connect to backend SSE endpoint.
- Ensure all buttons and panels trigger real API calls.

### Fix 6 — Real Stacks (Templates Seed Are Out Of Scope)

- Create 6 stack templates in `nexo-lp-core/stacks/` with real files.
- Each stack must have `template.json`, `package.json`, build commands, and README.
- **DO NOT create seed templates in `nexo-lp-core/templates/seed/`**. Those will be created later when testing the app.

### Fix 7 — Real Validators and Quality Gates

- Implement `htmlValidator.js`, `seoValidator.js`, `croValidator.js`, `securityValidator.js`, `buildValidator.js`, `performanceValidator.js`.
- They must return real scores and concrete issues.
- `quality-gates.json` must have thresholds.

### Fix 8 — Real Prompts

Create all missing prompts in `nexo-lp-server/agents/lp-prompts/`:
- `00-system.md` — prompt supremo
- `01-intention.md` through `10-build-verifier.md`
- `reviewer-code.md`, `reviewer-seo.md`, `reviewer-cro.md`, `reviewer-security.md`, `reviewer-build.md`, `reviewer-performance.md`

Create `nexo-lp-server/agents/lp-skills/SKILLS.md`.

---

## 6. AGENT SWARM FOR CORRECTION

Coordinate these agents:

| Agent | Task |
|-------|------|
| **Auditor** | Create `AUDIT-REPORT.md` with exact gaps. |
| **Database-Engineer** | Replace fake SQLite with real SQLite. |
| **Bridge-Engineer** | Implement real Kimi bridge integration. |
| **Security-Engineer** | Implement real sandbox and security tests. |
| **Backend-Engineer** | Fix services, routes, workers. |
| **Frontend-Engineer** | Fix Svelte build and UI functionality. |
| **Core-Engineer** | Fix validators, stacks, templates, quality gates. |
| **Prompt-Engineer** | Create all missing prompts and skills. |
| **QA-Engineer** | Write and run tests. |
| **Final-Reviewer** | Re-audit and produce final report. |

Rules:
- Auditor must finish before others start.
- Backend, frontend, security, and core can run in parallel after audit.
- Bridge and database are dependencies for generation service.
- QA runs after all fixes.

---

## 7. MANDATORY TESTS

Run these tests and report results in `CORRECTION-REPORT.md`:

### Smoke Tests
- [ ] `npm install` completes
- [ ] `npm run build` completes
- [ ] Server starts: `node nexo-lp-server/nexo-lp-server.js`
- [ ] `curl http://localhost:3460/api/nexo-lp/health` returns healthy

### API Tests
- [ ] `POST /api/nexo-lp/sessions` creates session
- [ ] `GET /api/nexo-lp/sessions/:id` returns session
- [ ] `POST /api/nexo-lp/generate` starts generation
- [ ] SSE stream emits `action_start` and `action_end` events
- [ ] `GET /api/nexo-lp/preview/:sessionId` returns HTML
- [ ] `POST /api/nexo-lp/bug-detect` returns real scores
- [ ] `GET /api/nexo-lp/templates` returns an empty list or existing templates (seed templates out of scope)
- [ ] `GET /api/nexo-lp/stacks` returns stacks

### AI Tests
- [ ] Bridge adapter can send a message and get a response
- [ ] Generation flow calls bridge at least once per phase
- [ ] Generated HTML contains `<!DOCTYPE html>` and Tailwind classes

### Security Tests
- [ ] Path traversal is blocked
- [ ] Dangerous shell command is blocked
- [ ] Secrets are filtered from subprocess env

### Frontend Tests
- [ ] `nexo-lp-web/dist/index.html` exists
- [ ] UI loads without console errors
- [ ] Chat connects to SSE

---

## 8. FINAL DELIVERABLES

When finished, the project must contain:

1. `AUDIT-REPORT.md` — what was wrong
2. `CORRECTION-REPORT.md` — what was fixed, test results
3. Working backend on port 3460
4. Built frontend in `nexo-lp-web/dist/`
5. Real SQLite database at `data/nexo-lp.db`
6. Real or clearly documented mock AI bridge
7. Security tests passing
8. API tests passing
9. All prompts and skills in English
10. (Seed templates are out of scope — do not create them)

---

## 9. CONSTRAINTS

- Do not modify `/home/jhin/.luna-kernel/` or `NEXO_DASHBOARD_PRO/`.
- Do not delete files unless they are clearly wrong.
- Do not claim something works unless you tested it.
- All reports and code comments must be in English.
- If a feature cannot be fully implemented, document it honestly with a concrete next step.

---

## 10. COMMUNICATION

At the end of each phase, report:
- What was audited/fixed
- What remains broken
- Blockers
- Test results

Be direct. No fake claims. If something is still simulated, say so.

---

## 11. FINAL MANDATORY REMINDER

🌙 **Do not claim delivery of anything that was not actually built and tested.**  
✨ **Every file, feature, and test must be real and verifiable.**  
🚀 **Fix it right, or document exactly why it cannot be fixed now.**
