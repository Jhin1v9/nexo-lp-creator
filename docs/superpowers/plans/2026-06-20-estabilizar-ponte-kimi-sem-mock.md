# Estabilizar Ponte Kimi, Remover Mock e Processar LOJA — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remover o modo mock, estabilizar a ponte Kimi real (sem timeouts/hard-cancels, término por estabilidade de texto DOM) e processar todos os templates da LOJA (sanitização, screenshot de capa, metadata).

**Architecture:** A ponte Kimi passa a usar Chromium com perfil persistente e extensão Luna DOM Observer no path correto. A detecção de conclusão deixa de depender de estados de UI (`canSteer`/`isGenerating`) e passa a observar estabilidade do texto da resposta no DOM. O `lpGenerationService` perde todo o código mock. Após validação da geração real, a LOJA é processada por scripts/orquestradores existentes.

**Tech Stack:** Node.js, Playwright (CDP), Chromium, SQLite (sql.js), PM2, NEXO LP Creator services.

---

## File Structure

| File | Responsibility |
|---|---|
| `nexo-lp-server/services/luna/kimi-bridge.cjs` | Core da ponte: inicialização do Chrome, streaming, detecção de término, extração de resposta. |
| `nexo-lp-server/services/lpBridgeAdapter.cjs` | Fachada: prepara contexto, chama `sendMessageStream`, gerencia timeouts/cancelamentos. |
| `nexo-lp-server/services/lpGenerationService.js` | Orquestra as fases de geração; perde código mock. |
| `nexo-lp-server/config/nexo-lp-config.js` | Configurações da ponte e da LOJA. |
| `nexo-lp-server/services/luna/luna-extension/` | Extensão Chrome copiada de `luna-extension/`. |
| `nexo-lp-server/services/lpTemplateService.js` | Publicação na LOJA. |
| `nexo-lp-server/services/lpSanitizationOrchestrator.js` | Sanitização de templates. |
| `nexo-lp-server/services/lpTemplateScreenshotService.js` | Screenshot de capa dos templates. |
| `data/nexo-lp.db` | Banco SQLite (fazer backup antes). |

---

## Task 1: Backup do banco de dados

**Files:**
- Backup: `data/nexo-lp.db` → `data/nexo-lp.db.pre-stabilize-backup`

- [ ] **Step 1: Parar o servidor para garantir consistência do backup**

```bash
pm2 stop nexo-lp-server
```

Expected: `[PM2] [nexo-lp-server](...) stopped`

- [ ] **Step 2: Fazer backup do banco**

```bash
cp /home/jhin/luna/nexo-lp-creator/data/nexo-lp.db \
   /home/jhin/luna/nexo-lp-creator/data/nexo-lp.db.pre-stabilize-backup
ls -lh /home/jhin/luna/nexo-lp-creator/data/nexo-lp.db*
```

Expected: arquivo `nexo-lp.db.pre-stabilize-backup` criado com mesmo tamanho do original.

- [ ] **Step 3: Reiniciar o servidor**

```bash
pm2 start nexo-lp-server
```

---

## Task 2: Copiar extensão Luna para o path esperado pela ponte

**Files:**
- Source: `luna-extension/`
- Target: `nexo-lp-server/services/luna/luna-extension/`

- [ ] **Step 1: Verificar arquivos da extensão**

```bash
ls -la /home/jhin/luna/nexo-lp-creator/luna-extension/
```

Expected: `manifest.json`, `content.js`, `injected.js`, `background.js`, icons.

- [ ] **Step 2: Copiar a extensão**

```bash
cp -r /home/jhin/luna/nexo-lp-creator/luna-extension \
      /home/jhin/luna/nexo-lp-creator/nexo-lp-server/services/luna/luna-extension
ls -la /home/jhin/luna/nexo-lp-creator/nexo-lp-server/services/luna/luna-extension/
```

Expected: `manifest.json` presente no destino.

---

## Task 3: Preferir Chromium no launcher da ponte

**Files:**
- Modify: `nexo-lp-server/services/luna/kimi-bridge.cjs:3985-3999`

