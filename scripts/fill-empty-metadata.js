#!/usr/bin/env node
process.env.NODE_ENV = process.env.NODE_ENV || 'production';

const { initializeDatabase, closeDatabase, query } = require('../nexo-lp-server/models/sqlite');
const SessionRepository = require('../nexo-lp-server/models/repositories/SessionRepository');
const TemplateRepository = require('../nexo-lp-server/models/repositories/TemplateRepository');
const BridgeAdapter = require('../nexo-lp-server/services/lpBridgeAdapter.cjs');
const { sanitizeMetadataPrompt } = require('../nexo-lp-server/services/prompts/nexoPromptPack');

const KIMI_DELAY_MS = 5000;

function findFirstJsonObject(text) {
  for (let i = 0; i < text.length; i++) {
    if (text[i] !== '{') continue;
    let depth = 0;
    for (let j = i; j < text.length; j++) {
      if (text[j] === '{') depth++;
      else if (text[j] === '}') depth--;
      if (depth === 0) {
        const candidate = text.slice(i, j + 1);
        try {
          const parsed = JSON.parse(candidate);
          if (parsed && typeof parsed === 'object') return parsed;
        } catch {
          // continue searching
        }
        break;
      }
    }
  }
  return null;
}

function parseMetadata(text) {
  if (!text) return {};
  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const payload = codeBlockMatch ? codeBlockMatch[1] : text;
  const parsed = findFirstJsonObject(payload);
  if (!parsed) return {};
  if (parsed.metadata && typeof parsed.metadata === 'object') return parsed.metadata;
  if (parsed.category || Array.isArray(parsed.tags) || parsed.niche) return parsed;
  return {};
}

function normalizeCategory(input) {
  const allowed = ['business', 'startup', 'portfolio', 'ecommerce', 'saas', 'agency', 'personal', 'event', 'landing', 'other'];
  const normalized = String(input || 'landing').toLowerCase().trim();
  if (allowed.includes(normalized)) return normalized;
  if (normalized.includes('saas')) return 'saas';
  if (normalized.includes('agency')) return 'agency';
  if (normalized.includes('restaurant') || normalized.includes('food') || normalized.includes('service')) return 'business';
  if (normalized.includes('shop') || normalized.includes('store') || normalized.includes('ecommerce') || normalized.includes('e-commerce')) return 'ecommerce';
  if (normalized.includes('portfolio')) return 'portfolio';
  if (normalized.includes('event')) return 'event';
  if (normalized.includes('personal')) return 'personal';
  if (normalized.includes('startup')) return 'startup';
  return 'landing';
}

function normalizeMetadata(metadata = {}) {
  const category = normalizeCategory(metadata.category);
  return {
    category,
    subcategory: metadata.subcategory || category,
    tags: Array.isArray(metadata.tags) ? metadata.tags : [],
    niche: metadata.niche || '',
    audience: metadata.audience || '',
    difficulty: metadata.difficulty || 'beginner',
    features: Array.isArray(metadata.features) ? metadata.features : [],
    colors: Array.isArray(metadata.colors) ? metadata.colors : [],
    style: metadata.style || '',
    seoKeywords: Array.isArray(metadata.seoKeywords) ? metadata.seoKeywords : [],
    badges: Array.isArray(metadata.badges) ? metadata.badges : [],
    whyBuy: metadata.whyBuy || '',
    useCases: Array.isArray(metadata.useCases) ? metadata.useCases : [],
  };
}

async function main() {
  await initializeDatabase();

  const rows = await query(`
    SELECT id, session_id, html, metadata_json
    FROM templates
    WHERE status IN ('available', 'reviewed')
      AND (metadata_json IS NULL OR metadata_json = '{}' OR metadata_json LIKE '%"tags":[]%')
  `);

  console.log(`Found ${rows.length} templates with empty metadata`);

  if (rows.length === 0) {
    closeDatabase();
    console.log('Nothing to do.');
    process.exit(0);
  }

  const context = BridgeAdapter.initializeContext('metadata-fill-batch', { userId: 'metadata-fill-batch' });
  const failed = [];

  try {
    for (let i = 0; i < rows.length; i += 1) {
      const tpl = rows[i];
      const prefix = `[${i + 1}/${rows.length}] ${tpl.id}`;
      console.log(`\n${prefix} Starting metadata extraction`);

      const session = await SessionRepository.findById(tpl.session_id);
      const html = tpl.html || session?.current_html || '';
      if (!html) {
        console.warn(`${prefix} No HTML, skipping`);
        continue;
      }

      try {
        if (i > 0) {
          await new Promise((r) => setTimeout(r, KIMI_DELAY_MS));
        }

        const result = await BridgeAdapter.sendMessage(context, sanitizeMetadataPrompt(html), {
          mode: 'thinking',
          phase: 'metadata',
          newChat: true,
          requiredHtmlClose: false,
        });

        const metadata = normalizeMetadata(parseMetadata(result.content));
        console.log(`${prefix} Metadata: ${JSON.stringify(metadata).substring(0, 200)}`);

        if (metadata.tags.length === 0) {
          console.warn(`${prefix} Metadata came back empty — raw snippet: ${result.content.substring(0, 120)}`);
          failed.push({ id: tpl.id, error: 'Empty metadata' });
          continue;
        }

        await TemplateRepository.update(tpl.id, {
          category: metadata.category,
          subcategory: metadata.subcategory,
          tags: metadata.tags.join(','),
          metadata_json: JSON.stringify(metadata),
        });
        console.log(`${prefix} Saved`);
      } catch (err) {
        console.error(`⚠️  ${prefix} ERROR: ${err.message}`);
        failed.push({ id: tpl.id, error: err.message });
      }
    }
  } finally {
    if (context?.userId) {
      await BridgeAdapter.closeUserPage(context.userId).catch(() => {});
    }
  }

  closeDatabase();

  if (failed.length > 0) {
    console.error('\n⚠️  FAILED TEMPLATES (need retry):');
    failed.forEach((f) => console.error(`  - ${f.id}: ${f.error}`));
    process.exit(1);
  }

  console.log('\nDone: all metadata filled');
  process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });
