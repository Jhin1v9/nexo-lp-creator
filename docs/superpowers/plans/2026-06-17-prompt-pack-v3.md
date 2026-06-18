# Prompt Pack v3 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rewrite all generation/QA/sanitizer prompts with 2026 CRO best practices, surface every generation cycle as a frontend card, and create a script to remind Kimi of the final prompt pack.

**Architecture:** Move all prompt strings into a dedicated `nexo-lp-server/services/prompts/nexoPromptPack.js` module; import it from `lpGenerationService.js` and `lpSanitizationOrchestrator.js`. Emit additional `action_start`/`action_continue` events for review retries, fixes and re-reviews so the frontend can show them as cards. Update the Svelte overlay to render up to 6 cards and label the new phases.

**Tech Stack:** Node.js, Svelte, Playwright/CDP bridge, Jest.

---

## Task 1: Create prompt pack module

**Files:**
- Create: `nexo-lp-server/services/prompts/nexoPromptPack.js`

**What it does:**
Exports one function per prompt needed by the orchestrator. Every site-creation prompt must include the Conversion Reference Directive (research multi-million-dollar landing page patterns, motion, novelty, CRO innovations; no generic placeholders; justify each choice).

**Functions to export:**
- `intentionPrompt(userPrompt)` → returns string
- `structurePrompt(intention)` → returns string
- `codePrompt(structure, stack)` → returns string
- `reviewPrompt(html)` → returns string
- `fixPrompt(html, review)` → returns string
- `reviewRetryPrompt(html, reason, rawResponse)` → returns string
- `sanitizePrompt(originalHtml)` → returns string
- `sanitizeRetryPrompt(originalHtml)` → returns string
- `sanitizeReviewPrompt(html)` → returns string
- `sanitizeRefinePrompt(corrections, html)` → returns string

**Requirements:**
- All prompts in English.
- Include strict output schemas with JSON examples.
- Include the anti-attachment/anti-download rule.
- Sanitizer prompts do **not** include the Conversion Reference Directive.

- [ ] **Step 1:** Create the file with all functions and full prompt text.
- [ ] **Step 2:** Lint the file with `node --check`.

---

## Task 2: Wire prompt pack into generation service

**Files:**
- Modify: `nexo-lp-server/services/lpGenerationService.js`

**Changes:**
1. At the top, import the module:
   ```js
   const {
     intentionPrompt,
     structurePrompt,
     codePrompt,
     reviewPrompt,
     fixPrompt,
     reviewRetryPrompt,
   } = require('./prompts/nexoPromptPack');
   ```
2. Replace the body of `PHASE_PROMPTS.intention`, `structure`, `code`, `review`, `fix` with calls to the functions above.
3. Replace `REVIEW_RETRY_PROMPT` with `reviewRetryPrompt`.
4. In the review retry loop, emit an `action_start` for phase `review-retry-${attempt}` before sending the retry prompt and `action_end` after parsing succeeds or fails.
5. In the rebuild block, emit `action_start` for phase `fix` before the fix prompt and `action_end` after.
6. In the re-review block, emit `action_start` for phase `re-review-${attempt}` before the re-review prompt and `action_end` after.

- [ ] **Step 1:** Replace imports and prompt calls.
- [ ] **Step 2:** Add event emissions for new phases.
- [ ] **Step 3:** Run generation service tests: `NODE_OPTIONS=--experimental-vm-modules npx jest nexo-lp-server/tests/services/lpGenerationService.review.test.js --runInBand`

---

## Task 3: Wire prompt pack into sanitizer

**Files:**
- Modify: `nexo-lp-server/services/lpSanitizationOrchestrator.js`

**Changes:**
1. Import the four sanitize functions from `nexoPromptPack`.
2. Replace the inline `HYBRID_SANITIZE_PROMPT`, `REVIEW_PROMPT`, `REFINE_PROMPT` and the inline retry prompt with calls to those functions.
3. Keep sanitization events internal — do **not** add new user-facing `action_start` cards.

- [ ] **Step 1:** Replace prompt strings with module calls.
- [ ] **Step 2:** Run sanitizer tests: `NODE_OPTIONS=--experimental-vm-modules npx jest nexo-lp-server/tests/services/lpSanitizationOrchestrator.test.js --runInBand`

---

## Task 4: Update frontend generation cards

**Files:**
- Modify: `nexo-lp-web/src/components/GenerationPhaseStack.svelte`
- Modify: `nexo-lp-web/src/components/GenerationPhaseCard.svelte`

**Changes:**
1. In `GenerationPhaseStack.svelte`, increase the rendered card slice from 4 to 6 so retries/fixes are visible.
2. In `GenerationPhaseCard.svelte`, extend `phaseConfig` with:
   ```js
   'review-retry': { title: 'Refinando revisão', icon: '🔍' },
   fix: { title: 'Corrigindo código', icon: '🛠️' },
   're-review': { title: 'Reverificando', icon: '🔎' },
   ```
   Also handle dynamic suffixes like `review-retry-1` by matching the prefix.

- [ ] **Step 1:** Update `GenerationPhaseStack.svelte`.
- [ ] **Step 2:** Update `GenerationPhaseCard.svelte`.
- [ ] **Step 3:** Build the frontend: `cd nexo-lp-web && npm run build` (or `npm run check` if available).

---

## Task 5: Create "send prompts to Kimi" script

**Files:**
- Create: `scripts/send-prompts-to-kimi.js`
- Create: `docs/PROMPT-PACK-v3.md` (canonical human-readable version of all prompts)

**What it does:**
Reads `docs/PROMPT-PACK-v3.md`, sends it as a single message via `BridgeAdapter.sendMessage()` to the active Kimi user, then disconnects and exits cleanly.

Skeleton:
```js
const fs = require('fs');
const path = require('path');
require('dotenv').config();
const BridgeAdapter = require('../nexo-lp-server/services/lpBridgeAdapter.cjs');

async function main() {
  const pack = fs.readFileSync(path.join(__dirname, '../docs/PROMPT-PACK-v3.md'), 'utf8');
  const context = BridgeAdapter.initializeContext('prompt-pack-reminder');
  await BridgeAdapter.sendMessage(context,
    `MEMÓRIA DE SISTEMA — NEXO Prompt Pack v3\n\n${pack}\n\nUse estes prompts e schemas em todas as fases de geração e sanitização.`,
    { mode: 'instant', phase: 'system-memory' }
  );
  await BridgeAdapter.disconnect();
  process.exit(0);
}
main().catch((err) => { console.error(err); process.exit(1); });
```

- [ ] **Step 1:** Create `docs/PROMPT-PACK-v3.md` from the prompt module content.
- [ ] **Step 2:** Create `scripts/send-prompts-to-kimi.js`.
- [ ] **Step 3:** Run it once Kimi is logged in.

---

## Task 6: Full verification

- [ ] **Step 1:** Run full backend test suite: `NODE_OPTIONS=--experimental-vm-modules npx jest --runInBand --silent` (expected: 13 suites, 95 tests, all pass).
- [ ] **Step 2:** Run `node scripts/test-sanitization.js` end-to-end and confirm metadata extraction still works.
- [ ] **Step 3:** Trigger a UI generation and confirm cards appear for intention → structure → code → review → (fix/re-review if triggered) → preview.

---

## Spec Coverage Check

| Spec requirement | Task |
|---|---|
| Supreme persona in every prompt | Task 1 |
| Conversion Reference Directive in site-creation prompts | Task 1 |
| Richer intention/structure/review schemas | Task 1 |
| Review 6-dimension scoring | Task 1 |
| Cards for retries/fixes/re-reviews | Tasks 2 & 4 |
| Sanitize cards remain internal | Task 3 (no new events) |
| Script to remind Kimi | Task 5 |
