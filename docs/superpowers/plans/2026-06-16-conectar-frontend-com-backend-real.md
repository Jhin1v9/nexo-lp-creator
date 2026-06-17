# Conectar Frontend com Backend Real — NEXO LP Creator

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fazer o frontend do NEXO LP Creator refletir o estado real do backend: mostrar o preview do HTML gerado pela Kimi Web, permitir download do HTML real e de um ZIP completo, exibir tool cards/mensagens de progresso reais via SSE e corrigir bugs críticos que quebram o fluxo end-to-end.

**Architecture:** O backend já gera HTML real via `lpGenerationService.runRealGeneration()` usando a Luna Kimi Bridge. Os eventos SSE já fluem por `/api/nexo-lp/events/:sessionId`. O frontend precisa: (1) iniciar a geração uma única vez e escutar o SSE sem chamar generate novamente; (2) renderizar eventos reais como tool cards e mensagens; (3) buscar o preview real de `/api/nexo-lp/preview/:sessionId`; (4) baixar o HTML real e um ZIP real; (5) aplicar correções mínimas de segurança/estabilidade. Nada de refatoração grande — apenas conectar o que existe.

**Tech Stack:** Node.js/Express, Svelte 4, Vite, sql.js, EventSource, native fetch, adm-zip/archiver.

---

## Task 1: Corrigir dupla chamada a `/generate` e conectar SSE real

**Files:**
- Modify: `nexo-lp-web/src/api.js:107-115`
- Modify: `nexo-lp-web/src/lib/lpClient.js:93-152`

- [ ] **Step 1: Alterar `api.sendMessage` para NÃO chamar generate novamente no modo stream**

```javascript
// nexo-lp-web/src/api.js
export async function sendMessage(sessionId, message, stream = false) {
  if (stream) {
    // SSE apenas escuta eventos. A geração já deve ter sido iniciada pelo caller.
    return new EventSource(`${API_BASE}/events/${sessionId}`);
  }
  return generate(sessionId, message);
}
```

- [ ] **Step 2: Simplificar `LPClient.sendMessage` para chamar generate uma vez e depois abrir SSE**

```javascript
// nexo-lp-web/src/lib/lpClient.js
async sendMessage(message, streamCallback = null) {
  if (!this.isInitialized) await this.init();

  this.messageHistory.push({ role: 'user', content: message });
  if (this.sessionId) {
    api.addMessage(this.sessionId, { role: 'user', content: message, type: 'text' }).catch(console.error);
  }

  if (!streamCallback) {
    const response = await api.generate(this.sessionId, message);
    this._setContextFromResponse(response);
    const preview = await this._pollPreview();
    this.currentHtml = preview?.html || this.currentHtml;
    return { content: 'Generation complete', html: this.currentHtml };
  }

  // Inicia geração uma única vez, sem await, e abre SSE para escutar progresso
  api.generate(this.sessionId, message).catch((err) => {
    console.error('[LPClient] Background generation failed:', err);
    streamCallback({ type: 'error', error: err.message });
  });

  return new Promise((resolve, reject) => {
    const eventSource = api.sendMessage(this.sessionId, message, true);
    let fullContent = '';
    let completed = false;

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === 'action_start') {
          streamCallback({ type: 'tool_start', phase: data.phase, message: data.message });
        } else if (data.type === 'action_end') {
          streamCallback({ type: 'tool_end', phase: data.phase, message: data.message, completed: data.completed });
          if (data.phase === 'generation' && data.completed) {
            completed = true;
            eventSource.close();
            this._finalize(streamCallback).then(resolve).catch(reject);
          }
        } else if (data.type === 'thinking_start') {
          streamCallback({ type: 'thinking', status: 'start' });
        } else if (data.type === 'thinking_delta') {
          streamCallback({ type: 'thinking', status: 'delta', content: data.text });
        } else if (data.type === 'response_delta') {
          streamCallback({ type: 'response', content: data.text });
        } else if (data.type === 'action_detected') {
          streamCallback({ type: 'tool_action', action: data.action });
        }
      } catch (error) {
        // ignore non-JSON
      }
    };

    eventSource.onerror = () => {
      eventSource.close();
      if (!completed) this._finalize(streamCallback).then(resolve).catch(reject);
    };

    setTimeout(() => {
      if (!completed) {
        eventSource.close();
        this._finalize(streamCallback).then(resolve).catch(reject);
      }
    }, 300000);
  });
}
```

