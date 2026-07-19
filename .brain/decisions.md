# Decisions

- [2026-05] Linear 4-phase generation pipeline (`lpGenerationService`) chosen over a multi-agent swarm: intention → structure → code → review, each phase isolated and retryable.
- [2026-05] Output is a single self-contained HTML file with Tailwind CDN — maximizes preview/deploy simplicity; the 6 stack templates (Next.js, Vite React/Svelte/Vue, static) serve the validator/registry.
- [2026-06] AI runs through the Luna browser bridge (Playwright/CDP on kimi.com) instead of paid LLM APIs — accepts fragility for zero per-request cost.
- [2026-06] Sanitization failures degrade gracefully: deterministic regex fallback + "unreviewed" status at half price instead of losing the template.
- [2026-06] Three-currency virtual economy (stars/suns/moons) with per-operation charging; sales forwarded to the NEXO Dashboard finance API with idempotency keys.
- [2026-07-19] Living-memory `.brain/` adopted (from the luna-kernel pattern) to keep project state continuously documented.