- [ ] **Step 1: Alterar ordem de preferência de executáveis**

Replace:
```js
    const chromeCmds = [
      'google-chrome',
      'google-chrome-stable',
      'chromium',
      'chromium-browser',
      '/usr/bin/google-chrome',
      '/usr/bin/chromium',
    ];
```

With:
```js
    const chromeCmds = [
      'chromium',
      'chromium-browser',
      '/usr/bin/chromium',
      '/usr/bin/chromium-browser',
      'google-chrome',
      'google-chrome-stable',
      '/usr/bin/google-chrome',
    ];
```

- [ ] **Step 2: Adicionar log indicando qual browser foi escolhido**

After `if (!chromePath)` block, add:
```js
    log.info(`[checkChrome] Selected browser: ${chromePath}`);
```

- [ ] **Step 3: Verificar que Chromium existe**

```bash
which chromium chromium-browser /usr/bin/chromium /usr/bin/chromium-browser
```

Expected: at least one path returned.

---

## Task 4: Remover timeouts e hard-cancels do adaptador

**Files:**
- Modify: `nexo-lp-server/services/lpBridgeAdapter.cjs:185-324` (aprox)

- [ ] **Step 1: Abrir `_sendSingleMessage` e identificar `Promise.race` com timeout**

Read the function to locate:
```js
const timeoutPromise = new Promise((_, reject) => {
  setTimeout(() => {
    BridgeAdapter.cancelStream(context, false);
    reject(new Error(`Phase ${options.phase} timed out...`));
  }, options.phaseTimeoutMs);
});
return Promise.race([sendPromise, timeoutPromise]);
```

- [ ] **Step 2: Substituir por espera pura do stream**

Replace the `Promise.race` block with:
```js
    const result = await sendPromise;
    return result;
```

- [ ] **Step 3: Remover chamada `cancelStream` no timeout (se houver outra)**

Search and remove any remaining `BridgeAdapter.cancelStream(context, false)` triggered by timeout.

- [ ] **Step 4: Verificar que `phaseTimeoutMs` ainda existe mas não é usado**

Grep:
```bash
grep -n "phaseTimeoutMs\|cancelStream.*false\|Promise.race" \
  /home/jhin/luna/nexo-lp-creator/nexo-lp-server/services/lpBridgeAdapter.cjs
```

Expected: no `Promise.race` with timeout, no hard-cancel.

---

## Task 5: Implementar detecção de término por estabilidade de texto DOM

**Files:**
- Modify: `nexo-lp-server/services/luna/kimi-bridge.cjs` (stream loop + completion detection)

- [ ] **Step 1: Localizar `_checkCompletionCandidate` (~linha 5127)**

Read the function and identify the voting threshold (`>= 5`).

- [ ] **Step 2: Adicionar sinal de estabilidade de texto absoluta**

Inside `_checkCompletionCandidate`, after existing signal collection, add:
```js
    // v12.0: absolute text-stability signal (no timeout, no hard-cancel)
    const textStableMs = Date.now() - this.lastResponseChangeAt;
    const thinkingStableMs = Date.now() - this.lastThinkingChangeAt;
    const hasResponse = typeof lastResponse === 'string' && lastResponse.length > 0;
    if (hasResponse && textStableMs > 10000 && thinkingStableMs > 10000) {
      signals.textStable = 3; // strong signal
    }
```

Ensure `this.lastResponseChangeAt` and `this.lastThinkingChangeAt` are initialized to `Date.now()` in constructor or reset on message send.

- [ ] **Step 3: Atualizar `lastResponseChangeAt` e `lastThinkingChangeAt` no poller**

Locate where `lastResponse` and `lastThinking` are updated (inside `_pollThinkingAndResponse` or similar). Add:
```js
    if (currentResponse !== this.lastResponse) {
      this.lastResponse = currentResponse;
      this.lastResponseChangeAt = Date.now();
    }
    if (currentThinking !== this.lastThinking) {
      this.lastThinking = currentThinking;
      this.lastThinkingChangeAt = Date.now();
    }
```