- [ ] **Step 3: Atualizar `_finalize` para buscar preview real e persistir mensagem do assistente**

```javascript
// nexo-lp-web/src/lib/lpClient.js
async _finalize(streamCallback) {
  try {
    const preview = await this._pollPreview();
    this.currentHtml = preview?.html || this.currentHtml;
    const content = 'I\'ve worked on your request! Check the Preview tab to see the result.';
    this.messageHistory.push({ role: 'assistant', content, type: 'text', metadata: { previewUrl: preview?.previewUrl } });
    if (this.sessionId) {
      api.addMessage(this.sessionId, { role: 'assistant', content, type: 'text', metadata: { previewUrl: preview?.previewUrl } }).catch(console.error);
    }
    streamCallback({ type: 'complete', html: this.currentHtml, content });
    return { content, html: this.currentHtml };
  } catch (error) {
    streamCallback({ type: 'complete', html: this.currentHtml, error: error.message });
    throw error;
  }
}
```

- [ ] **Step 4: Testar no navegador**

Abrir `http://localhost:5174`, enviar "faz um site sobre padaria" e verificar no Network do DevTools que só há **uma** chamada `POST /generate` e o SSE recebe eventos reais.

---

## Task 2: Fazer o preview renderizar o HTML real da sessão

**Files:**
- Modify: `nexo-lp-web/src/App.svelte:100-120`
- Modify: `nexo-lp-web/src/components/LPPreview.svelte:120-145`
- Modify: `nexo-lp-web/src/lib/previewBuilder.js`

- [ ] **Step 1: Garantir que `getPreview` retorna o HTML real do backend**

A rota `GET /preview/:sessionId` já existe. O frontend `api.getPreview` já chama ela. Verificar que `lpPreviewService.getPreview` busca o arquivo `data/previews/{sessionId}.html` e, se não existir, faz fallback no banco (corrigir await/colunas).

- [ ] **Step 2: Corrigir `lpPreviewService.getPreview` fallback do banco**

```javascript
// nexo-lp-server/services/lpPreviewService.js
const session = await SessionRepository.findById(sessionId);
if (session && session.current_html) {
  const assets = {
    css: session.generated_css || '',
    js: session.generated_js || '',
  };
  return this.savePreview(sessionId, session.current_html, assets);
}
```

- [ ] **Step 3: Ao carregar sessão, criar blob URL do HTML real**

```javascript
// nexo-lp-web/src/App.svelte
import { createBlobUrl } from './lib/previewBuilder.js';

async function loadSession(sessionId) {
  const s = await api.getSession(sessionId);
  if (s.current_html) {
    preview.set({
      html: s.current_html,
      blobUrl: createBlobUrl(s.current_html),
      lastUpdated: Date.now(),
      device: 'desktop',
    });
  }
}
```

- [ ] **Step 4: Fazer `LPPreview` recriar blob URL quando trocar de aba**

```svelte
<!-- nexo-lp-web/src/components/LPPreview.svelte -->
<script>
  import { createBlobUrl } from '../lib/previewBuilder.js';
  import { preview } from '../stores.js';

  $: if ($preview.html && !$preview.blobUrl) {
    preview.update((p) => ({ ...p, blobUrl: createBlobUrl(p.html) }));
  }
</script>
```

Remover revogação destrutiva no `onDestroy` ou recriar a URL reativamente.

- [ ] **Step 5: Testar**

Após a geração completar, a aba Preview deve mostrar o HTML real gerado pela Kimi (ex: site de padaria).

---

## Task 3: Implementar download real (HTML único + ZIP completo)

**Files:**
- Create: `nexo-lp-server/nexo-lp-routes.js` — add POST /preview/:sessionId/save-and-zip (ou reaproveitar /deploy/zip)
- Modify: `nexo-lp-web/src/components/LPDeployPanel.svelte:74-152`
- Modify: `nexo-lp-server/services/lpDeployService.js`

- [ ] **Step 1: Criar rota POST /preview/:sessionId para salvar HTML manualmente**

