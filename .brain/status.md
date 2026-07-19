# Status — NEXO Landing Page Creator

## Current focus
Platform that generates complete landing pages from a conversation with AI, then turns them into reusable templates: AI sanitization (PII removal) → generic template → NEXO Store. Internal virtual economy (3 currencies), marketplace, SSE live preview. Deployed on VPS; active development.

## What's working
- 4-phase generation pipeline (intention → structure → code → review) with SSE, retries, auto-continue and version rollback
- Template pipeline: publish → AI sanitization of personal data → QA → metadata → auto-sync to NEXO Store admin API (validated in production, 36+ templates migrated)
- Deterministic fallback when AI sanitization fails (template goes "unreviewed" at half price — graceful degradation)
- Virtual economy: stars/suns/moons with exchange rates, per-operation charges, template purchases, sale forwarding to NEXO Dashboard finance (idempotent)
- GitHub Pages deploy (requires env token) with ZIP fallback
- ~307 tests (Jest/Supertest) + Playwright e2e; server validated on localhost:5400

## What's broken / pending
- GitHub OAuth in frontend returns 501 (env-based deploy works)
- Kimi bridge is fragile by nature: needs a logged-in Chrome, cookies, DOM selectors (has broken before)
- `kimi-cookies.json` committed to the repo — security risk, should be rotated/gitignored
- Loja frontend falls back to 10 hardcoded demo templates if the API is empty/unreachable
- "Dark mode" button is a "coming soon" stub
- README still describes "agent swarm" and legacy `/tokens/*` — real orchestration is the linear `lpGenerationService`, generation charges currencies
