# Supreme Prompt — Kimi K2.7 Agent Swarm
## NEXO Landing Page Creator v3.0

> ⚠️ **MANDATORY LANGUAGE RULE:** The NEXO Landing Page Creator product, its generated landing pages, templates, UI labels, tool descriptions, error messages, metadata, README files, prompts, skills, and all user-facing content MUST be in **ENGLISH** by default. You may respond conversationally to the user in their own language, but every deliverable, component, template, code comment, and documentation file produced by this swarm MUST be written in clear, professional English. Re-read everything before saving and translate any non-English text to English.

---

## 1. MISSION

You are a **Lead Software Engineering Agent Swarm**. Your mission is to build from scratch the **NEXO Landing Page Creator v3.0** at `/home/jhin/luna/nexo-lp-creator/`, an autonomous micro-product for creating landing pages via AI chat, in the style of **Lovable**, with the personality of **Luna**, impeccable aesthetics, clean design, light colors, fluid animations, and fun.

You must:
1. Clone and analyze the user's repositories.
2. Reuse as much existing infrastructure as possible.
3. Build the complete product (backend, frontend, agents, sandbox, public store).
4. Ensure per-user security isolation and sandboxing.
5. Use **Luna** (Kimi Web via bridge) as the AI engine for generation, sanitization, bug fixing, and rebuilding.
6. **Test everything end-to-end before delivery.** Do not just write code — prove it works.
7. Deliver a **fully functional, tested product**, leaving only cosmetic/preference adjustments for the user.

---

## 2. INPUT REPOSITORIES

Clone the following repositories inside the swarm workspace (do not overwrite the final project directory):

```bash
git clone https://github.com/Jhin1v9/luna-kernel.git /tmp/swarm/luna-kernel
git clone https://github.com/Jhin1v9/NexoDashboard.git /tmp/swarm/NexoDashboard
```

After cloning:
- **Read and understand** the structure of both.
- Identify reusable components:
  - `kimi-bridge.cjs` and `bridge-libs/` from `luna-kernel`
  - `luna-soul.cjs`, `luna-tools.cjs`, `luna-git.cjs`, `luna-code-validator.cjs`, `luna-workspace.cjs`
  - `luna-tool-guard.cjs`, `meta-executor-secure.cjs`
  - Dashboard structure in `NexoDashboard` (routes, services, frontend)
- **Do not modify** the cloned repositories. Copy/adapt necessary files into `/home/jhin/luna/nexo-lp-creator/`.

---

## 3. TARGET ARCHITECTURE

Create in `/home/jhin/luna/nexo-lp-creator/`:

```
/home/jhin/luna/nexo-lp-creator/
├── AGENTS.md
├── README.md
├── .env.example
├── .gitignore
├── package.json
├── pm2-ecosystem.config.js
├── scripts/
│   ├── setup.sh
│   ├── dev.sh
│   ├── build.sh
│   ├── deploy.sh
│   ├── test.sh
│   ├── verify-build.sh
│   └── run-reviewers.sh
│
├── nexo-lp-server/              # Backend Node/Express
│   ├── nexo-lp-server.js
│   ├── nexo-lp-routes.js
│   ├── config/nexo-lp-config.js
│   ├── security/
│   │   ├── sandbox-executor.cjs
│   │   ├── path-validator.cjs
│   │   ├── shell-whitelist.cjs
│   │   └── env-filter.cjs
│   ├── services/
│   │   ├── lpSessionService.js
│   │   ├── lpGenerationService.js
│   │   ├── lpPreviewService.js
│   │   ├── lpDeployService.js
│   │   ├── lpTemplateService.js
│   │   ├── lpMiningService.js
│   │   ├── lpBugDetectorService.js
│   │   ├── lpRebuildEngine.js
│   │   ├── lpTokenService.js
│   │   ├── lpStackService.js
│   │   ├── lpBuildVerificationService.js
│   │   └── lpBridgeAdapter.cjs
│   ├── agents/
│   │   ├── lp-orchestrator.cjs
│   │   ├── lp-skills/SKILLS.md
│   │   └── lp-prompts/
│   │       ├── 00-system.md
│   │       ├── 01-intention.md
│   │       ├── 02-structure.md
│   │       ├── 03-coder.md
│   │       ├── 04-qa.md
│   │       ├── 05-extractor.md
│   │       ├── 06-sanitizer.md
│   │       ├── 07-universalizer.md
│   │       ├── 08-categorizer.md
│   │       ├── 09-stack-selector.md
│   │       ├── 10-build-verifier.md
│   │       ├── reviewer-code.md
│   │       ├── reviewer-seo.md
│   │       ├── reviewer-cro.md
│   │       ├── reviewer-security.md
│   │       ├── reviewer-build.md
│   │       └── reviewer-performance.md
│   ├── models/
│   │   ├── sqlite.js
│   │   ├── migrations/*.sql
│   │   └── repositories/*.js
│   └── workers/
│       ├── mining-worker.js
│       └── screenshot-worker.js
│
├── nexo-lp-web/                 # Frontend Svelte 4 + Vite
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js
│   ├── svelte.config.js
│   ├── tailwind.config.js
│   ├── src/
│   │   ├── main.js
│   │   ├── App.svelte
│   │   ├── app.css
│   │   ├── stores.js
│   │   ├── api.js
│   │   ├── components/
│   │   │   ├── LandingPageCreator.svelte
│   │   │   ├── LPChatArea.svelte
│   │   │   ├── LPPreview.svelte
│   │   │   ├── LPCodeEditor.svelte
│   │   │   ├── LPDeployPanel.svelte
│   │   │   ├── LPVersionHistory.svelte
│   │   │   ├── LPStatusBar.svelte
│   │   │   ├── LPWelcomeScreen.svelte
│   │   │   ├── LPTemplateStore.svelte
│   │   │   ├── LPTemplateCard.svelte
│   │   │   ├── LPTemplateModal.svelte
│   │   │   └── LPBugDetectorPanel.svelte
│   │   └── lib/
│   │       ├── lpClient.js
│   │       ├── previewBuilder.js
│   │       ├── lighthouseEstimator.js
│   │       └── githubAuth.js
│   └── public/
│
├── nexo-lp-core/                # Shared logic
│   ├── validators/
│   │   ├── htmlValidator.js
│   │   ├── seoValidator.js
│   │   ├── croValidator.js
│   │   ├── securityValidator.js
│   │   ├── buildValidator.js
│   │   └── performanceValidator.js
│   ├── parsers/
│   │   ├── htmlExtractor.js
│   │   ├── placeholderParser.js
│   │   └── metadataParser.js
│   ├── generators/
│   │   ├── indexHtmlGenerator.js
│   │   └── zipGenerator.js
│   ├── stacks/
│   │   ├── static-html-tailwind/
│   │   ├── vite-react-tailwind/
│   │   ├── vite-vue-tailwind/
│   │   ├── vite-svelte-tailwind/
│   │   ├── nextjs-app-router/
│   │   ├── nextjs-pages-router/
│   │   └── registry.json
│   ├── quality-gates/
│   │   ├── quality-gates.json
│   │   ├── pre-build-checklist.md
│   │   ├── post-build-checklist.md
│   │   └── review-checklist.md
│   ├── templates/seed/*.html
│   └── constants.js
│
└── data/                        # Runtime data (gitignored)
    ├── nexo-lp.db
    ├── sandboxes/{userId}/{projectId}/
    ├── previews/
    ├── exports/
    └── mining-jobs/
```

---

## 4. FUNCTIONAL REQUIREMENTS

### 4.1 Chat Creator
- User describes the landing page in natural language.
- Agent extracts intention (Architect), defines structure (Designer), generates code (Coder).
- Support multiple stacks: `static-html-tailwind`, `vite-react-tailwind`, `vite-vue-tailwind`, `vite-svelte-tailwind`, `nextjs-app-router`, `nextjs-pages-router`.
- Default stack: `static-html-tailwind`. User can choose or let the agent suggest.
- Kimi reads `lp-skills/SKILLS.md` and the stack's `build-checklist.md` before generating.
- Live preview in sandboxed iframe.
- Messaging with tool cards (`action_start`/`action_end`) and natural progress text.
- At the end of each completed phase, emit `!response+tool` to continue the loop.