```javascript
// nexo-lp-server/nexo-lp-routes.js
router.post('/preview/:sessionId', asyncHandler(async (req, res) => {
  const { sessionId } = req.params;
  const { html, assets } = req.body;
  const preview = await lpPreviewService.savePreview(sessionId, html, assets || {});
  await SessionRepository.updateGeneratedCode(sessionId, { html, css: assets?.css || '', js: assets?.js || '' });
  res.status(200).json(successResponse(preview, 'Preview saved'));
}));
```

- [ ] **Step 2: Fazer `/deploy/zip` gerar ZIP real com o HTML da sessão**

```javascript
// nexo-lp-server/services/lpDeployService.js
async createZip(sessionId) {
  const session = await SessionRepository.findById(sessionId);
  if (!session || !session.current_html) {
    return { success: false, error: 'No generated HTML found' };
  }

  const zipDir = path.resolve(__dirname, '../../data/zips');
  if (!fs.existsSync(zipDir)) fs.mkdirSync(zipDir, { recursive: true });

  const zipPath = path.join(zipDir, `nexo-lp-${sessionId}.zip`);
  const output = fs.createWriteStream(zipPath);
  const archive = archiver('zip', { zlib: { level: 9 } });

  archive.pipe(output);
  archive.append(session.current_html, { name: 'index.html' });
  if (session.generated_css) archive.append(session.generated_css, { name: 'styles.css' });
  if (session.generated_js) archive.append(session.generated_js, { name: 'script.js' });
  await archive.finalize();

  return {
    success: true,
    downloadUrl: `/download/zips/nexo-lp-${sessionId}.zip`,
    filename: `nexo-lp-${sessionId}.zip`,
  };
}
```

- [ ] **Step 3: Restringir rota /download a /download/zips**

```javascript
// nexo-lp-server/nexo-lp-server.js
app.use('/download/zips', express.static(path.resolve(__dirname, '../data/zips')));
```

Remover ou restringir `app.use('/download', express.static(.../data))`.

- [ ] **Step 4: Atualizar LPDeployPanel para usar backend real**

```svelte
<!-- nexo-lp-web/src/components/LPDeployPanel.svelte -->
<script>
  async function downloadHtml() {
    const preview = await lpClient.getPreview();
    const html = preview?.html || lpClient.getHtml();
    if (!html) return;
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'landing-page.html';
    a.click();
    URL.revokeObjectURL(url);
  }

  async function downloadZip() {
    const result = await lpClient.deploy('zip');
    if (result?.downloadUrl) {
      window.location.href = `${API_BASE.replace('/api/nexo-lp', '')}${result.downloadUrl}`;
    }
  }
</script>
```

- [ ] **Step 5: Testar download**

Após gerar um site, clicar em "Download HTML" deve baixar o HTML real. Clicar em "Download ZIP" deve baixar um ZIP contendo `index.html`.

---

## Task 4: Renderizar tool cards e mensagens de progresso reais no chat

**Files:**
- Modify: `nexo-lp-web/src/components/LPChatArea.svelte:120-180`
- Modify: `nexo-lp-web/src/stores.js`

- [ ] **Step 1: Criar store para eventos de progresso**

```javascript
// nexo-lp-web/src/stores.js
import { writable } from 'svelte/store';
export const generationEvents = writable([]);
```

- [ ] **Step 2: No LPClient, popular a store de eventos**

```javascript
// nexo-lp-web/src/lib/lpClient.js
import { generationEvents } from '../stores.js';

// dentro do onmessage:
if (data.type === 'action_start') {
  generationEvents.update((events) => [...events, { id: Date.now(), phase: data.phase, message: data.message, status: 'running' }]);
  streamCallback({ type: 'tool_start', ... });
} else if (data.type === 'action_end') {
  generationEvents.update((events) =>
    events.map((e) => (e.phase === data.phase && e.status === 'running' ? { ...e, status: 'done' } : e))
  );
}
```

- [ ] **Step 3: Renderizar tool cards no LPChatArea**

