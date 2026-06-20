#!/usr/bin/env node
/**
 * Enriches published LOJA templates with locally-inferred metadata
 * (title, description, category, subcategory, tags, features).
 *
 * Does NOT use Kimi/Chrome. Reads each template's HTML, extracts the
 * <title> and <meta name="description">, and infers the rest from content.
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const API_BASE = process.env.NEXO_LP_API_URL || 'http://localhost:3460/api/nexo-lp';

async function apiGet(url) {
  const res = await fetch(`${API_BASE}${url}`);
  const json = await res.json();
  if (!json.success) {
    throw new Error(json.error?.message || `GET ${url} failed`);
  }
  return json.data;
}

async function apiPost(url, body) {
  const res = await fetch(`${API_BASE}${url}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {}),
  });
  const json = await res.json();
  if (!json.success) {
    throw new Error(json.error?.message || `POST ${url} failed`);
  }
  return json.data;
}

async function main() {
  const data = await apiGet('/templates?limit=200');
  const templates = (data.templates || []).filter(
    (t) => (t.status === 'available' || t.status === 'unreviewed') && t.is_public >= 1
  );
  console.log(`[ENRICH] Found ${templates.length} public templates (available + unreviewed)`);

  let ok = 0;
  for (let i = 0; i < templates.length; i++) {
    const t = templates[i];
    try {
      const enriched = await apiPost(`/templates/${t.id}/enrich-local`);
      console.log(`[${i + 1}/${templates.length}] ${t.id} -> ${enriched.name.slice(0, 60)} (${enriched.category})`);
      ok += 1;
    } catch (err) {
      console.error(`[${i + 1}/${templates.length}] ${t.id} FAILED: ${err.message}`);
    }
  }

  console.log(`[ENRICH] Done: ${ok}/${templates.length} templates enriched`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('[ENRICH] Fatal error:', err.message);
    process.exit(1);
  });
