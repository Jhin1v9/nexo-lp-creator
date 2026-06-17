# Import Existing Kimi Chats + Sidebar Fix + E2E Restaurant Test

## Goal
1. Publish all valid HTML landing pages from existing Kimi chats as templates in the LOJA.
2. Fix the frontend sidebar so projects are named from the user's prompt, all projects are visible, and the 3-dot dropdown opens downward.
3. Run an end-to-end test by generating a new site (restaurant theme) and verifying it auto-publishes to the LOJA with sanitization running.

## Part 1 — Bulk Import Existing Chats

### Approach
Create a one-shot Node script `scripts/import-kimi-chats-to-loja.js` that:
- Connects to the same Chrome/CDP instance used by the bridge.
- Reads the chat sidebar list from `kimi.com`.
- Skips the last 2 chats from the bottom (marked incomplete by user).
- Opens each remaining chat, extracts the last HTML code block, and validates it.
- Validates HTML by checking `<!DOCTYPE html>`, `<html`, `</html>`, and presence of `<body`/`<main`/`<section`.
- For each valid HTML, creates a session + template via internal services and triggers `lpTemplateService.publishFromSession` so the sanitization pipeline runs.
- Logs every imported template with its ID, name, and status.

### Naming
Template name = first 4-5 words of the chat's original user prompt.
Fallback = "Imported Project" if prompt unavailable.

### Outcome
All valid existing landing pages become public templates after sanitization completes.

## Part 2 — Sidebar Fixes

### Files
- `nexo-lp-web/src/components/LPSidebar.svelte` (or equivalent sidebar component)
- `nexo-lp-web/src/stores/sessionStore.js` or API layer that fetches sessions

### Changes
1. **Project naming:** Use `session.initial_prompt` (first 5 words) as display name instead of `session.name` or "Untitled Project".
2. **Scrollable list:** Add `max-height` and `overflow-y-auto` to the recent projects list.
3. **Dropdown direction:** Force the 3-dot menu dropdown to open downward with `top-full` and high `z-index`, preventing it from being clipped by the sidebar container.

## Part 3 — E2E Restaurant Test

### Steps
1. Start the full stack (backend + frontend + Chrome bridge).
2. Use the frontend or a direct API call to generate a restaurant landing page from a short prompt, e.g.:
   > "Crie um site lindo para um restaurante italiano chamado Sapore Di Nonna"
3. Wait for generation to complete.
4. Verify:
   - Template row is created with `status='sanitizing'`.
   - Public preview shows placeholder "Sanitizing template...".
   - After sanitization finishes, `status='available'`, `is_public=1`, metadata filled.
   - Template appears in `GET /templates`.
   - Template card in LOJA loads the final preview.

### Success Criteria
- No manual intervention required after the prompt is sent.
- Template is publicly visible in the shop within a reasonable time.

## Scope Exclusions
- No permanent recurring import; this is a one-time script plus the ongoing auto-publish flow already in place.
- No new backend routes needed; reuse `lpTemplateService.publishFromSession`.