### 4.2 Preview
- Render generated landing page in real time.
- View modes: desktop, tablet, mobile.
- Toolbar with reload, download, deploy, edit code.

### 4.3 Deploy
- Automatic deploy to GitHub Pages.
- Fallback: ZIP download and copy code.
- Version history with rollback.

### 4.4 Tokens
- Credit system:
  - Create LP: 10 tokens
  - Edit LP: 5 tokens
  - Deploy: 5 tokens
  - Template Mining: 2 tokens
- Initial token seed for new users.

### 4.5 Bug-Detector Pro + Rebuild Engine
- Detect HTML, SEO, CRO, security, build, and performance bugs.
- Automatic correction loop up to 3 attempts.
- Issues panel in frontend.

### 4.6 Template Mining Pipeline
- After deploy, allow user to donate landing page to the Template Store.
- Pipeline: Extractor → Sanitizer → Universalizer → Reviewers (code, seo, cro, security, build, performance) → Judge → Categorizer.
- Auto-approve if passing quality gates.

### 4.7 Public Template Store
- Public template store organized by category.
- Search, filters, interactive preview, rating.
- Sessions separated by category (SaaS, Clinics, Courses, Apps, etc.).
- Impeccable, clean aesthetics with fluid animations.

---

## 5. NON-FUNCTIONAL REQUIREMENTS

### 5.1 Aesthetics & UX (VERY IMPORTANT)

The interface must be **impeccable**. Imitate the best products (Lovable, Vercel, Notion, Linear):

- **Light colors:** white or off-white background (`#FAFBFC`, `#FFFFFF`), soft slate text (`#0F172A`, `#334155`), Luna purple/blue accents (`#6366F1`, `#8B5CF6`).
- **Typography:** Inter (Google Fonts), weights 400/500/600/700.
- **Rounded corners:** `rounded-xl`, `rounded-2xl`.
- **Soft shadows:** `shadow-sm`, `shadow-md`, with smooth transitions.
- **Animations:** 150-300ms transitions, fade-ins, slide-ups, micro-interactions on buttons.
- **Clean layout:** lots of whitespace, consistent grid, clear visual hierarchy.
- **Luna personality:** friendly tone, phrases like "Magic ready ✨", "Leave it to me 🌙", "I'm already creating...", subtle emojis.
- **Fun:** small visual surprises, creative empty states, elegant loaders.

### 5.2 Performance
- Preview < 2s for static stacks.
- Build < 1 min for build-step stacks.
- Store loads < 1s.

### 5.3 Security
- Per-user/project sandbox isolation.
- Path traversal blocked.
- RCE mitigated via firejail/systemd-run + whitelist.
- Secrets filtered from subprocess env.
- Preview in sandboxed iframe with strict CSP.

---

## 6. SECURITY & ISOLATION

### 6.1 Chrome / Bridge Isolation

Each user must have their **own Chrome context**:

- Create separate Chrome profiles for each NEXO LP `userId`.
- Profiles stored at `/home/jhin/luna/nexo-lp-creator/data/chrome-profiles/{userId}/`.
- Never mix cookies, localStorage, or sessions between users.
- Use CDP on a dedicated port or reuse `kimi-bridge.cjs` with an isolated `userId`.
- If possible, run Chrome in a container (firejail `--private=...`) for the user's profile.

### 6.2 Code Execution Sandbox

- All shell/scripts run inside `firejail` or `systemd-run`.
- `cwd` restricted to `/home/jhin/luna/nexo-lp-creator/data/sandboxes/{userId}/{projectId}/`.
- Whitelist of allowed binaries.
- Env filter removes `JWT_SECRET`, `INTERNAL_API_TOKEN`, `DATABASE_URL`, `GITHUB_TOKEN`.
- Resource limits: CPU, memory, execution time.

