# Bugs

## Open

- GitHub OAuth flow in the frontend returns 501 (`nexo-lp-web/src/api.js:283`) — deploy works only via env `GITHUB_TOKEN`.
- `kimi-cookies.json` is versioned in the repo — live session cookies exposed; rotate and gitignore.
- `LPTemplateStore.svelte` silently falls back to 10 hardcoded demo templates when the API fails/empty — can mask backend outages.
- README/AGENTS document an "agent swarm" and `/tokens/*` as current; the swarm orchestrator is not imported anywhere and tokens are legacy (currencies replaced them).

## Resolved

- [2026-06-20, per e2e report] Kimi bridge returned empty responses — selectors/flow fixed afterwards; bridge remains inherently fragile (documented).
