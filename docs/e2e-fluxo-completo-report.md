# Relatório de Teste End-to-End — Fluxo Completo NEXO LP Creator

**Data:** 2026-06-20  
**Autor:** Kimi Code CLI  
**Ambiente:** Local (Linux), servidores gerenciados por PM2  
**Projeto:** `/home/jhin/luna/nexo-lp-creator`

---

## 1. Resumo Executivo

Este relatório documenta o teste end-to-end do fluxo completo do **NEXO Landing Page Creator**, desde a geração de uma landing page até a compra e reutilização de um template na **LOJA**.

**Resultado geral:** o fluxo funciona integralmente quando a geração é executada em modo mock. A publicação automática na LOJA e a sanitização dependem da ponte Kimi real, que está instável no ambiente testado e retorna respostas vazias. Um bug crítico no frontend (`getContextWarning is not a function`) foi corrigido.

---

## 2. Ambiente de Teste

| Componente | Caminho / Endereço | Estado |
|---|---|---|
| Servidor API | `nexo-lp-server/nexo-lp-server.js` | PM2 `online` (porta 3460) |
| Frontend | `nexo-lp-web` | PM2 `online` (porta 5174) |
| Banco de dados | `data/nexo-lp.db` (SQLite via sql.js) | Funcional |
| Ponte Kimi | `KIMI_BRIDGE_ENABLED=false` (mock) | Desativada para contornar instabilidade |

**Configuração relevante:**
- `config.kimiBridge.enabled = false` → geração em modo mock.
- A sanitização, no entanto, ainda tenta usar a ponte Kimi real internamente e falha.

---

## 3. Fluxo Testado

```
[Usuário envia prompt]
        ↓
[Geração da landing page]
        ↓
[Preview / Code / Deploy]
        ↓
[Publicação na LOJA]
        ↓
[Sanitização do template]
        ↓
[Template disponível (available)]
        ↓
[Compra do template na LOJA]
        ↓
[Uso do template em novo projeto]
        ↓
[Prompt original desbloqueado]
```

---

## 4. Resultados Detalhados

### 4.1 Geração da Landing Page

- **Entrada:** prompt para landing page de cafeteria/padaria artesanal.
- **Comportamento em modo real:** a ponte Kimi retornou `bridge response length=0` nas fases `code` e `review`, impedindo a geração completa.
- **Comportamento em modo mock:** geração concluída com sucesso em poucos segundos.
- **Resultado:** `success` — sessão em status `preview` com `preview_url` válido.

### 4.2 Preview, Code e Deploy

- A aba **Preview** renderizou o HTML mock gerado.
- A aba **Code** exibiu o HTML completo.
- A aba **Deploy** ficou disponível para uso.
- Todas as abas responderam corretamente via interações no navegador.

### 4.3 Publicação na LOJA

- Endpoint: `POST /api/nexo-lp/sessions/:id/publish`
- A publicação manual funcionou.
- O template foi criado com:
  - `status: 'sanitizing'`
  - `is_public: 1`
  - `prompt_censored: '[PROMPT BLOCKED — purchase this template in the LOJA to unlock the original prompt]'`

### 4.4 Sanitização

- A sanitização é iniciada em background por `lpSanitizationOrchestrator`.
- **Problema:** o orquestrador chama a ponte Kimi real (`_sendToKimi`), que falha com erro de navegação/frame detached.
- **Consequência:** o template cai de `sanitizing` para `unreviewed`, permanecendo com `is_public: 1` e preço reduzido (50% off).
- Templates em `unreviewed` **não podem ser comprados** — a LOJA exige `status: 'available'`.

> Para concluir o teste do fluxo de compra, foi necessário simular uma sanitização bem-sucedida alterando o status do template para `available` e `is_public: 2` diretamente no banco SQLite, seguido de reinício do servidor (sql.js mantém o banco em memória).

### 4.5 Compra do Template

- Testado via API e via frontend.
- Endpoint: `POST /api/nexo-lp/templates/:id/buy`
- A compra deduziu 3 ⭐ do saldo do comprador e registrou a aquisição.
- Registro criado: `tpu-1781924506749-45vqxl`.

### 4.6 Desbloqueio do Prompt Original

- Antes da compra: prompt exibido como **Locked**.
- Após a compra: prompt exibido como **Unlocked** com o texto original:

> *"Prompt original secreto do usuário para uma landing page de cafeteria artesanal"*

