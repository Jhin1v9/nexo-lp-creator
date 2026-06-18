# Prompt Pack v3 — "Milionário" Design Spec

**Date:** 2026-06-17  
**Scope:** Rewrite all NEXO orchestrator/QA/sanitizer prompts and expose every generation cycle as a frontend card.

---

## Goals

1. Increase landing-page conversion quality by injecting 2026 CRO/copy best practices into every phase.
2. Reduce hallucinations/format drift with strict English prompts, personas, few-shot JSON examples and anti-pattern rules.
3. Make every prompt cycle visible to the end user as a step card during generation (sanitize cycles stay internal).
4. Provide a repeatable way to "remind" Kimi of the prompt pack in a running chat.

## Non-Goals

- Do not change the public API contract or DB schemas.
- Do not expose internal sanitize/refine steps as user-facing cards.
- Do not add new external dependencies.

---

## 1. Prompt Architecture

### 1.1 Supreme system persona

Injected (explicitly or implicitly) at the top of every generation prompt:

```text
You are NEXO — a world-class conversion engineer, senior full-stack frontend developer,
and CRO specialist. You build landing pages that convert. Every decision you make is
justified by conversion psychology, mobile-first UX, and clean, semantic code.
Rules that never change:
- Read the full input before producing output.
- Follow the exact output schema declared below.
- Never invent data the user did not provide.
- Never return explanations outside the requested format.
- Never use sandbox://, file://, attachments or downloadable files.
```

### 1.2 Conversion Reference Directive (all site-creation prompts)

Every generation prompt (intention, structure, code, review, fix, preview) must end with a directive like:

```text
REFERENCE STANDARD:
Ground every choice in multi-million-dollar, high-converting landing page patterns.
Research and apply: proven motion/animation cues, novel interaction hooks, 2026 CRO
innovations, and the psychological drivers behind top-performing pages. Do not use
generic placeholder examples or random "winners". Justify each element with a real
best-practice pattern (e.g., outcome-first hero, single conversion goal, social proof
near the CTA, scroll-driven reveal, micro-interactions that reward the click).
```

Sanitization prompts do not need this directive because their job is data cleaning,
not creative conversion design.

### 1.3 Generation prompts (`lpGenerationService.js`)

| Phase | Output | Key additions in v3 |
|---|---|---|
| `intention` | JSON | `heroAngle`, `valueProposition`, `objections`, `proof`, `ctas`, `constraints` |
| `structure` | JSON | `designTokens`, per-section `purpose`/`croGoal`, `responsiveStrategy`, `seoKeywords`, `imageStrategy` |
| `code` | fenced HTML | mobile-first, single CTA, OG/meta, semantic HTML5, Tailwind CDN only, no generic placeholder copy |
| `review` | JSON | 6-dimension scoring (`a11y`, `codeQuality`, `seo`, `performance`, `cro`, `security`), `rebuildNeeded`, `rebuildInstructions` |
| `fix` | fenced HTML | receives review JSON + current HTML, applies all instructions, returns complete HTML |
| `review-retry` | JSON | triggered when review JSON cannot be parsed |

### 1.3 Sanitization prompts (`lpSanitizationOrchestrator.js`)

| Step | Output | Notes |
|---|---|---|
| `sanitize` | fenced HTML | remove PII, replace with NEXO Digital placeholders, no new sections |
| `sanitize-review` | JSON `{ ok, corrections[], metadata{} }` | strict code block, rich metadata schema |
| `sanitize-refine` | fenced HTML | apply corrections from review |

Sanitize events are internal only — no frontend cards.

---

## 2. Frontend Cards

### 2.1 Backend events

`lpGenerationService.js` must emit `action_start` / `action_continue` / `action_end` for:

- `intention`
- `structure`
- `code`
- `review`
- `review-retry-1`, `review-retry-2` …
- `fix`
- `re-review-1`, `re-review-2` …
- `preview`

Backend must NOT emit user-facing cards for sanitize steps.

### 2.2 Frontend updates

- `GenerationPhaseStack.svelte`: increase max visible cards from 4 to 6, keep cards in arrival order.
- `GenerationPhaseCard.svelte`: add labels for new phases:
  - `review-retry-*` → "Refinando revisão"
  - `fix` → "Corrigindo código"
  - `re-review-*` → "Reverificando"
- Keep rotating status message in sync with the latest card.

---

## 3. Reminding Kimi

Create `scripts/send-prompts-to-kimi.js`:

- Reads the final prompt pack from a canonical markdown file (`docs/PROMPT-PACK-v3.md`).
- Sends it as a single system/memory message via `BridgeAdapter` to the active Kimi user.
- Exits cleanly with `process.exit(0)` after `BridgeAdapter.disconnect()`.

---

## 4. Testing / Verification

1. Run full Jest suite: `NODE_OPTIONS=--experimental-vm-modules npx jest --runInBand`.
2. Run `scripts/test-sanitization.js` end-to-end and confirm metadata is extracted.
3. Trigger a generation in the UI and verify cards appear for intention → structure → code → review → fix (if needed) → preview.
4. Run `scripts/send-prompts-to-kimi.js` and confirm the message appears in the active Kimi chat.

---

## 5. Open Decisions

None — design approved by user on 2026-06-17 with the note that sanitize cards remain internal.
