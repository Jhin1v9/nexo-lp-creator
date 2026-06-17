# NEXO LP Creator — Plano Multi-Modo: Estrelas, Sóis & Lunas

> **Objetivo:** transformar o NEXO LP Creator em um gerador de landing pages com três níveis de "potência" mapeados diretamente aos modos da Kimi Web, economia de tokens baseada no plano Allegretto (~€36/mês), cards de fase reais, fundo celeste suave (anoitecer/amanhecer) e uma LOJA interna de templates/sites gerados, sanitizados/evoluídos pela própria Kimi no mesmo chat, com preview público e prompt protegido.

**Arquitetura:** cada modo (Instant/Thinking → Estrelas, Agent → Sóis, Agent Swarm → Lunas) é apenas uma configuração de `mode` enviada ao `lpBridgeAdapter`, que já navega para `kimi.com/agent` ou `kimi.com/agent-swarm`. O frontend ganha um seletor de modo, um sistema de moedas virtuais, cards de fase renderizados a partir do JSON retornado pela Kimi, e um passo de pós-geração **assíncrono** que envia o HTML de volta ao mesmo chat da Kimi para sanitização/evolução. Enquanto isso, o preview fica com aviso "Sanitizando...". Quando a Kimi terminar, o resultado é publicado na LOJA. O starfield é simplificado para uma animação sutil, e a transição dia/noite é comandada pelo estado `isGenerating`.

**Stack:** Svelte 4 + Vite (frontend), Node/Express + SQLite/sql.js (backend), Luna Kimi WebBridge (Playwright/CDP), Tailwind CSS.

---

## 1. Contexto atual do projeto

- **Backend:** `nexo-lp-server/services/lpGenerationService.js` já orquestra as fases `intention → structure → code → review → preview → deploy` e emite eventos SSE `action_start` / `action_end`.
- **Bridge:** `nexo-lp-server/services/lpBridgeAdapter.cjs` encapsula o Luna Kimi Bridge e aceita `options.mode` (`instant`, `thinking`, `agent`, `swarm`). O `message-sender.cjs` já navega para `/agent` e `/agent-swarm` quando o modo é agente ou swarm.
- **Frontend:** `nexo-lp-web/src/App.svelte` usa `<LunaStarfield active={$isGenerating} />` e um overlay escuro; `LPChatArea.svelte` renderiza `ToolCard` com textos fixos por fase; `LPTemplateStore.svelte` ainda usa dados demo e o rótulo "Templates".
- **Banco:** tabelas `sessions`, `session_versions`, `templates` já existem. A tabela `templates` será reaproveitada como catálogo da LOJA.
- **Tokens:** existe uma store `tokens` no frontend e config `tokens` no backend, mas ainda sem conceito de moedas múltiplas.

---

## 2. Correção crítica: timeout e detecção de fim da geração

### 2.1. Problema reportado

O agente para na fase `preview` quando a Kimi envia um JSON grande de metadados (`preview`, `seo`, `assets`, `structure`, `performance`). O bridge interpreta que a resposta acabou, mas o HTML real ainda não foi gerado. O usuário precisa enviar manualmente `continue`.

### 2.2. Solução proposta

1. **Remover timeout rígido** na geração. A Kimi pode demorar; não vamos forçar erro por isso.
   - Subir o `phaseTimeoutMs` para `0` (desativado) ou para um valor muito alto (30 min).
   - Manter um timeout de segurança de **cancelamento manual** (o usuário pode cancelar).

2. **Detecção de "metadata JSON" e auto-continue:**
   - Se a resposta da fase `code`/`preview` for um JSON que contenha apenas campos como `preview`, `seo`, `assets`, `structure`, `performance`, e não contiver HTML/código real, o backend envia automaticamente uma mensagem de `continue` no mesmo chat.
   - Repete até que a resposta contenha código HTML/JSX/TSX real ou a Kimi pare de gerar conteúdo novo.
   - Limite de tentativas de continue (ex: 5) para evitar loop infinito.

3. **Detecção de fim real:**
   - A fase só termina quando houver conteúdo com `<html`, `<!DOCTYPE`, `export default`, `function App`, etc., ou quando a resposta não mudar por um tempo razoável **e** o botão de envio estiver ativo.

### 2.3. Arquivos

- `nexo-lp-server/services/lpGenerationService.js` — remover/relaxar timeout; implementar auto-continue.
- `nexo-lp-server/services/lpBridgeAdapter.cjs` — expor `sendMessage` no mesmo contexto sem criar novo chat.
- `nexo-lp-server/services/luna/bridge-libs/message-sender.cjs` — aumentar timeout; permitir continue.

---

## 3. Visão geral dos modos de geração

| Modo NEXO | Ícone | Modo Kimi Web | Quando usar | Custo |
|-----------|-------|---------------|-------------|-------|
| **Estrelas** ⭐ | estrela SVG | `instant` ou `thinking` | Landing pages simples em HTML+Tailwind | Estrelas |
| **Sóis** ☀️ | sol SVG | `agent` | Apps/frameworks (React, Vue, Next.js) | Sóis |
| **Lunas** 🌙 | lua SVG | `agent-swarm` | Apps inteiros, múltiplos sub-agentes | Lunas |