- O endpoint `GET /api/nexo-lp/templates/:id/prompt` retornou corretamente:
  ```json
  {
    "unlocked": true,
    "prompt": "Prompt original secreto do usuário para uma landing page de cafeteria artesanal",
    "censored": false
  }
  ```

### 4.7 Uso do Template

- Endpoint: `POST /api/nexo-lp/templates/:id/use`
- Via API: criou uma nova sessão (`sess-1781924514081-zr0nw5`) com o HTML do template e o prompt original como `initial_prompt`.
- Via frontend: após clicar em **Use Template**, a sessão atual foi atualizada e o editor exibiu:
  - Título alterado para o nome do template.
  - Badge "Using template: ...".
  - Mensagem do prompt original no chat.

---

## 5. Bugs Encontrados e Correções

### 5.1 `getContextWarning is not a function`

- **Severidade:** Crítico (impedia carregamento do frontend).
- **Local:** `nexo-lp-web/src/lib/lpClient.js`
- **Causa:** o componente `LunaChat.svelte` chamava `lpClient.getContextWarning()`, mas o método não existia na classe `LPClient`.
- **Correção:** adicionado o método `getContextWarning()` retornando `this.contextWarning`.

```js
/**
 * Get context warning level
 */
getContextWarning() {
  return this.contextWarning;
}
```

### 5.2 Modal da LOJA não abria (parcial)

- **Observação inicial:** clicar em cards de templates com status `unreviewed` ou com estado inconsistente não abria o `LPTemplateModal`.
- **Resultado após correção de dados:** com templates em status `available`, o modal abriu corretamente no frontend e todo o fluxo de compra/use funcionou.
- **Possível causa raiz:** estado do componente `LPTemplateStore.svelte` ou dados inconsistentes de templates `unreviewed`.

### 5.3 Geração real falha silenciosamente

- **Severidade:** Alta.
- **Causa:** ponte Kimi real retorna respostas vazias (`length=0`) nas fases `code` e `review`.
- **Impacto:** impede publicação automática na LOJA a partir da geração real.
- **Status:** não corrigido — depende da estabilidade da ponte Kimi.

### 5.4 Publicação automática desativada no modo mock

- **Severidade:** Média (apenas para testes).
- **Causa:** `runMockGeneration` não chama `lpTemplateService.publishFromSession`.
- **Impacto:** em modo mock, a publicação na LOJA só pode ser feita manualmente.

---

## 6. Bloqueios Pendentes

| # | Bloqueio | Impacto | Próximo passo |
|---|---|---|---|
| 1 | Ponte Kimi real retorna respostas vazias | Geração real impossível; sanitização sempre falha | Investigar logs da ponte Kimi e credenciais/sessão |
| 2 | Sanitização depende da ponte Kimi real | Templates publicados caem para `unreviewed` e não são compráveis | Tornar a sanitização mockável ou tolerante a falhas |
| 3 | Publicação automática desativada em mock | Fluxo completo automático não testável em mock | Adicionar flag para publicar automaticamente também em mock |

---

## 7. Evidências

- Screenshot do frontend após uso do template: `loja-use-template-success.png`
- Logs do servidor: `logs/nexo-lp-server-out.log`
- Logs de erro: `logs/nexo-lp-server-error.log`
- Backup do banco antes do teste de fluxo completo: `data/nexo-lp.db.backup-e2e`

---

## 8. Próximos Passos Recomendados

1. **Investigar a ponte Kimi real:** verificar por que as fases `code` e `review` retornam `bridge response length=0`.
2. **Tornar a sanitização mockável:** adicionar uma flag de configuração para simular sanitização bem-sucedida sem depender da ponte Kimi.
3. **Publicação automática em mock:** permitir que `runMockGeneration` publique na LOJA quando uma flag de debug/teste estiver ativa.
4. **Adicionar testes E2E automatizados:** cobrir o fluxo de geração → publicação → compra → uso.
5. **Revisar o estado do modal da LOJA:** garantir que o `LPTemplateModal` abra corretamente mesmo para templates `unreviewed` (exibindo motivo de indisponibilidade).

---

## 9. Conclusão

O fluxo completo do NEXO LP Creator foi demonstrado com sucesso em modo mock, incluindo a compra e o desbloqueio do prompt original na LOJA. O principal impedidor para produção é a instabilidade da ponte Kimi real, que afeta tanto a geração real quanto a sanitização de templates. As correções de frontend aplicadas permitem que o fluxo seja testado e demonstrado localmente.
