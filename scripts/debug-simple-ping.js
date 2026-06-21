#!/usr/bin/env node
process.env.NODE_ENV = process.env.NODE_ENV || 'production';
const BridgeAdapter = require('../nexo-lp-server/services/lpBridgeAdapter.cjs');

async function main() {
  const context = BridgeAdapter.initializeContext('ping-session');
  console.log('Sending simple ping...');
  const result = await BridgeAdapter.sendMessage(context, 'Responda apenas "pong".', { mode: 'instant', phase: 'ping' });
  console.log('Result length:', result.content.length);
  console.log('Content:', result.content.slice(0, 200));
  process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });
