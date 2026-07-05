#!/usr/bin/env node
const https = require('https');

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_GROUP_CHAT_ID;

if (!TOKEN || !CHAT_ID) {
  console.error('Missing TELEGRAM_BOT_TOKEN or TELEGRAM_GROUP_CHAT_ID');
  process.exit(1);
}

const message = process.argv[2] || process.env.TELEGRAM_MESSAGE;
if (!message) {
  console.error('Provide message as first argument or TELEGRAM_MESSAGE env');
  process.exit(1);
}

function escapeMarkdown(text) {
  return text.replace(/([_\*\[\]\(\)~`>#+\-=|{}.!])/g, '\\$1');
}

const payload = JSON.stringify({
  chat_id: CHAT_ID,
  text: escapeMarkdown(message),
  parse_mode: 'MarkdownV2',
});

const req = https.request(
  `https://api.telegram.org/bot${TOKEN}/sendMessage`,
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload),
    },
  },
  (res) => {
    let data = '';
    res.on('data', (c) => (data += c));
    res.on('end', () => {
      const json = JSON.parse(data);
      if (!json.ok) {
        console.error('Telegram API error:', json);
        process.exit(1);
      }
      console.log('Report sent. message_id:', json.result.message_id);
    });
  }
);

req.on('error', (err) => {
  console.error('Request failed:', err.message);
  process.exit(1);
});

req.write(payload);
req.end();
