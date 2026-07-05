/**
 * NEXO Landing Page Creator v3.0 - LP Store Bridge Service Tests
 */

const crypto = require('crypto');
const path = require('path');

const testDbPath = path.join(__dirname, '../../../data/nexo-lp-test-store-bridge.db');
process.env.NEXO_LP_DB_PATH = testDbPath;
process.env.NODE_ENV = 'test';
process.env.NEXO_STORE_URL = 'https://store.test';
process.env.NEXO_STORE_ADMIN_KEY = 'test-admin-key';
process.env.PREVIEW_BASE_URL = 'https://lp.test';

jest.mock('node-fetch', () => jest.fn());
jest.mock('../../models/repositories/TemplateRepository', () => ({
  findById: jest.fn(),
  findBySessionId: jest.fn(),
  findAll: jest.fn(),
}));

const fetch = require('node-fetch');
const TemplateRepository = require('../../models/repositories/TemplateRepository');
const lpStoreBridgeService = require('../../services/lpStoreBridgeService');

function expectedSlug(name, id) {
  const slugified = String(name || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  const hash = crypto.createHash('sha256').update(String(id)).digest('hex').slice(0, 8);
  return `${slugified}-template-${hash}`;
}

function makeTemplate(overrides = {}) {
  return {
    id: 'tpl-123',
    name: 'Padaria Artesanal',
    description: 'A beautiful landing page',
    category: 'business',
    subcategory: 'bakery',
    stack: 'react-tailwind',
    thumbnail_url: 'https://cdn.test/thumb.jpg',
    html: '<html><body>Original HTML</body></html>',
    sanitized_html: '<html><body>Sanitized HTML</body></html>',
    css: '.hero { color: red; }',
    js: 'console.log("ok");',
    tags: 'bakery,food,responsive',
    source: 'generated',
    usage_count: 7,
    rating: 4,
    is_public: 2,
    created_by: 'user-1',
    created_at: '2026-01-15T10:00:00.000Z',
    updated_at: '2026-01-16T10:00:00.000Z',
    price_stars: 5,
    price_suns: 0,
    price_moons: 0,
    original_price_stars: 10,
    original_price_suns: 0,
    original_price_moons: 0,
    status: 'approved',
    public_preview_token: 'pub-abc',
    session_id: 'sess-abc',
    metadata_json: JSON.stringify({
      category: 'business',
      subcategory: 'bakery',
      tags: ['artisan', 'bread'],
      features: ['Hero section'],
      useCases: ['Launch'],
      seoKeywords: ['padaria', 'artesanal'],
    }),
    ...overrides,
  };
}

function mockFetchResponse(status, body = {}) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    statusText: status >= 200 && status < 300 ? 'OK' : 'Error',
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(typeof body === 'string' ? body : JSON.stringify(body)),
  });
}

