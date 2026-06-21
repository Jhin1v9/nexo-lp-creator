const http = require('http');
const readline = require('readline');
const sessionId = process.argv[2];
const base = 'http://127.0.0.1:3460/api/nexo-lp';
const start = Date.now();
let lastEvent = start;
const timeout = parseInt(process.argv[3] || '300000', 10);
const events = [];

const sse = http.request(base + '/events/' + sessionId, { method: 'GET' }, (res) => {
  console.log('SSE status', res.statusCode);
  const rl = readline.createInterface({ input: res });
  rl.on('line', (line) => {
    if (!line.trim()) return;
    lastEvent = Date.now();
    console.log(line.slice(0, 1000));
    events.push(line);
    if (line.includes('completed') || line.includes('failed') || line.includes('error')) {
      console.log('Terminal event detected, waiting 5s then exiting');
      setTimeout(() => process.exit(0), 5000);
    }
  });
  rl.on('close', () => { console.log('SSE closed'); process.exit(0); });
});
sse.on('error', e => { console.error('SSE error', e); process.exit(1); });
sse.end();

setInterval(() => {
  if (Date.now() - start > timeout) {
    console.log('Overall timeout reached');
    process.exit(0);
  }
}, 5000);
