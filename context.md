# Contexto do Problema — Loop Infinito de Revisão

## Data: 2026-06-18
## Status: 🔴 CRÍTICO — Em investigação

---

## Problema Raiz

O **prompt do agente revisor não está extraindo o JSON de fixes** que a Kimi gera. Os fixes chegam **vazios** ao executor, criando ciclo eterno:

```
Análise → Fix vazio → Build → Análise → Fix vazio → Build → ... (loop eterno)
```

**NÃO é problema de limite de tentativas** (maxAttempts=3). É problema de **parsing do JSON de fixes** na pipeline.

---

## Cadeia de Falha Suspeita

1. **Prompt do revisor** — Como instrui a Kimi a formatar o JSON de fixes?
2. **Parser de resposta** — Como o backend extrai o JSON da resposta da Kimi?
3. **Prompt do fixer** — O que o agente fixer recebe quando os fixes estão vazios?

---

## Arquivos a Investigar

| Arquivo | Propósito | Status |
|---------|-----------|--------|
| `prompts/reviewer-prompt.md` ou similar | Instruções de formato JSON para fixes | ⏳ Não lido |
| `services/lpGenerationService.js` | Parser de resposta do revisor | ⏳ Não lido |
| `prompts/fixer-prompt.md` ou similar | O que o fixer recebe como input | ⏳ Não lido |
| `config/nexo-lp-config.js` | Config de maxAttempts (já confirmado = 3) | ✅ Lido |

---

## Próximos Passos

1. Ler prompt do revisor → verificar instrução de formato JSON
2. Ler parser em lpGenerationService.js → verificar regex/extração de JSON
3. Ler prompt do fixer → verificar se aceita array vazio
4. Corrigir o ponto de falha na cadeia

---

## Notas

- Limite de rebuild já confirmado: `maxAttempts = 3` (config) → `maxRebuildAttempts = 3` (service)
- O loop "morre" após 3 tentativas, mas o problema real é que **nenhuma tentativa produz fix válido**
- Aumentar maxAttempts para 5 NÃO resolve — só prolonga o loop vazio
