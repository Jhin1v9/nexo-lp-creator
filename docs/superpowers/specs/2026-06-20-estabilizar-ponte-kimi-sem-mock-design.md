# Design: Estabilizar Ponte Kimi, Remover Mock e Processar LOJA

**Data:** 2026-06-20  
**Escopo:** NEXO Landing Page Creator — `nexo-lp-server` + `nexo-lp-web`

---

## 1. Objetivo

Tornar a geração real de landing pages estável e remover completamente o modo mock, garantindo que:
- A ponte Kimi espere o tempo necessário pela resposta real (sem timeouts/hard-cancels).
- Templates da LOJA sejam sanitizados, fotografados e enriquecidos com metadata automaticamente.

---

## 2. Princípios

1. **Sem timeout, sem hard-cancel.** O usuário prefere esperar do que receber uma resposta vazia.
2. **Detecção de término por estabilidade do DOM.** Quando o texto da resposta do Kimi parar de mudar por um tempo, consideramos pronto.
3. **Usar Chromium + extensão Luna.** Chromium é mais previsível com Playwright/CDP; a extensão Luna fornece observer DOM persistente.
4. **Mock nunca mais.** Removemos toda a lógica de geração mock.

---

## 3. Mudanças na Ponte Kimi

### 3.1 Browser: preferir Chromium

- Alterar `checkChrome()` em `nexo-lp-server/services/luna/kimi-bridge.cjs` para preferir `chromium`/`chromium-browser` antes de `google-chrome`.
- Manter `user-data-dir` persistente (`~/.luna/chrome-profile`) para preservar login.

### 3.2 Extensão Luna no path correto

- Copiar `luna-extension/` para `nexo-lp-server/services/luna/luna-extension/` (path que `kimi-bridge.cjs` verifica em `--load-extension`).
- Garantir que `manifest.json` esteja presente.

### 3.3 Remover timeouts e hard-cancels

- Remover `Promise.race` com timeout em `lpBridgeAdapter.cjs::_sendSingleMessage`.
- Remover `cancelStream(context, false)` no timeout.
- Remover `sendMessageWithoutHardTimeout` (ou renomear para refletir comportamento sem timeout).
- Manter apenas mecanismo de detecção de término baseado em estabilidade.

### 3.4 Detecção de término por estabilidade de texto

No `kimi-bridge.cjs` (e `message-sender.cjs` se usado):
- Monitorar `lastResponse` e `lastThinking` do DOM poller.
- Quando `lastResponse.length > 0`, `lastResponse` não mudar por `textStabilityMs` (ex: 8000ms) e `lastThinking` também estiver estável, emitir `completion_candidate` ou sair do loop e chamar `_extractResponseDiff`.
- Ignorar sinais `canSteer`/`isGenerating` para fins de conclusão (são falhos no modo thinking).

### 3.5 Extração final robusta

- Sempre que o loop terminar, chamar `_extractResponseDiff(page, preSendSnapshot)`.
- Se diff vier vazio, fazer fallback para `_extractResponse` (último assistant).
- Se ainda vazio, logar estado do DOM e continuar (não retornar string vazia silenciosamente).

---

## 4. Remoção do Modo Mock

### 4.1 `lpGenerationService.js`

- Remover `this.mockMode = !config.kimiBridge.enabled`.
- Remover `runMockGeneration()` e `generateMockReview()`.
- Remover fallback para mock em `generateLandingPage()`.
- Manter apenas `runRealGeneration()`.
- Garantir que `config.kimiBridge.enabled` seja sempre tratado como `true` (ou remover a flag).

### 4.2 LOJA

- Remover qualquer lógica de mock em publicação de templates.
- Garantir que `publishFromSession` e `publishUnreviewedFromSession` sejam chamadas apenas no fluxo real.

---

## 5. Processamento da LOJA

Após estabilizar a ponte, executar em sequência:

1. **Sanitizar todos os templates** existentes com `status` diferente de `available`.
   - Para cada template, chamar `lpSanitizationOrchestrator` (que agora deve funcionar sem timeout).
   - Alternativa: criar script/endpoint que dispare sanitização em massa.
2. **Screenshot de capa** para templates sem thumbnail.
   - Usar `lpTemplateScreenshotService` (ou função existente) para gerar `thumbnail_url`.
3. **Preencher metadata** (nome, descrição, categoria, tags, stack, etc.).
   - Usar função existente de enriquecimento de metadata ou ponte Kimi para gerar a partir do HTML/prompt.

---

## 6. Riscos e Mitigações

| Risco | Mitigação |
|---|---|
| Kimi demorar muito | Sem timeout; detectar estabilidade de texto. |
| Detecção de estabilidade falhar | Fallback por estabilidade maior (ex: 15s, 30s). |
| Chromium não ter login | Usar `user-data-dir` persistente; fazer login manual uma vez se necessário. |
| Extensão Luna não carregar | Verificar path e logs do Chrome na inicialização. |
| Quebra de outros fluxos | Testar geração real ponta a ponta antes de processar a LOJA. |

---

## 7. Testes de Aceitação

- [ ] Geração real de landing page completa sem `bridge response length=0`.
- [ ] Publicação automática na LOJA cria template `sanitizing` e depois `available`.
- [ ] Template publicado aparece na LOJA com preview, metadata e thumbnail.
- [ ] Compra de template funciona e desbloqueia o prompt original.
- [ ] Uso do template cria nova sessão com HTML e prompt corretos.
- [ ] Não existe mais código de mock ativo no repositório.