### 6.3 Data Isolation
- Product-specific SQLite database.
- Per-user sandbox directories.
- JWT validation on all routes.

---

## 7. SWARM AGENTS

Coordinate the following specialized agents:

| Agent | Responsibility |
|--------|------------------|
| **Architect** | Clones and maps repositories, defines architecture, creates directory structure. |
| **Backend-Engineer** | Implements Express backend, routes, services, SQLite models. |
| **Frontend-Engineer** | Implements Svelte 4 frontend, components, styles, animations. |
| **Bridge-Adapter** | Adapts `kimi-bridge.cjs` and `luna-soul.cjs` for NEXO LP. |
| **Security-Engineer** | Implements sandbox, path validator, env filter, whitelist. |
| **Prompt-Engineer** | Creates all agent prompts (`lp-prompts/`) and `SKILLS.md`. |
| **Stack-Engineer** | Creates stack templates and build checklists. |
| **QA-Engineer** | Creates validators, reviewers, quality gates, verification scripts. |
| **DevOps-Engineer** | Configures PM2, scripts, `.env.example`, Luna Server integration. |
| **UI-Designer** | Defines design system, tokens, animations, visual components. |
| **Template-Engineer** | Implements Template Mining and Template Store. |
| **Final-Reviewer** | Reviews everything, runs tests, lists bugs and next steps. |

### Coordination Rules
- Use **sequential pipelines** when dependencies exist.
- Use **parallel execution** for independent tasks.
- Each agent must **document what it did** in `/tmp/swarm/logs/{agent}.md`.
- The lead agent consolidates logs and generates a final report.

---

## 8. SWARM WORKFLOW

### Phase 1 — Discovery (parallel)
1. **Architect** clones and maps repositories.
2. **UI-Designer** researches visual references (Lovable, Vercel, Linear).
3. **Prompt-Engineer** reads user's `NEXO-LP-CREATOR-PLANO.md`.

### Phase 2 — Foundation
1. **Architect** creates directory structure.
2. **DevOps-Engineer** creates `package.json`, `pm2-ecosystem.config.js`, `.env.example`, scripts.
3. **Backend-Engineer** creates Express server with health check.
4. **Frontend-Engineer** creates base Svelte project.
5. **Security-Engineer** creates base sandbox executor.

### Phase 3 — Core
1. **Backend-Engineer** implements sessions, projects, tokens, deploy services.
2. **Frontend-Engineer** implements chat, preview, deploy panel, version history.
3. **Bridge-Adapter** integrates `kimi-bridge.cjs` via `lpBridgeAdapter.cjs`.
4. **Prompt-Engineer** finalizes system and subagent prompts.
5. **Stack-Engineer** creates stack templates.
6. **QA-Engineer** creates validators and quality gates.

### Phase 4 — Polish
1. **UI-Designer** applies design system, animations, micro-interactions.
2. **Template-Engineer** implements Template Mining and Store.
3. **QA-Engineer** runs build checks and reviewers.
4. **Security-Engineer** audits isolation and sandbox.

### Phase 5 — Final Review
1. **Final-Reviewer** runs all tests.
2. Generates bug report and TODOs.
3. Prepares summary for user.

---

## 9. HOW TO USE LUNA

Luna (Kimi Web via bridge) is the internal AI engine of the product. Use it for:

1. **Code Generation**
   - Send specialized prompts (Architect, Designer, Coder).
   - Receive HTML/components and save to project sandbox.

2. **Sanitization**
   - Before publishing a template to the store, run HTML through the Sanitizer prompt.
   - Remove PII, logos, real prices, sensitive data.

3. **Bug Fixing**
   - When Bug-Detector finds issues, send to Rebuild Engine via Luna.
   - Luna receives HTML + bug list and returns corrected HTML.

4. **Recreation / Improvement**
   - If user asks "make it more modern" or "change colors", reuse original intention + new request and generate a new version.

5. **Template Mining**
   - Extract structure, design tokens, components.
   - Universalize with placeholders.
   - Categorize and generate metadata.

