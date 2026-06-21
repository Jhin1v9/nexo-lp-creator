const http = require('http');
const readline = require('readline');

const base = 'http://127.0.0.1:3460/api/nexo-lp';
const userId = 'test-user-realgen-' + Date.now();
const prompt = 'Landing page para uma cafeteria artesanal chamada Grão Nobre, escura e sofisticada, com hero, menu, depoimentos e localização.';

function post(path, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = http.request(base + path, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } }, (res) => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => { try { resolve({ status: res.statusCode, body: JSON.parse(raw) }); } catch(e){ resolve({ status: res.statusCode, body: raw }); } });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

(async () => {
  const sess = await post('/sessions', { userId, initialPrompt: prompt, stack: 'react-tailwind' });
  console.log('SESSION', sess.status, JSON.stringify(sess.body, null, 2));
  if (sess.status !== 201) return;
  const sessionId = sess.body.data.sessionId;
  const gen = await post('/generate', { sessionId, prompt, stack: 'react-tailwind', options: { mode: 'stars' } });
  console.log('GENERATE', gen.status, JSON.stringify(gen.body, null, 2));

  // Listen SSE for 5 minutes
  const sse = http.request(base + '/events/' + sessionId, { method: 'GET' }, (res) => {
    console.log('SSE status', res.statusCode);
    const rl = readline.createInterface({ input: res });
    rl.on('line', (line) => {
      if (!line.trim()) return;
      console.log('SSE:', line.slice(0, 500));
    });
    rl.on('close', () => console.log('SSE closed'));
  });
  sse.on('error', e => console.error('SSE error', e));
  sse.end();

  setTimeout(async () => {
    http.get(base + '/preview/' + sessionId, (res) => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => { console.log('PREVIEW status', res.statusCode, raw.slice(0,500)); process.exit(0); });
    });
  }, 300000);
})();