```svelte
<!-- nexo-lp-web/src/components/LPChatArea.svelte -->
{#each $generationEvents as event}
  <div class="tool-card {event.status}">
    <span class="phase">{event.phase}</span>
    <span class="message">{event.message}</span>
    <span class="status">{event.status}</span>
  </div>
{/each}
```

- [ ] **Step 4: Limpar eventos ao iniciar nova geração**

```javascript
// no início de sendMessage
generationEvents.set([]);
```

- [ ] **Step 5: Testar**

Enviar mensagem e ver tool cards aparecendo em tempo real: "Analyzing your requirements...", "Generating code...", "Preview ready", etc.

---

## Task 5: Fixes críticos de segurança/estabilidade mínimos

**Files:**
- Modify: `nexo-lp-server/nexo-lp-server.js:158`
- Modify: `nexo-lp-server/services/lpPreviewService.js:37-48`
- Modify: `nexo-lp-server/services/lpDeployService.js:209-210`
- Modify: `package.json`
- Modify: `nexo-lp-server/services/lpTemplateService.js:115,129,137,224`
- Modify: `nexo-lp-server/services/lpBugDetectorService.js:42`

- [ ] **Step 1: Restringir /download a /download/zips**

```javascript
// nexo-lp-server/nexo-lp-server.js
app.use('/download/zips', express.static(path.resolve(__dirname, '../data/zips')));
```

- [ ] **Step 2: Sanitizar sessionId em paths**

```javascript
// helper em lpPreviewService.js e lpDeployService.js
function sanitizeSessionId(id) {
  if (!id || typeof id !== 'string') throw new Error('Invalid session id');
  const safe = id.replace(/[^a-zA-Z0-9_-]/g, '');
  if (!safe || safe.length > 128) throw new Error('Invalid session id');
  return safe;
}
```

Usar em `getPreviewFilePath`, `savePreview`, `createZip`.

- [ ] **Step 3: Mover dotenv para dependencies**

```json
// package.json
"dependencies": {
  "dotenv": "^17.4.2",
  ...
}
```

Remover de `devDependencies`.

- [ ] **Step 4: Adicionar await faltantes em lpTemplateService**

```javascript
const session = await SessionRepository.create({ ... });
if (template.html) {
  await SessionRepository.updateGeneratedCode(session.id, { html: template.html, css: '', js: '' });
}
await this.repository.incrementUsage(templateId);
```

- [ ] **Step 5: Corrigir await em lpBugDetectorService**

```javascript
const session = await SessionRepository.findById(sessionId);
const html = providedHtml || session?.current_html;
```

- [ ] **Step 6: Rodar smoke tests**

```bash
curl http://localhost:3460/api/nexo-lp/health
curl -I http://localhost:3460/download/zips/test.zip # 404, não vaza data
curl -I http://localhost:3460/download/nexo-lp.db # 404
```

---

## Task 6: Teste end-to-end real com Kimi Web

**Files:**
- N/A — teste manual

- [ ] **Step 1: Subir servidor**

```bash
cd /home/jhin/luna/nexo-lp-creator
node nexo-lp-server/nexo-lp-server.js
```

- [ ] **Step 2: Abrir frontend**

```bash
cd nexo-lp-web && npm run dev
```

Acessar `http://localhost:5174`.

- [ ] **Step 3: Enviar prompt real**

"Faz um site sobre padaria".

Verificar:
- Uma única chamada `POST /generate`
- SSE recebe eventos reais
- Tool cards aparecem
- Preview mostra site de padaria real
- Download HTML baixa o HTML real
- Download ZIP baixa ZIP com index.html
- Mensagem final: "I've worked on your request! Check the Preview tab to see the result."

- [ ] **Step 4: Verificar que o HTML não é o template mockado**

Abrir o HTML baixado e confirmar que contém conteúdo sobre padaria, não conteúdo genérico NEXO/SaaS.

---

## Notas de Escopo

- **Stacks Vite/Next.js:** fora deste plano. Primeiro fazemos HTML estático real funcionar perfeitamente. Depois discutimos geração de projetos multi-arquivo.
- **Refatoração:** mínima. Apenas conectar pontos e corrigir bugs críticos.
- **Segurança avançada:** sandbox/whitelist são real e funcionam, mas não estão integrados. Não vamos integrá-los agora; apenas proteger os endpoints públicos críticos.
