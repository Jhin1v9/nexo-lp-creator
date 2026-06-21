const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');

const API = 'http://localhost:3460/api/nexo-lp';
const USER_ID = `test-e2e-${Date.now()}`;
const PROMPT = 'Landing page para uma consultoria de IA chamada NeuralMind. Estilo moderno, escuro, com hero animado, seções de serviços, cases de clientes, preços, FAQ e footer. Tailwind, multi-página, pronto para conversão.';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function api(method, endpoint, body) {
  const res = await fetch(`${API}${endpoint}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  try { return JSON.parse(text); } catch { return { raw: text }; }
}

async function waitForSession(sessionId, timeoutMs = 600000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const data = await api('GET', `/sessions/${sessionId}`);
    const status = data?.data?.status || data?.status;
    console.log(`[wait] status=${status} elapsed=${Math.round((Date.now() - start) / 1000)}s`);
    if (status === 'completed' || status === 'done' || status === 'published' || status === 'error' || status === 'failed') {
      return data.data;
    }
    await sleep(10000);
  }
  throw new Error('Timeout waiting for session');
}

async function main() {
  console.log('1. Creating session...');
  const createRes = await api('POST', '/sessions', {
    userId: USER_ID,
    initialPrompt: PROMPT,
    stack: 'static-html-tailwind',
  });
  if (!createRes.success) throw new Error(JSON.stringify(createRes));
  const session = createRes.data;
  console.log('Session:', session.id, session.status);

  console.log('2. Starting generation...');
  const genRes = await api('POST', '/generate', {
    sessionId: session.id,
    prompt: PROMPT,
    stack: 'static-html-tailwind',
    options: { mode: 'stars' },
  });
  if (!genRes.success) throw new Error(JSON.stringify(genRes));
  console.log('Generation started:', genRes.data);

  console.log('3. Waiting for generation to complete...');
  const finalSession = await waitForSession(session.id);
  console.log('Final session status:', finalSession.status);

  console.log('4. Fetching preview HTML...');
  const previewRes = await fetch(`${API}/preview/${session.id}`);
  const previewHtml = await previewRes.text();
  const outDir = path.join(__dirname, '..', 'tmp');
  fs.mkdirSync(outDir, { recursive: true });
  const previewPath = path.join(outDir, `e2e-preview-${session.id}.html`);
  fs.writeFileSync(previewPath, previewHtml);
  console.log('Preview saved:', previewPath, 'length:', previewHtml.length);

  console.log('5. Publishing to LOJA...');
  const publishRes = await api('POST', `/sessions/${session.id}/publish`, {
    isPublic: true,
    priceStars: 5,
    priceSuns: 0,
    priceMoons: 0,
  });
  console.log('Publish result:', JSON.stringify(publishRes, null, 2));

  if (publishRes.success && publishRes.data?.templateId) {
    const tplRes = await api('GET', `/templates/${publishRes.data.templateId}`);
    console.log('Template:', JSON.stringify(tplRes.data, null, 2));
  }

  console.log('6. Done. Evaluate the preview at:', previewPath);
}

main().catch((err) => { console.error(err); process.exit(1); });
