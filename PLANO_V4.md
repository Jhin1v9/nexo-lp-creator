# PLANO DE AÇÃO — NEXO Prompt Pack v4 "Stunning Edition"
> Criado: 2026-06-18 | Objetivo: Máxima liberdade visual + funcional pro usuário, sanitize apenas com NEXO Digital

---

## FASE 0 — BACKUP E SEGURANÇA
1. Copiar `nexoPromptPack.js` para `nexoPromptPack.js.v3.backup`
2. Confirmar que o backup foi criado corretamente

---

## FASE 1 — BASE_PERSONA (Linha ~12)
**Problema:** Persona 100% CRO, zero foco em visual/design awards.
**Fix:** Adicionar parágrafo de visual design virtuoso:
- "You are also a visual design virtuoso — every page must look like it belongs in a design awards gallery (Awwwards, CSS Design Awards)."
- "Stunning typography, breathtaking imagery, cinematic motion, WebGL/Canvas effects, and pixel-perfect execution are NON-NEGOTIABLE."
- "The user experience must feel SURREAL, ALIVE, and PREMIUM."

---

## FASE 2 — INTENTION PROMPT (Linha ~24)
**Problema:** `constraints` contém `"no external images"` e força Tailwind CDN only.
**Fix:**
- Remover `"no external images"` completamente
- Substituir constraints por: `["must be single HTML file", "user chooses stack and style"]`
- Adicionar campo: `"userVibe": "free-form description of the visual style the user wants"`
- Adicionar: `"dependencies": ["any CDN libraries the user requests or you suggest for stunning effects"]`
- Instruir: "Use high-quality images from Unsplash, Pexels, or similar with direct URLs. NEVER use generic gray placeholders or SVG icons without purpose."

---

## FASE 3 — STRUCTURE PROMPT (Linha ~60)
**Problema:** `"motion": "scroll-driven reveals, subtle hover lifts, one signature micro-interaction"` = limitado.
**Fix:**
- Trocar motion para: `"STUNNING, cinematic, immersive animations: GSAP ScrollTrigger timelines, parallax layers, morphing SVGs, particle systems, 3D CSS transforms, WebGL shaders, canvas effects, kinetic typography, and rich micro-interactions on EVERY interactive element. The page must feel ALIVE, SURREAL, and award-winning."`
- Adicionar campo: `"techStack": { "css": "Tailwind CDN or pure CSS", "js": "vanilla or any CDN libs", "canvas": "optional for advanced effects" }`
- Remover qualquer restrição de "subtle" ou "one micro-interaction"

---

## FASE 4 — CODE PROMPT (Linha ~100)
**Problema:** `10. No external dependencies except Tailwind CDN and Google Fonts` = mata qualquer lib.
**Fix:**
- Regra 10 vira: `"DEPENDENCIES: The user may request ANY library (GSAP, Three.js, Lottie, Lenis, Swiper, PixiJS, p5.js, D3, etc.). If the user asks for it, include it via CDN. If you think a lib will make the page more stunning, suggest it. The ONLY hard rule: everything must be in a SINGLE, SELF-CONTAINED HTML file with inline scripts/styles."`
- Adicionar: `"You can build: landing pages, interactive apps, canvas games, WebGL experiences, CSS art, or any single-file web experience."`
- Adicionar: `"Use real, high-quality images from Unsplash/Pexels with direct image URLs. Never use placeholder boxes or meaningless icons."`
- Adicionar: `"Animations must be cinematic: scroll-driven, parallax, morphing, particles, 3D transforms. The page must feel ALIVE."`
- Manter: single HTML file, semantic HTML5, mobile-first, inline everything

---

## FASE 5 — REVIEW PROMPT (Linha ~140)
**Problema:** Threshold 90% + zero errors = nunca passa. Travado em loop.
**Fix:**
- Threshold: `"passed" is true if score >= 75 AND no critical issues AND page is complete`
- Adicionar: `"If the page is complete, functional, and visually impressive, prefer PASSING with suggestions over FAILING with rebuilds. Do not be a perfectionist — be pragmatic."`
- Adicionar dimensão: `"visualImpact": { "score": 95, "notes": "stunning animations and imagery" }`
- Manter JSON schema, mas flexibilizar parser

---

## FASE 6 — FIX PROMPT (Linha ~200)
**Problema:** `return \`${BAS` está truncado — deveria ser `BASE_PERSONA`.
**Fix:** Corrigir para `return \`${BASE_PERSONA}` e garantir que o resto do prompt esteja completo.

---

## FASE 7 — SANITIZE PROMPTS (Linha ~220+)
**Regra de Ouro:** SÓ aqui entra NEXO Digital. Todos os outros prompts (intention, structure, code, review, fix) NÃO mencionam NEXO Digital.
**Fix:**
- `sanitizePrompt`: Manter regras de sanitização de dados pessoais + placeholders NEXO Digital
- `sanitizeRetryPrompt`: Manter
- `sanitizeReviewPrompt`: Manter
- `sanitizeRefinePrompt`: Manter
- Garantir que NEXO Digital NÃO apareça em nenhum outro prompt

---

## FASE 8 — VALIDAÇÃO E TESTE
1. Verificar que `fixPrompt` não está truncado
2. Verificar que `codePrompt` permite GSAP/Three.js/Lottie/etc
3. Verificar que `intentionPrompt` não tem "no external images"
4. Verificar que `reviewPrompt` threshold é 75
5. Verificar que `structurePrompt` pede animações cinematic
6. Verificar que NEXO Digital só aparece nos sanitize prompts
7. Salvar arquivo final como `nexoPromptPack.js`
8. Fazer diff entre v3 e v4 pra confirmar mudanças

---

## FASE 9 — DOCUMENTAÇÃO
1. Atualizar header do arquivo: `v4 — "Stunning Edition"`
2. Adicionar comentário explicando a mudança de filosofia: "User freedom first, NEXO Digital only on sanitize"

---

## CHECKLIST FINAL
- [ ] Backup v3 criado
- [ ] BASE_PERSONA tem foco visual STUNNING
- [ ] intentionPrompt permite imagens externas e liberdade de estilo
- [ ] structurePrompt pede animações cinematic/immersive
- [ ] codePrompt permite QUALQUER dependência via CDN
- [ ] codePrompt menciona Canvas/WebGL/apps possíveis
- [ ] reviewPrompt threshold = 75, não travado
- [ ] fixPrompt não truncado
- [ ] NEXO Digital SÓ nos sanitize prompts
- [ ] Arquivo salvo e validado