describe('lpStoreBridgeService', () => {
  beforeEach(() => {
    fetch.mockClear();
    TemplateRepository.findById.mockClear();
    TemplateRepository.findBySessionId.mockClear();
    TemplateRepository.findAll.mockClear();
  });

  test('creates a new AppProduct via POST when slug does not exist in Store', async () => {
    const template = makeTemplate();
    TemplateRepository.findById.mockResolvedValue(template);

    fetch
      .mockResolvedValueOnce(mockFetchResponse(404, { error: 'not found' }))
      .mockResolvedValueOnce(mockFetchResponse(201, { success: true, id: template.id }));

    const result = await lpStoreBridgeService.syncTemplateToStore(template.id);

    expect(result).toEqual({ success: true, id: template.id });
    expect(TemplateRepository.findById).toHaveBeenCalledWith(template.id);

    expect(fetch).toHaveBeenCalledTimes(2);

    const slug = expectedSlug(template.name, template.id);
    const [getCall, postCall] = fetch.mock.calls;
    expect(getCall[0]).toBe(`https://store.test/api/app/${slug}`);
    expect(getCall[1]).toMatchObject({ method: 'GET', headers: { 'x-admin-key': 'test-admin-key' } });

    expect(postCall[0]).toBe('https://store.test/api/admin/apps');
    expect(postCall[1]).toMatchObject({
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-key': 'test-admin-key',
      },
    });

    const body = JSON.parse(postCall[1].body);
    expect(body.id).toBe(template.id);
    expect(body.slug).toBe(slug);
    expect(body.virtualPrice).toEqual({ stars: 5, suns: 0, moons: 0 });
    expect(body.originalVirtualPrice).toEqual({ stars: 10, suns: 0, moons: 0 });
    expect(body.html).toBe(template.sanitized_html);
    expect(body.demoUrl).toBe('https://lp.test/preview/pub-abc');
    expect(body.tags).toContain('bakery');
    expect(body.keywords).toContain('Padaria Artesanal');
  });

  test('updates an existing AppProduct via PUT when slug already exists', async () => {
    const template = makeTemplate({ status: 'unreviewed' });
    TemplateRepository.findById.mockResolvedValue(template);

    fetch
      .mockResolvedValueOnce(mockFetchResponse(200, { id: template.id }))
      .mockResolvedValueOnce(mockFetchResponse(200, { success: true, id: template.id }));

    const result = await lpStoreBridgeService.syncTemplateToStore(template.id);

    expect(result).toEqual({ success: true, id: template.id });
    expect(fetch).toHaveBeenCalledTimes(2);

    const [, putCall] = fetch.mock.calls;
    expect(putCall[0]).toBe(`https://store.test/api/admin/apps/${template.id}`);
    expect(putCall[1]).toMatchObject({
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-key': 'test-admin-key',
      },
    });

    const body = JSON.parse(putCall[1].body);
    expect(body.id).toBe(template.id);
    expect(body.status).toBe('coming_soon');
  });

  test('generates unique slugs for templates with the same name', async () => {
    const t1 = makeTemplate({ id: 'tpl-aaa', name: 'Padaria Artesanal' });
    const t2 = makeTemplate({ id: 'tpl-bbb', name: 'Padaria Artesanal' });

    TemplateRepository.findById
      .mockResolvedValueOnce(t1)
      .mockResolvedValueOnce(t2);

    fetch
      .mockResolvedValueOnce(mockFetchResponse(404))
      .mockResolvedValueOnce(mockFetchResponse(201, { success: true }))
      .mockResolvedValueOnce(mockFetchResponse(404))
      .mockResolvedValueOnce(mockFetchResponse(201, { success: true }));

    await lpStoreBridgeService.syncTemplateToStore(t1.id);
    await lpStoreBridgeService.syncTemplateToStore(t2.id);

    const [, post1] = fetch.mock.calls[1];
    const [, post2] = fetch.mock.calls[3];

    const body1 = JSON.parse(post1.body);
    const body2 = JSON.parse(post2.body);

    expect(body1.slug).toBe(expectedSlug(t1.name, t1.id));
    expect(body2.slug).toBe(expectedSlug(t2.name, t2.id));
    expect(body1.slug).not.toBe(body2.slug);
  });

  test('uses sanitized_html when approved and current html otherwise', async () => {
    const approved = makeTemplate({ status: 'approved' });
    const sanitizing = makeTemplate({
      id: 'tpl-unreviewed',
      status: 'sanitizing',
      sanitized_html: '',
    });

    TemplateRepository.findById
      .mockResolvedValueOnce(approved)
      .mockResolvedValueOnce(sanitizing);

    fetch
      .mockResolvedValueOnce(mockFetchResponse(404))
      .mockResolvedValueOnce(mockFetchResponse(201, { success: true }))
      .mockResolvedValueOnce(mockFetchResponse(404))
      .mockResolvedValueOnce(mockFetchResponse(201, { success: true }));

    await lpStoreBridgeService.syncTemplateToStore(approved.id);
    await lpStoreBridgeService.syncTemplateToStore(sanitizing.id);

    const [, approvedPost] = fetch.mock.calls[1];
    const [, sanitizingPost] = fetch.mock.calls[3];

    expect(JSON.parse(approvedPost.body).html).toBe(approved.sanitized_html);
    expect(JSON.parse(sanitizingPost.body).html).toBe(sanitizing.html);
  });

  test('retries Store requests with exponential backoff and eventually succeeds', async () => {
    const template = makeTemplate();
    TemplateRepository.findById.mockResolvedValue(template);

    let postAttempts = 0;
    fetch.mockImplementation((url, options) => {
      if (!options.method || options.method === 'GET') {
        return mockFetchResponse(404);
      }
      postAttempts += 1;
      if (postAttempts < 3) {
        return mockFetchResponse(500, { error: 'store busy' });
      }
      return mockFetchResponse(201, { success: true });
    });

    const start = Date.now();
    const result = await lpStoreBridgeService.syncTemplateToStore(template.id);
    const elapsed = Date.now() - start;

    expect(result).toEqual({ success: true });
    expect(postAttempts).toBe(3);
    // Exponential backoff: 1000ms then 2000ms => at least 2500ms total
    expect(elapsed).toBeGreaterThanOrEqual(2500);
  });

  test('syncTemplateBySessionId resolves the template and syncs it', async () => {
    const template = makeTemplate();
    TemplateRepository.findBySessionId.mockResolvedValue(template);
    fetch
      .mockResolvedValueOnce(mockFetchResponse(404))
      .mockResolvedValueOnce(mockFetchResponse(201, { success: true }));

    await lpStoreBridgeService.syncTemplateBySessionId(template.session_id);

    expect(TemplateRepository.findBySessionId).toHaveBeenCalledWith(template.session_id);
    expect(TemplateRepository.findById).toHaveBeenCalledWith(template.id);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  test('syncAllExistingTemplatesToStore batches all templates', async () => {
    const t1 = makeTemplate({ id: 'tpl-1' });
    const t2 = makeTemplate({ id: 'tpl-2' });
    TemplateRepository.findAll.mockResolvedValue({ templates: [t1, t2] });
    TemplateRepository.findById
      .mockResolvedValueOnce(t1)
      .mockResolvedValueOnce(t2);

    fetch
      .mockResolvedValueOnce(mockFetchResponse(404))
      .mockResolvedValueOnce(mockFetchResponse(201, { success: true }))
      .mockResolvedValueOnce(mockFetchResponse(404))
      .mockResolvedValueOnce(mockFetchResponse(201, { success: true }));

    const result = await lpStoreBridgeService.syncAllExistingTemplatesToStore(10);

    expect(result.synced).toBe(2);
    expect(result.failed).toBe(0);
    expect(TemplateRepository.findAll).toHaveBeenCalledWith({ includeAllStatuses: true, limit: 100000 });
  });

  test('throws when Store URL or admin key is missing', async () => {
    const originalUrl = process.env.NEXO_STORE_URL;
    const originalKey = process.env.NEXO_STORE_ADMIN_KEY;

    delete process.env.NEXO_STORE_URL;
    await expect(lpStoreBridgeService.syncTemplateToStore('tpl-1')).rejects.toThrow('NEXO_STORE_URL is not configured');

    process.env.NEXO_STORE_URL = originalUrl;
    delete process.env.NEXO_STORE_ADMIN_KEY;
    await expect(lpStoreBridgeService.syncTemplateToStore('tpl-1')).rejects.toThrow('NEXO_STORE_ADMIN_KEY is not configured');

    process.env.NEXO_STORE_ADMIN_KEY = originalKey;
  });
});
