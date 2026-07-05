/**
 * NEXO Landing Page Creator v3.0 - LP Creator → Nexo Store Bridge
 *
 * Synchronizes LP Creator templates into the Nexo Store catalog.
 * Each template becomes an AppProduct with the same id and a unique slug.
 *
 * @module services/lpStoreBridgeService
 * @version 3.0.0
 */

const crypto = require('crypto');
const fetch = require('node-fetch');
const TemplateRepository = require('../models/repositories/TemplateRepository');

const DEFAULT_RETRY_ATTEMPTS = 3;
const DEFAULT_RETRY_BASE_MS = 1000;

const ALLOWED_CATEGORIES = [
  'business', 'startup', 'portfolio', 'ecommerce', 'saas',
  'agency', 'personal', 'event', 'landing', 'other',
];

/**
 * Convert a display name into a URL-safe slug segment.
 * @param {string} name
 * @returns {string}
 */
function slugify(name) {
  return String(name || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Generate a short, deterministic hash from the template id so duplicate
 * names (e.g. "Padaria Artesanal") never collide in the Store.
 * @param {string} id
 * @returns {string}
 */
function shortHash(id) {
  return crypto
    .createHash('sha256')
    .update(String(id))
    .digest('hex')
    .slice(0, 8);
}

function buildUniqueSlug(name, id) {
  return `${slugify(name)}-template-${shortHash(id)}`;
}

function parseTags(tags) {
  if (!tags) return [];
  return String(tags)
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);
}

function parseMetadata(json) {
  if (!json) return undefined;
  if (typeof json === 'object') return json;
  try {
    return JSON.parse(json);
  } catch {
    return undefined;
  }
}

function normalizeCategory(category) {
  const c = String(category || 'landing').toLowerCase().trim();
  if (ALLOWED_CATEGORIES.includes(c)) return c;
  if (c.includes('saas')) return 'saas';
  if (c.includes('agency')) return 'agency';
  if (c.includes('shop') || c.includes('store') || c.includes('ecommerce') || c.includes('e-commerce')) return 'ecommerce';
  if (c.includes('portfolio')) return 'portfolio';
  if (c.includes('event')) return 'event';
  if (c.includes('personal')) return 'personal';
  if (c.includes('startup')) return 'startup';
  if (c.includes('business') || c.includes('service') || c.includes('restaurant') || c.includes('food')) return 'business';
  return 'other';
}

function inferAppType(category) {
  const c = String(category || '').toLowerCase();
  if (c === 'saas') return 'saas';
  if (c === 'ecommerce' || c === 'business') return 'site';
  if (['portfolio', 'landing', 'agency', 'startup', 'event', 'personal'].includes(c)) return 'site';
  return 'site';
}

function inferFramework(stack) {
  const s = String(stack || '').toLowerCase();
  if (s.includes('nextjs') || s.includes('next.js')) return 'nextjs';
  if (s.includes('react')) return 'react';
  if (s.includes('flutter')) return 'flutter';
  if (s.includes('node')) return 'node';
  if (s.includes('php')) return 'php';
  if (s.includes('python')) return 'python';
  if (s.includes('swift')) return 'swift';
  if (s.includes('kotlin')) return 'kotlin';
  return 'other';
}

function inferIndustry(category, subcategory, metadata) {
  const text = `${category || ''} ${subcategory || ''} ${metadata?.niche || ''}`.toLowerCase();
  if (text.includes('restaurant') || text.includes('food') || text.includes('cafe') || text.includes('coffee') || text.includes('bakery') || text.includes('gelato') || text.includes('pizza')) return 'food';
  if (text.includes('clinic') || text.includes('health') || text.includes('medical') || text.includes('dental') || text.includes('fisioterapia') || text.includes('farmacia') || text.includes('beauty') || text.includes('academia')) return 'health';
  if (text.includes('shop') || text.includes('store') || text.includes('retail') || text.includes('boutique') || text.includes('ecommerce') || text.includes('moda') || text.includes('brinquedo')) return 'retail';
  if (text.includes('construction') || text.includes('construcao') || text.includes('obra') || text.includes('reforma')) return 'construction';
  if (text.includes('education') || text.includes('course') || text.includes('school') || text.includes('curso') || text.includes('escola')) return 'education';
  if (text.includes('finance') || text.includes('fintech') || text.includes('billing') || text.includes('faturacao')) return 'finance';
  if (text.includes('entertainment') || text.includes('game') || text.includes('jogo')) return 'entertainment';
  return 'other';
}

function inferSense(subcategory, metadata) {
  const text = `${subcategory || ''} ${metadata?.niche || ''}`.toLowerCase();
  if (text.includes('sorvet') || text.includes('gelato') || text.includes('ice cream')) return 'sorveteria';
  if (text.includes('barbearia') || text.includes('barber')) return 'barbearia';
  if (text.includes('clinic') || text.includes('clinica') || text.includes('health') || text.includes('dental') || text.includes('medical') || text.includes('fisioterapia') || text.includes('farmacia') || text.includes('beauty')) return 'clinica';
  if (text.includes('restaurant') || text.includes('restaurante') || text.includes('cafeteria') || text.includes('lanchonete') || text.includes('hamburgueria') || text.includes('pizza') || text.includes('food')) return 'restaurante';
  if (text.includes('shop') || text.includes('store') || text.includes('loja') || text.includes('boutique') || text.includes('ecommerce') || text.includes('moda')) return 'loja';
  if (text.includes('office') || text.includes('escritorio') || text.includes('advogado') || text.includes('agency') || text.includes('agencia')) return 'escritorio';
  return 'outro';
}

function normalizeStatus(status) {
  switch (String(status || '').toLowerCase()) {
    case 'available':
    case 'approved':
      return 'available';
    case 'beta':
      return 'beta';
    case 'coming_soon':
    case 'unreviewed':
    case 'sanitizing':
      return 'coming_soon';
    case 'deprecated':
    case 'rejected':
    case 'failed':
      return 'deprecated';
    default:
      return 'available';
  }
}

function normalizeSource(source) {
  if (source === 'manual' || source === 'generated' || source === 'mined') return source;
  return 'manual';
}

function buildVirtualPrice(template) {
  const hasPrice =
    template.price_stars != null ||
    template.price_suns != null ||
    template.price_moons != null;
  if (!hasPrice) return undefined;
  return {
    stars: template.price_stars ?? 0,
    suns: template.price_suns ?? 0,
    moons: template.price_moons ?? 0,
  };
}

function buildOriginalVirtualPrice(template) {
  const hasOriginal =
    template.original_price_stars != null ||
    template.original_price_suns != null ||
    template.original_price_moons != null;
  if (!hasOriginal) return undefined;
  return {
    stars: template.original_price_stars ?? 0,
    suns: template.original_price_suns ?? 0,
    moons: template.original_price_moons ?? 0,
  };
}

function resolveHtml(template) {
  const status = String(template.status || '').toLowerCase();
  if (status === 'approved' && template.sanitized_html) {
    return template.sanitized_html;
  }
  return template.html || template.original_html || '';
}

function resolveDemoUrl(template, slug) {
  const base = (process.env.PREVIEW_BASE_URL || '').replace(/\/+$/, '');
  if (template.public_preview_token) {
    const path = `/preview/public/${template.public_preview_token}.html`;
    return base ? `${base}${path}` : path;
  }
  const path = `/demo/${slug}`;
  return base ? `${base}${path}` : path;
}

function resolveAssetUrl(url) {
  if (!url) return undefined;
  if (/^https?:\/\//i.test(url)) return url;
  const base = (process.env.PREVIEW_BASE_URL || '').replace(/\/+$/, '');
  const path = url.startsWith('/') ? url : `/${url}`;
  return base ? `${base}${path}` : url;
}

/**
 * Convert a raw LP Creator template row into the AppProduct shape expected
 * by the Nexo Store admin API.
 * @param {object} template
 * @returns {object}
 */
function adaptLPCTemplateToAppProduct(template, options = {}) {
  const { direct = false } = options;
  const metadata = parseMetadata(template.metadata_json);
  const category = normalizeCategory(template.category);
  const subcategory = template.subcategory || metadata?.subcategory || category;
  const type = inferAppType(template.category);
  const framework = inferFramework(template.stack);
  const industry = inferIndustry(template.category, subcategory, metadata);
  const sense = inferSense(subcategory, metadata);
  const status = direct ? 'available' : normalizeStatus(template.status);
  const source = normalizeSource(template.source);
  const slug = buildUniqueSlug(template.name, template.id);

  const tags = [...new Set([...parseTags(template.tags), ...(metadata?.tags || [])])];
  const keywords = [...new Set([
    template.name,
    ...(metadata?.seoKeywords || []),
    category,
    subcategory,
  ].filter(Boolean))];

  const now = new Date().toISOString().split('T')[0];
  const releaseDate = template.created_at ? template.created_at.split('T')[0] : now;
  const lastUpdate = template.updated_at ? template.updated_at.split('T')[0] : releaseDate;

  const virtualPrice = buildVirtualPrice(template);
  const originalVirtualPrice = buildOriginalVirtualPrice(template);
  const activeHtml = resolveHtml(template);

  return {
    id: template.id,
    slug,
    name: template.name,
    subtitle: metadata?.useCases?.[0] || template.description?.slice(0, 80) || '',
    description: template.description || '',
    shortDescription: template.description?.slice(0, 120) || '',
    icon: resolveAssetUrl(template.thumbnail_url) || `/icons/${slug}.svg`,
    thumbnail: resolveAssetUrl(template.thumbnail_url) || `/thumbnails/${slug}.jpg`,
    screenshots: template.thumbnail_url ? [resolveAssetUrl(template.thumbnail_url)] : ['/screenshot-placeholder.jpg'],
    type,
    framework,
    industry,
    sense,
    status,
    version: '1.0.0',
    releaseDate,
    lastUpdate,
    hasDemo: Boolean(template.public_preview_token),
    demoUrl: resolveDemoUrl(template, slug),
    repoUrl: undefined,
    requestUrl: `/request?template=${slug}`,
    pricing: virtualPrice ? 'fixed' : 'free',
    price: virtualPrice ? 0 : undefined,
    currency: 'EUR',
    rating: template.rating ?? 0,
    reviewCount: 0,
    downloadCount: template.usage_count || template.uses || 0,
    developer: template.created_by || 'NEXO Community',
    techStack: template.stack ? template.stack.split('-').map((s) => s.trim()) : [],
    features: metadata?.features || [],
    requirements: ['Navegador moderno', 'Conexão internet'],
    metaTitle: `${template.name} — Template | NEXO Store`,
    metaDescription: template.description?.slice(0, 160) || '',
    keywords,
    tags,
    category,
    subcategory,
    stack: template.stack,
    source,
    html: activeHtml,
    css: template.css,
    js: template.js,
    config: template.config,
    virtualPrice,
    originalVirtualPrice,
    originalHtml: template.original_html,
    sanitizedHtml: template.sanitized_html,
    sanitizationLog: template.sanitization_log,
    publicPreviewToken: template.public_preview_token,
    promptHash: template.prompt_hash,
    promptCensored: template.prompt_censored,
    sessionId: template.session_id,
    kimiChatUrl: template.kimi_chat_url,
    reviewedAt: template.reviewed_at,
    unreviewedReason: template.unreviewed_reason,
    metadata,
  };
}

class LPStoreBridgeService {
  _getStoreUrl() {
    return (process.env.NEXO_STORE_URL || '').replace(/\/+$/, '');
  }

  _getAdminKey() {
    return process.env.NEXO_STORE_ADMIN_KEY || '';
  }

  /**
   * Synchronize a single LP Creator template to the Nexo Store.
   * Uses POST when the template is not yet in the Store, PUT otherwise.
   * @param {string} templateId
   * @returns {Promise<object>}
   */
  async syncTemplateToStore(templateId, options = {}) {
    if (!templateId) {
      throw new Error('Template ID is required');
    }

    const storeUrl = this._getStoreUrl();
    const adminKey = this._getAdminKey();

    if (!storeUrl) {
      throw new Error('NEXO_STORE_URL is not configured');
    }
    if (!adminKey) {
      throw new Error('NEXO_STORE_ADMIN_KEY is not configured');
    }

    const template = await TemplateRepository.findById(templateId);
    if (!template) {
      throw new Error(`Template ${templateId} not found`);
    }

    const appProduct = adaptLPCTemplateToAppProduct(template, options);
    const exists = await this._checkStoreExists(storeUrl, adminKey, appProduct.slug);

    const method = exists ? 'PUT' : 'POST';
    const url = exists
      ? `${storeUrl}/api/admin/apps/${encodeURIComponent(appProduct.id)}`
      : `${storeUrl}/api/admin/apps`;

    const result = await this._requestWithRetry(method, url, appProduct, adminKey);
    console.log(`[LPStoreBridge] ${method} ${appProduct.slug} → Store OK`);
    return result;
  }

  /**
   * Synchronize the template that belongs to a given LP Creator session.
   * @param {string} sessionId
   * @returns {Promise<object|null>}
   */
  async syncTemplateBySessionId(sessionId, options = {}) {
    if (!sessionId) {
      throw new Error('Session ID is required');
    }
    const template = await TemplateRepository.findBySessionId(sessionId);
    if (!template) {
      console.warn(`[LPStoreBridge] No template found for session ${sessionId}`);
      return null;
    }
    return this.syncTemplateToStore(template.id, options);
  }

  /**
   * One-off migration helper: push every existing template to the Store.
   * @param {number} batchSize
   * @returns {Promise<{ synced: number, failed: number, errors: Array<object> }>}
   */
  async syncAllExistingTemplatesToStore(batchSize = 10) {
    const { templates = [] } = await TemplateRepository.findAll({ includeAllStatuses: true, limit: 100000 });
    const results = { synced: 0, failed: 0, errors: [] };

    for (let i = 0; i < templates.length; i += batchSize) {
      const batch = templates.slice(i, i + batchSize);
      await Promise.all(
        batch.map(async (tpl) => {
          try {
            await this.syncTemplateToStore(tpl.id);
            results.synced += 1;
          } catch (err) {
            results.failed += 1;
            results.errors.push({ templateId: tpl.id, error: err.message });
          }
        })
      );
    }

    return results;
  }

  /**
   * Check whether an app with the given slug already exists in the Store.
   * @param {string} storeUrl
   * @param {string} adminKey
   * @param {string} slug
   * @returns {Promise<boolean>}
   */
  async _checkStoreExists(storeUrl, adminKey, slug) {
    try {
      const res = await fetch(`${storeUrl}/api/app/${encodeURIComponent(slug)}`, {
        method: 'GET',
        headers: { 'x-admin-key': adminKey },
      });
      return res.ok;
    } catch (err) {
      console.warn(`[LPStoreBridge] Existence check failed for ${slug}:`, err.message);
      return false;
    }
  }

  /**
   * Execute a Store request with exponential backoff.
   * @param {string} method
   * @param {string} url
   * @param {object} payload
   * @param {string} adminKey
   * @param {number} attempt
   * @returns {Promise<object>}
   */
  async _requestWithRetry(method, url, payload, adminKey, attempt = 1) {
    try {
      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': adminKey,
        },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        return await res.json().catch(() => ({ success: true }));
      }

      const bodyText = await res.text().catch(() => '');
      throw new Error(`Store ${method} failed: ${res.status} ${res.statusText} ${bodyText}`.trim());
    } catch (err) {
      if (attempt >= DEFAULT_RETRY_ATTEMPTS) {
        console.error(`[LPStoreBridge] ${method} failed after ${attempt} attempt(s) for ${url}:`, err.message);
        throw err;
      }

      const delay = DEFAULT_RETRY_BASE_MS * 2 ** (attempt - 1);
      console.warn(`[LPStoreBridge] ${method} attempt ${attempt} failed: ${err.message}. Retrying in ${delay}ms...`);
      await new Promise((resolve) => setTimeout(resolve, delay));
      return this._requestWithRetry(method, url, payload, adminKey, attempt + 1);
    }
  }
}

module.exports = new LPStoreBridgeService();
module.exports.buildUniqueSlug = buildUniqueSlug;
module.exports.resolveAssetUrl = resolveAssetUrl;
module.exports.resolveDemoUrl = resolveDemoUrl;
module.exports.adaptLPCTemplateToAppProduct = adaptLPCTemplateToAppProduct;
