#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
process.env.NODE_ENV = process.env.NODE_ENV || 'production';

const { initializeDatabase, closeDatabase, query } = require('../nexo-lp-server/models/sqlite');
const BridgeAdapter = require('../nexo-lp-server/services/lpBridgeAdapter.cjs');
const { sanitizePrompt } = require('../nexo-lp-server/services/prompts/nexoPromptPack');

function extractHtml(text) {
  if (!text) return '';
  const fenceMatch = text.match(/```(?:html)?\s*([\s\S]*?)```/i);
  if (fenceMatch) return fenceMatch[1].trim();
  const trimmed = text.trim();
  const docMatch = trimmed.match(/(<!DOCTYPE\s+html[\s\S]*<\/html>)/i);
  if (docMatch) return docMatch[1].trim();
  const htmlMatch = trimmed.match(/(<html[\s\S]*<\/html>)/i);
  if (htmlMatch) return htmlMatch[1].trim();
  const lower = trimmed.toLowerCase();
  const htmlCloseIdx = lower.lastIndexOf('</html>');
  if (htmlCloseIdx !== -1) {
    const startIdx = lower.indexOf('<!doctype html>');
    return trimmed.slice(startIdx >= 0 ? startIdx : 0, htmlCloseIdx + 7).trim();
  }
  const blockMatch = trimmed.match(/(<(?:section|div|header|footer|nav|main|body|head)[\s\S]*)/i);
  if (blockMatch) return blockMatch[1].trim();
  return trimmed;
}

async function main() {
  await initializeDatabase();
  const rows = await query("SELECT id, html FROM templates WHERE id='tpl-1781734622996-357byi'");
  const tpl = rows[0];
  const prompt = sanitizePrompt(tpl.html);
  const context = BridgeAdapter.initializeContext('debug-session');
  const outDir = path.join(__dirname, '..', 'tmp');
  fs.mkdirSync(outDir, { recursive: true });
  console.log('Prompt length:', prompt.length);
  console.log('Original HTML length:', tpl.html.length);
  console.log('Sending to Kimi...');
  const result = await BridgeAdapter.sendMessage(context, prompt, { mode: 'instant', phase: 'sanitize' });
  const extracted = extractHtml(result.content);
  fs.writeFileSync(path.join(outDir, 'sanitize-raw-response.html'), result.content);
  fs.writeFileSync(path.join(outDir, 'sanitize-extracted.html'), extracted);
  console.log('Raw response length:', result.content.length);
  console.log('Extracted length:', extracted.length);
  console.log('Ends with </html>:', extracted.toLowerCase().trim().endsWith('</html>'));
  console.log('Contains </html>:', extracted.toLowerCase().includes('</html>'));
  console.log('Last 200 chars:', extracted.slice(-200));
  closeDatabase();
  process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });
