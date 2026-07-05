#!/usr/bin/env node
const crypto = require('crypto');

function generateKey(length = 64) {
  return crypto.randomBytes(length / 2).toString('hex');
}

const keys = {
  ADMIN_SECRET: generateKey(),
  NEXO_STORE_ADMIN_KEY: generateKey(),
  ADMIN_API_KEY: generateKey(),
};

console.log('=== Generated admin keys (64 hex chars each) ===');
console.log('');
console.log('# LP Creator');
console.log(`ADMIN_SECRET=${keys.ADMIN_SECRET}`);
console.log(`NEXO_STORE_ADMIN_KEY=${keys.NEXO_STORE_ADMIN_KEY}`);
console.log('');
console.log('# Nexo Digital Store');
console.log(`ADMIN_API_KEY=${keys.ADMIN_API_KEY}`);