### 3.1. Comportamento por modo

- **Estrelas:** navega para `kimi.com/?chat_enter_method=new_chat`. Gera HTML + Tailwind CDN.
- **Sóis:** navega para `kimi.com/agent`. Permite qualquer framework; retorna múltiplos arquivos.
- **Lunas:** navega para `kimi.com/agent-swarm`. Usado para apps inteiros.

---

## 4. Economia de tokens: estrelas, sóis e lunas

### 4.1. Base de cálculo — plano Kimi Allegretto

- **Allegretto:** $39/mês (≈ €36).
- 150 agent tasks/mês.
- 50 Agent Swarm uses/mês.
- 4 concurrent subagents.

### 4.2. Taxa de câmbio interna

```
1 Sól  = 10 Estrelas
1 Lua  = 5 Sóis  = 50 Estrelas
```

### 4.3. Custo por operação

| Operação | Estrelas | Sóis | Lunas |
|----------|----------|------|-------|
| Geração Estrelas | 2 | — | — |
| Geração Sóis | — | 1 | — |
| Geração Lunas | — | — | 1 |
| Rebuild/bugfix | 1 | 1 | — |
| Publicar na LOJA | 1 | — | — |
| Usar template da LOJA | 0 | — | — |

### 4.4. Saldos iniciais

- 50 Estrelas
- 5 Sóis
- 1 Lua

### 4.5. Arquivos

- `nexo-lp-server/models/migrations/008_user_currencies.sql`
- `nexo-lp-server/models/migrations/009_template_prices.sql`
- `nexo-lp-server/models/repositories/CurrencyRepository.js`
- `nexo-lp-server/services/lpCurrencyService.js`
- `nexo-lp-web/src/lib/currency.js`
- `nexo-lp-web/src/stores.js` (substituir `tokens` por `currencies`)

---

## 5. Seletor de modo no frontend

- Criar `nexo-lp-web/src/components/ModeSelector.svelte` com três botões: ⭐ Estrelas, ☀️ Sóis, 🌙 Lunas.
- Ícones em SVG, sem emoji.
- Mostrar custo estimado ao lado.
- Integrar em `LPChatArea.svelte`.
- Enviar `mode` via `lpClient.js`/`api.js`.

---

## 6. Fundo de estrelas suave (anoitecer/amanhecer)

- Criar modo `calm` em `starAnimations.js`.
- Em `LunaStarfield.svelte`, quando `active=true`, usar `calm`.
- Reduzir partículas, remover clusters/shooting stars no modo calm.
- Transição suave de volta ao branco quando `isGenerating=false`.

---

## 7. Cards de fase reais

- Backend envia `result` com JSON real no `action_end` de cada fase.
- Frontend cria componentes em `phase-cards/`:
  - `IntentionCard.svelte`
  - `StructureCard.svelte`
  - `CodeCard.svelte`
  - `ReviewCard.svelte`
  - `PreviewCard.svelte`
- `ToolCard.svelte` renderiza o card correto por fase.

---

## 8. LOJA, sanitização e preview público

### 8.1. Renomear Templates → LOJA

- `App.svelte`: rótulo "LOJA".
- `LPTemplateStore.svelte`: header "LOJA NEXO".
- Tabela `templates` continua a mesma.

### 8.2. Sanitização/evolução pela própria Kimi (backend-only)

**Fluxo:**

1. Usuário faz o site.
2. Backend pega o HTML/arquivo inteiro gerado.
3. Backend envia o arquivo de volta para o **mesmo chat da Kimi** usado na geração daquele site (`context.userId`).
4. Backend envia um prompt cirúrgico de sanitização/evolução.
5. A Kimi retorna o HTML sanitizado e ligeiramente melhorado.
6. Backend publica o resultado na LOJA.

**Regras:**

- Ninguém vê esse processo no frontend.
- Apenas admin vê logs/status.
- Enquanto sanitiza, o preview/template fica com status `sanitizing` e aviso "Sanitizando...".
- Sem timeout; espera a resposta da Kimi terminar.
- Se falhar, o item fica com status `failed` e o admin pode reprocessar.

### 8.3. Prompt de sanitização/evolução

O prompt deve instruir a Kimi a:

1. Remover nomes de marcas, dados pessoais, telefones, emails, endereços reais.
2. Substituir por dados genéricos da NEXO Digital:
   - Nome: NEXO Digital
   - Site: https://www.nexo-digital.app/pt
   - Slogan: "Criamos experiências digitais que convertem."
   - Email: contato@nexo-digital.app
   - Cores: #6366F1 e #8B5CF6
3. Melhorar levemente o copy/design mantendo a estrutura.
4. Retornar **apenas** o HTML final, sem explicações.

Passo de dupla revisão: após o primeiro retorno, enviar um segundo prompt pedindo para revisar se ainda há marcas/dados pessoais e refinar.

### 8.4. Publicar na LOJA

- Criar `nexo-lp-server/services/lpStoreService.js`.
- Criar `nexo-lp-server/services/lpSanitizationService.js`.
- Publicar template com `source: 'generated'`, `status: 'sanitizing'`, preços em moedas.
- Quando a sanitização termina, atualizar para `status: 'available'` e salvar HTML sanitizado.

### 8.5. Preview público via blob

- Todo template na LOJA terá um `previewBlobUrl` gerado a partir do HTML sanitizado.
- O blob é salvo em `data/previews/public/{templateId}.html`.
- Qualquer usuário pode acessar `http://localhost:3460/public-preview/{templateId}`.

### 8.6. Prompt protegido (censurado até pagar)

- O prompt original usado para gerar o template é salvo no banco (`templates.prompt`).
- A API nunca retorna o prompt completo para usuários não pagantes.
- Retorna uma versão censurada: substitui palavras-chave por `***` no backend.
- Após compra, o prompt completo é liberado.

### 8.7. Histórico de ajustes

- Criar tabela `template_revisions` para guardar versões do template (prompt, html, ajustes).
- Cada rebuild/ajuste cria uma nova revisão.

---

## 9. Fluxo completo

```
Usuário escolhe modo ⭐/☀️/🌙 e digita prompt
              │
              ▼
Frontend debita moedas
              │
              ▼
Geração (intention → structure → code → review → preview)
              │
              ▼
Se a resposta parar em JSON de metadados → auto-continue
              │
              ▼
HTML gerado salvo no session
              │
              ▼
Backend inicia sanitização assíncrona no mesmo chat da Kimi
              │
              ▼
Template criado na LOJA com status "sanitizing" + preview bloqueado
              │
              ▼
Quando Kimi terminar: HTML sanitizado salvo, preview público ativo
              │
              ▼
UI volta ao modo "dia" e abre Preview
```

---

## 10. Arquivos

### Novos

- `nexo-lp-server/models/migrations/008_user_currencies.sql`
- `nexo-lp-server/models/migrations/009_template_prices.sql`
- `nexo-lp-server/models/migrations/010_template_status_prompt.sql`
- `nexo-lp-server/models/migrations/011_template_revisions.sql`
- `nexo-lp-server/models/repositories/CurrencyRepository.js`
- `nexo-lp-server/services/lpCurrencyService.js`
- `nexo-lp-server/services/lpSanitizationService.js`
- `nexo-lp-server/services/lpStoreService.js`
- `nexo-lp-web/src/components/ModeSelector.svelte`
- `nexo-lp-web/src/components/ModeIcon.svelte`
- `nexo-lp-web/src/lib/currency.js`
- `nexo-lp-web/src/components/phase-cards/*.svelte`

### Modificados

- `nexo-lp-server/config/nexo-lp-config.js`
- `nexo-lp-server/services/lpGenerationService.js`
- `nexo-lp-server/services/lpBridgeAdapter.cjs`
- `nexo-lp-server/nexo-lp-routes.js`
- `nexo-lp-web/src/stores.js`
- `nexo-lp-web/src/App.svelte`
- `nexo-lp-web/src/components/LPChatArea.svelte`
- `nexo-lp-web/src/components/ToolCard.svelte`
- `nexo-lp-web/src/components/LPTemplateStore.svelte`
- `nexo-lp-web/src/components/LunaStarfield.svelte`
- `nexo-lp-web/src/lib/starAnimations.js`
- `nexo-lp-web/src/lib/lpClient.js`
- `nexo-lp-web/src/api.js`

---

## 11. Roadmap ajustado

### Parte A — Correção de geração (foco primeiro)
1. Remover/relaxar timeouts em `lpGenerationService.js`.
2. Implementar auto-continue quando a resposta for JSON de metadados.
3. Testar geração real até o HTML aparecer sem travar.

### Parte B — Moedas e seletor de modo
4. Criar migrations de moedas e preços.
5. Criar `CurrencyRepository` e `lpCurrencyService`.
6. Criar `ModeSelector` e `currency.js` no frontend.
7. Integrar débito de moedas no envio.

### Parte C — Starfield calmo
8. Implementar modo `calm` e reduzir efeitos.

### Parte D — Cards reais
9. Backend enviar `result` nos eventos.
10. Frontend renderizar cards por fase.

### Parte E — LOJA, sanitização e preview público
11. Criar serviço de sanitização no mesmo chat da Kimi.
12. Criar `lpStoreService` com status `sanitizing`.
13. Criar preview público via blob.
14. Implementar prompt censurado.
15. Renomear UI para LOJA.

### Parte F — Testes finais
16. Testar todos os modos.
17. Testar sanitização real.
18. Testar preview público e proteção de prompt.

---

## 12. Decisões assumidas

1. **LOJA é marketplace interno** com preços em moedas.
2. **Sanitização é feita pela própria Kimi no mesmo chat**, backend-only, sem frontend.
3. **Preview fica "Sanitizando..."** até a Kimi terminar.
4. **Sem timeout rígido** na geração/sanitização.
5. **Taxa de câmbio:** 1 Sól = 10 Estrelas, 1 Lua = 5 Sóis = 50 Estrelas.
6. **Prompt original é censurado no backend** até o usuário pagar.
7. **Histórico de ajustes** em `template_revisions`.