- [ ] **Step 4: Reduzir threshold quando sinal de estabilidade de texto for forte**

Change the threshold logic from:
```js
    if (signalSum >= 5) {
```
to:
```js
    const finalThreshold = signals.textStable ? 3 : 5;
    if (signalSum >= finalThreshold) {
```

- [ ] **Step 5: Garantir extração final quando o loop terminar**

In `sendMessageStream`, locate the loop exit and ensure immediately after:
```js
    const finalResponse = await this._extractResponseDiff(page, preSendSnapshot)
      || await this._extractResponse(page)
      || lastResponse
      || '';
    return { content: finalResponse, done: true };
```

- [ ] **Step 6: Verificar que não há mais hard-cancel no timeout**

Grep:
```bash
grep -n "cancelStream.*false\|hard.*cancel\|stopConsuming" \
  /home/jhin/luna/nexo-lp-creator/nexo-lp-server/services/luna/kimi-bridge.cjs
```

Expected: only soft-cancel path remains, no timeout-triggered hard-cancel.

---

## Task 6: Remover modo mock do `lpGenerationService`

**Files:**
- Modify: `nexo-lp-server/services/lpGenerationService.js`

- [ ] **Step 1: Remover flag `mockMode`**

Find and delete:
```js
    this.mockMode = !config.kimiBridge.enabled;
```

- [ ] **Step 2: Remover métodos mock**

Delete entire methods:
- `runMockGeneration(sessionId, userId, prompt)`
- `generateMockReview(html)`

- [ ] **Step 3: Simplificar `generateLandingPage`**

Replace any branching like:
```js
    if (this.mockMode) {
      return this.runMockGeneration(...);
    }
    return this.runRealGeneration(...);
```
with:
```js
    return this.runRealGeneration(sessionId, userId, prompt, options);
```

- [ ] **Step 4: Garantir que `config.kimiBridge.enabled` não desativa a geração**

In `nexo-lp-server/config/nexo-lp-config.js`, set default:
```js
    enabled: process.env.KIMI_BRIDGE_ENABLED !== 'false',
```
(or remove the ability to disable entirely).

- [ ] **Step 5: Verificar que não resta código mock**

Grep:
```bash
grep -n "mockMode\|runMockGeneration\|generateMockReview\|Mock" \
  /home/jhin/luna/nexo-lp-creator/nexo-lp-server/services/lpGenerationService.js
```

Expected: no matches.

---

## Task 7: Testar geração real ponta a ponta

**Files:**
- N/A (runtime test)

- [ ] **Step 1: Reiniciar servidor com novas configurações**

```bash
pm2 restart nexo-lp-server
pm2 logs nexo-lp-server --lines 50
```

- [ ] **Step 2: Criar nova sessão e enviar prompt real**

```bash
curl -s -X POST http://localhost:3460/api/nexo-lp/sessions \
  -H "Content-Type: application/json" \
  -d '{"userId":"test-real-generation","stack":"static-html-tailwind","initialPrompt":"Landing page de cafeteria artesanal com hero, menu e contato"}' \
  | python3 -m json.tool
```

Save returned `id` as `SESSION_ID`.

- [ ] **Step 3: Iniciar geração real**

```bash
curl -s -X POST http://localhost:3460/api/nexo-lp/generate \
  -H "Content-Type: application/json" \
  -d "{\"sessionId\":\"$SESSION_ID\",\"userId\":\"test-real-generation\",\"prompt\":\"Landing page de cafeteria artesanal com hero, menu e contato\"}" \
  | python3 -m json.tool
```

- [ ] **Step 4: Acompanhar logs e aguardar conclusão**

```bash
pm2 logs nexo-lp-server --lines 100
```

Expected: logs show phases `intention`, `structure`, `code`, `review`, `preview` completing. No `bridge response length=0`. Final status should be `preview`.

- [ ] **Step 5: Verificar HTML gerado**

```bash
curl -s http://localhost:3460/api/nexo-lp/sessions/$SESSION_ID | python3 -m json.tool | grep -E '"status"|"current_html"' | head -n 5
```

Expected: `status` = `preview`, `current_html` non-empty and contains Tailwind classes.

