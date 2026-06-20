# Contexto do Problema — Loop Infinito de Revisão

## Data: 2026-06-18
## Status: 🟡 EM IMPLEMENTAÇÃO — Abordagem Híbrida

---

## Checkpoint Git

- **Commit:** `6b0354c` — `checkpoint(pre-fix-loop)`
- **Push:** `main → origin` ✅
- **URL:** https://github.com/Jhin1v9/nexo-lp-creator/commit/6b0354c

---

## Problema Raiz (Confirmado)

O **prompt do fixer não recebe instruções focadas** — recebe o JSON de review inteiro (500+ linhas) e a Kimi não consegue extrair o que realmente precisa consertar. Resultado: HTML devolvido é igual ou quase igual ao original → loop eterno de rebuild.

---

## Abordagem Escolhida: Híbrida (Foco + HTML Completo)

**Princípio:** A Kimi continua gerando HTML inteiro corrigido, mas recebe instruções **muito mais focadas e estruturadas** em vez do review JSON gigante.

### Mudança 1: Prompt do Fixer (`nexoPromptPack.js`)

**ANTES:**
```
QA review result: {JSON gigante com 500 linhas}
Current HTML: {HTML completo}
Conserta tudo.
```

**DEPOIS:**
```
INSTRUÇÕES DE CORREÇÃO (aplicar nesta ordem):
1. [CRÍTICO] Adicionar aria-label na section "Features"
2. [AVISO] Trocar div por nav no menu  
3. [SUGESTÃO] Melhorar contraste do botão CTA

HTML ATUAL:
{HTML completo}

REGRAS:
- Aplique TODAS as instruções acima
- Devolva o HTML COMPLETO corrigido
- Não omita nenhuma seção
- Preserve designTokens, cores e Tailwind classes
```

### Mudança 2: Parser (`lpGenerationService.js`)

Extrair `rebuildInstructions.specificFixes` do review e passar **só as instruções** pro fixer, não o review inteiro.

Linha afetada: 579
```js
// ANTES:
const fixPrompt = PHASE_PROMPTS.fix(currentHtml, context.review);

// DEPOIS:
const fixInstructions = extractFixInstructions(context.review);
const fixPrompt = PHASE_PROMPTS.fix(currentHtml, fixInstructions);
```

### Mudança 3: Verificação de Progresso

Comparar HTML antes/depois do fix. Se não mudou nada, parar o loop e reportar "fix não aplicado".

---

## Arquivos a Modificar

| Ordem | Arquivo | Mudança | Status |
|-------|---------|---------|--------|
| 1 | `nexo-lp-server/services/prompts/nexoPromptPack.js` | Novo prompt do fixer com instruções focadas | ⏳ Pendente |
| 2 | `nexo-lp-server/services/lpGenerationService.js` | Extrair specificFixes e passar pro fixer | ⏳ Pendente |
| 3 | `nexo-lp-server/services/lpGenerationService.js` | Verificação de progresso (HTML mudou?) | ⏳ Pendente |

---

## Próximos Passos

1. ✅ Checkpoint salvo no GitHub
2. ⏳ Implementar novo prompt do fixer
3. ⏳ Implementar parser de specificFixes
4. ⏳ Implementar verificação de progresso
5. ⏳ Testar com geração real de LP
6. ⏳ Commit e push das mudanças

---

## Notas

- Schema do revisor (`04-qa.md`) NÃO será alterado — já tem `rebuildInstructions.specificFixes`
- A Kimi continua gerando HTML completo (requisito do usuário)
- Foco é em **qualidade das instruções** que ela recebe, não no formato de saída
- Se a abordagem híbrida não funcionar, considerar: (a) aumentar maxAttempts, (b) usar local rebuild engine como primário, (c) revisar prompt do revisor para gerar fixes mais específicos
