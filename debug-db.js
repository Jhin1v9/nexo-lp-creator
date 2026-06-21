const path = require('path');
const Database = require('better-sqlite3');

const dbPath = process.env.NEXO_LP_DB_PATH || path.resolve(__dirname, 'data/nexo-lp.db');
const db = new Database(dbPath);

const row = db.prepare("SELECT id, status, length(current_html) as html_len, substr(current_html,1,200) as html_start, kimi_chat_url FROM sessions WHERE id='sess-1781946443659-grxwlp'").get();
console.log(JSON.stringify(row, null, 2));

db.close();