---

## Task 8: Processar LOJA — sanitizar templates pendentes

**Files:**
- Modify/runtime: `nexo-lp-server/services/lpSanitizationOrchestrator.js` (if needed)
- Create (optional): script to trigger mass sanitization

- [ ] **Step 1: Listar templates pendentes**

```bash
cd /home/jhin/luna/nexo-lp-creator/nexo-lp-server
node -e "
const sqlite = require('./models/sqlite');
(async () => {
  await sqlite.initializeDatabase();
  const rows = sqlite.query(\"SELECT id, name, status FROM templates WHERE status != 'available'\", []);
  console.log(JSON.stringify(rows, null, 2));
})();
"
```

Save list.

- [ ] **Step 2: Criar script de sanitização em massa**

Create `scripts/sanitize-all-templates.js`:
```js
const sqlite = require('../nexo-lp-server/models/sqlite');
const lpSanitizationOrchestrator = require('../nexo-lp-server/services/lpSanitizationOrchestrator');

async function main() {
  await sqlite.initializeDatabase();
  const rows = sqlite.query("SELECT id FROM templates WHERE status != 'available'", []);
  console.log(`Found ${rows.length} templates to sanitize`);
  for (const row of rows) {
    try {
      console.log(`Sanitizing ${row.id}...`);
      await lpSanitizationOrchestrator.sanitizeTemplate(row.id);
      console.log(`Done ${row.id}`);
    } catch (e) {
      console.error(`Failed ${row.id}: ${e.message}`);
    }
  }
}

main().catch(e => { console.error(e); process.exit(1); });
```

- [ ] **Step 3: Executar sanitização**

```bash
node /home/jhin/luna/nexo-lp-creator/scripts/sanitize-all-templates.js
```

Expected: templates transition to `available` (or `unreviewed` if Kimi fails; with new stability fixes, should mostly be `available`).

---

## Task 9: Processar LOJA — screenshot de capa

**Files:**
- Use: `nexo-lp-server/services/lpTemplateScreenshotService.js`
- Create: `scripts/screenshot-all-templates.js`

- [ ] **Step 1: Entender API do screenshot service**

Read `nexo-lp-server/services/lpTemplateScreenshotService.js` and identify the method to generate a thumbnail from a template or session ID.

- [ ] **Step 2: Criar script de screenshot em massa**

Create `scripts/screenshot-all-templates.js`:
```js
const sqlite = require('../nexo-lp-server/models/sqlite');
const lpTemplateScreenshotService = require('../nexo-lp-server/services/lpTemplateScreenshotService');

async function main() {
  await sqlite.initializeDatabase();
  const rows = sqlite.query("SELECT id FROM templates WHERE thumbnail_url IS NULL OR thumbnail_url = ''", []);
  console.log(`Found ${rows.length} templates without thumbnail`);
  for (const row of rows) {
    try {
      console.log(`Screenshot ${row.id}...`);
      await lpTemplateScreenshotService.generateThumbnail(row.id);
      console.log(`Done ${row.id}`);
    } catch (e) {
      console.error(`Failed ${row.id}: ${e.message}`);
    }
  }
}

main().catch(e => { console.error(e); process.exit(1); });
```

- [ ] **Step 3: Executar screenshots**

```bash
node /home/jhin/luna/nexo-lp-creator/scripts/screenshot-all-templates.js
```

Expected: `thumbnail_url` populated for templates.

---

## Task 10: Processar LOJA — preencher metadata

**Files:**
- Create: `scripts/enrich-all-templates.js`
- Use: existing metadata enrichment logic or call Kimi bridge

- [ ] **Step 1: Identificar campos de metadata esperados**

Check `templates` table schema:
```bash
cd /home/jhin/luna/nexo-lp-creator/nexo-lp-server
node -e "
const sqlite = require('./models/sqlite');
(async () => {
  await sqlite.initializeDatabase();
  const cols = sqlite.query(\"PRAGMA table_info(templates)\", []);
  console.log(cols.map(c => c.name).join(', '));
})();
"
```