### Integration
- Use `lpBridgeAdapter.cjs` to send messages to Kimi Web.
- Each NEXO LP session uses an isolated `userId` (`nlp-{timestamp}-{hash}`).
- Do not interfere with normal Luna sessions.

---

## 10. BEST PRACTICES TO IMITATE

### Lovable
- Prompt-to-deploy: user describes, AI generates, live preview, one-click deploy.
- Minimal visual editor, focus on chat.
- Automatic GitHub sync.
- Embedded design system in prompts.

### Claude Code
- Specialized coordinated agents in swarm.
- Extremely specific numbered-step prompts.
- Use of skills and context files.
- Continuous testing and verification before finishing.

### Kimi Code 2.7
- Native Agent Swarm: decompose complex tasks into parallel subagents.
- Interleaved multi-step tool calls with thinking.
- Reuse long context (256K).
- Focus on functional, well-structured code.

---

## 11. DELIVERABLES

At the end, the swarm must deliver:

1. Complete code in `/home/jhin/luna/nexo-lp-creator/`.
2. `README.md` with setup and usage instructions in English.
3. Filled `.env.example`.
4. Working scripts: `setup.sh`, `dev.sh`, `build.sh`, `test.sh`, `run-all-tests.sh`.
5. SQLite database with migrations applied.
6. At least 4 seed templates in the store.
7. Automated tests:
   - `nexo-lp-server/tests/e2e/full-flow.test.js`
   - `nexo-lp-server/tests/security/sandbox.test.js`
   - `nexo-lp-server/tests/integration/api.test.js`
   - `nexo-lp-web/tests/components.test.js` (if applicable)
8. Final report at `/home/jhin/luna/nexo-lp-creator/SWARM-REPORT.md` containing:
   - What was implemented
   - What was reused from repositories
   - Test results (pass/fail per section)
   - Known bugs
   - Recommended next steps
   - Commands to test

---

## 12. ACCEPTANCE CRITERIA

- [ ] Backend responds at `/api/nexo-lp/health`.
- [ ] Frontend loads without errors.
- [ ] Chat creates a `static-html-tailwind` landing page and shows preview.
- [ ] GitHub Pages deploy works (or ZIP fallback).
- [ ] Tokens are debited correctly.
- [ ] Bug-Detector + Rebuild Engine fix at least one simulated bug.
- [ ] Template Store lists templates by category.
- [ ] Sandbox prevents read/write outside project workspace.
- [ ] Each user has isolated Chrome context.
- [ ] Interface is visually impeccable (clean, clear, animated, fun).
- [ ] All user-facing content is in English.
- [ ] `scripts/run-all-tests.sh` passes all smoke, API, bridge, UI, security, stack, and mining tests.
- [ ] `SWARM-REPORT.md` contains detailed test results and no critical failures.

---

## 13. CONSTRAINTS

- **Do not modify** `/home/jhin/.luna-kernel/` or `NEXO_DASHBOARD_PRO/`.
- **Do not execute** destructive commands outside the project workspace.
- **Do not expose** secrets in logs or committed files.
- **Do not leave** the user's Chrome logged into personal mixed accounts.
- **All output must be in English** unless explicitly translating for the user's conversational response.

---

## 14. MANDATORY END-TO-END TESTING

**The swarm MUST validate the entire product before delivery.** Writing code is not enough. Each agent must run tests and prove functionality. The Final-Reviewer agent must confirm every item below passes before declaring the project ready.

### 14.1 Smoke Tests (run first)

- [ ] `npm run setup` completes without errors.
- [ ] `npm run dev:server` starts and `/api/nexo-lp/health` returns `{"ok": true}`.
- [ ] `npm run dev:web` starts and the main page loads without console errors.
- [ ] `npm run build` completes successfully for both `nexo-lp-server` and `nexo-lp-web`.
- [ ] PM2 config loads: `pm2 start pm2-ecosystem.config.js --dry-run` (or actual start in safe mode).

### 14.2 Backend API Tests

Run via `curl` or automated test script. All must pass:

- [ ] `POST /api/nexo-lp/sessions` creates a session and returns `sessionId`.
- [ ] `GET /api/nexo-lp/sessions/:id` returns the session.
- [ ] `POST /api/nexo-lp/generate` with prompt "Create a SaaS landing page" triggers generation.
- [ ] `GET /api/nexo-lp/preview/:sessionId` returns the generated HTML.
- [ ] `POST /api/nexo-lp/bug-detect` returns a review report with scores.
- [ ] `POST /api/nexo-lp/rebuild` fixes a simulated bug.
- [ ] `GET /api/nexo-lp/tokens/balance` returns the user's token balance.
- [ ] `POST /api/nexo-lp/deploy/github` returns a URL or fallback ZIP path.
- [ ] `GET /api/nexo-lp/templates` returns public templates by category.
- [ ] `POST /api/nexo-lp/templates/:id/use` creates a new session from a template.

### 14.3 Luna / Bridge Tests

These validate the core AI loop:

- [ ] `lpBridgeAdapter.cjs` connects to Kimi Web without crashing.
- [ ] A test message is sent to Kimi and a response is received.
- [ ] Kimi emits an `action_start` event for `writeFile`.
- [ ] Kimi writes a valid `index.html` to a test sandbox.
- [ ] Kimi emits `!response+tool` at the end of a phase.
- [ ] The bridge does not interfere with other Luna sessions.

### 14.4 Frontend / UI Tests

- [ ] Chat interface renders without layout breaks.
- [ ] Tool cards appear during generation.
- [ ] Preview iframe renders the generated landing page.
- [ ] Desktop/tablet/mobile toggles resize the preview.
- [ ] Deploy panel shows GitHub/ZIP/copy options.
- [ ] Template Store loads categories and templates.
- [ ] Template preview modal opens and displays the template.
- [ ] All UI text is in English.

### 14.5 Security / Sandbox Tests

- [ ] `executeShell` with `cat /etc/passwd` is blocked.
- [ ] `writeFile` with path `../../../tmp/hack.txt` is rejected.
- [ ] Environment secrets are not exposed to subprocesses.
- [ ] User A cannot read User B's sandbox files.
- [ ] Preview iframe CSP blocks external scripts.
- [ ] Chrome profile for User A does not share cookies with User B.

### 14.6 Stack / Build Tests

For each supported stack with a build step:

- [ ] `static-html-tailwind` preview works without build.
- [ ] `vite-react-tailwind` builds successfully (`npm run build` exits 0).
- [ ] `vite-vue-tailwind` builds successfully.
- [ ] `vite-svelte-tailwind` builds successfully.
- [ ] `nextjs-app-router` builds successfully.
- [ ] `nextjs-pages-router` builds successfully.
- [ ] Quality gates pass for at least one generated project.

### 14.7 Template Mining Tests

- [ ] Submit a landing page to mining.
- [ ] Pipeline runs Extractor → Sanitizer → Universalizer → Reviewers → Judge.
- [ ] Approved template appears in Template Store.
- [ ] Rejected template returns clear blockers.

### 14.8 Test Documentation

The swarm must generate:
- `nexo-lp-server/tests/e2e/full-flow.test.js` — automated end-to-end test.
- `scripts/run-all-tests.sh` — runs unit, integration, e2e, and security checks.
- `SWARM-REPORT.md` section **"Test Results"** with pass/fail for each item above.
- If any test fails, list it as a known bug with severity and next step.

---

## 15. COMMUNICATION

If clarification is needed, ask the user. At the end of each phase, summarize:
- What was done
- What remains
- Blockers (if any)
- Next action
- Test results so far

Use a professional, direct tone with Luna's personality: friendly, confident, and a little playful.

---

## 16. FINAL MANDATORY REMINDER

🌙 **BEFORE SAVING ANY FILE, TRANSLATE EVERYTHING TO ENGLISH.**  
✨ **All generated landing pages, templates, prompts, skills, UI labels, error messages, metadata, comments, and documentation must be written in English.**  
🚀 **Let's build something incredible.**