- [ ] **Step 2: Criar script de enriquecimento**

Create `scripts/enrich-all-templates.js`:
```js
const sqlite = require('../nexo-lp-server/models/sqlite');
const lpTemplateService = require('../nexo-lp-server/services/lpTemplateService');

async function main() {
  await sqlite.initializeDatabase();
  const rows = sqlite.query("SELECT id FROM templates WHERE description IS NULL OR description = '' OR tags IS NULL OR tags = ''", []);
  console.log(`Found ${rows.length} templates to enrich`);
  for (const row of rows) {
    try {
      console.log(`Enriching ${row.id}...`);
      await lpTemplateService.enrichTemplateMetadata(row.id);
      console.log(`Done ${row.id}`);
    } catch (e) {
      console.error(`Failed ${row.id}: ${e.message}`);
    }
  }
}

main().catch(e => { console.error(e); process.exit(1); });
```

If `enrichTemplateMetadata` does not exist, implement it in `lpTemplateService.js`:
```js
  async enrichTemplateMetadata(templateId) {
    const template = await TemplateRepository.findById(templateId);
    if (!template) throw new Error('Template not found');
    const sourceSession = await SessionRepository.findById(template.session_id);
    const originalPrompt = await this.resolveOriginalPrompt(template, sourceSession);
    const html = template.html || '';
    const title = template.name || this._extractTitle(html) || 'Template';
    const description = template.description || this._generateDescription(originalPrompt, html);
    const category = template.category || this._inferCategory(originalPrompt, html);
    const tags = template.tags || this._inferTags(originalPrompt, html);
    await TemplateRepository.update(templateId, {
      name: title,
      description,
      category,
      tags,
      updated_at: new Date().toISOString(),
    });
  }
```

Add helpers `_extractTitle`, `_generateDescription`, `_inferCategory`, `_inferTags` using simple heuristics or Kimi bridge call.

- [ ] **Step 3: Executar enriquecimento**

```bash
node /home/jhin/luna/nexo-lp-creator/scripts/enrich-all-templates.js
```

Expected: templates have `description`, `category`, `tags` populated.

---

## Task 11: Verificações finais

**Files:**
- N/A (runtime verification)

- [ ] **Step 1: Verificar status dos templates na LOJA**

```bash
cd /home/jhin/luna/nexo-lp-creator/nexo-lp-server
node -e "
const sqlite = require('./models/sqlite');
(async () => {
  await sqlite.initializeDatabase();
  const rows = sqlite.query(\"SELECT status, COUNT(*) as count FROM templates GROUP BY status\", []);
  console.log(JSON.stringify(rows, null, 2));
})();
"
```

Expected: most templates in `available`; few or none in `unreviewed`/`failed`.

- [ ] **Step 2: Abrir LOJA no frontend e conferir cards**

Navigate browser to `http://localhost:5174/?session=<any>` → click LOJA.
Expected: templates render with thumbnail, title, description, price, status.

- [ ] **Step 3: Testar compra + use de um template available**

Follow previous working flow: buy template, verify prompt unlocked, use template.

- [ ] **Step 4: Commit das mudanças**

```bash
git add -A
git commit -m "feat: remove mock, stabilize Kimi bridge (Chromium + Luna ext + text-stability completion), process LOJA"
```

---

## Self-Review

**Spec coverage:**
- Chromium usage → Task 3
- Luna extension path → Task 2
- No timeout/hard-cancel → Task 4
- Text-stability completion → Task 5
- Mock removal → Task 6
- Real generation test → Task 7
- LOJA sanitize/screenshot/metadata → Tasks 8-10

**Placeholder scan:**
- No "TBD", "TODO", "implement later", "fill in details".
- All code snippets are concrete.
- Exact file paths included.

**Type consistency:**
- `lastResponseChangeAt` and `lastThinkingChangeAt` used consistently in Task 5.
- Template field names (`status`, `thumbnail_url`, `description`, `category`, `tags`) match existing repository patterns.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-06-20-estabilizar-ponte-kimi-sem-mock.md`.

**Two execution options:**

1. **Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.
2. **Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

Which approach?
