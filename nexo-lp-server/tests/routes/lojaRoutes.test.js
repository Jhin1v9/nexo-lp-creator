/**
 * NEXO Landing Page Creator v3.0 - LOJA Routes Tests
 *
 * Tests buying templates, retrieving prompts, and publishing public previews.
 */

const fs = require('fs');
const path = require('path');
const request = require('supertest');

const testDbPath = path.join(__dirname, '../../../data/nexo-lp-test-loja-routes.db');
process.env.NEXO_LP_DB_PATH = testDbPath;
process.env.NODE_ENV = 'test';
process.env.KIMI_BRIDGE_ENABLED = 'false';

const { initializeDatabase, closeDatabase } = require('../../models/sqlite');
const SessionRepository = require('../../models/repositories/SessionRepository');
const TemplateRepository = require('../../models/repositories/TemplateRepository');
const TemplatePurchaseRepository = require('../../models/repositories/TemplatePurchaseRepository');
const CurrencyRepository = require('../../models/repositories/CurrencyRepository');
const PreviewService = require('../../services/lpPreviewService');

let app;

describe('LOJA Routes', () => {
  const createdPublicTokens = [];

  beforeAll(async () => {
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
    await initializeDatabase();
    app = require('../../nexo-lp-server');
  });

  afterAll(async () => {
    closeDatabase();
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });

  afterEach(async () => {
    for (const token of createdPublicTokens) {
      const filePath = PreviewService.getPublicPreviewPath(token);
      try {
        fs.rmSync(filePath, { force: true });
      } catch (err) {
        // Ignore cleanup errors
      }
    }
    createdPublicTokens.length = 0;
  });

  async function createUserWithBalance(userId, balance) {
    await CurrencyRepository.setBalance(userId, balance);
  }

  async function createAvailableTemplate(overrides = {}) {
    return TemplateRepository.create({
      name: 'Available Template',
      description: 'A template available for purchase',
      category: 'landing',
      stack: 'react-tailwind',
      html: '<h1>Template Hero</h1>',
      css: '.hero { color: red; }',
      js: 'console.log("template");',
      status: 'available',
      source: 'manual',
      price_stars: 5,
      price_suns: 0,
      price_moons: 0,
      prompt_censored: '[CENSORED PROMPT]',
      ...overrides,
    });
  }

  async function createSession(userId, overrides = {}) {
    return SessionRepository.create({
      user_id: userId,
      initial_prompt: 'A test landing page',
      stack: 'react-tailwind',
      status: 'preview',
      current_html: '<h1>Public Preview Test</h1><p>Welcome!</p>',
      ...overrides,
    });
  }

  test('POST /api/nexo-lp/templates/:id/buy returns purchase and deducts currency', async () => {
    const userId = 'user-buyer-routes';
    await createUserWithBalance(userId, { stars: 20, suns: 5, moons: 1 });
    const template = await createAvailableTemplate({ price_stars: 7 });

    const beforeBalance = await CurrencyRepository.getBalance(userId);
    expect(beforeBalance.stars).toBe(20);

    const res = await request(app)
      .post(`/api/nexo-lp/templates/${template.id}/buy`)
      .send({ userId });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.template_id).toBe(template.id);
    expect(res.body.data.user_id).toBe(userId);
    expect(res.body.data.price_stars).toBe(7);

    const afterBalance = await CurrencyRepository.getBalance(userId);
    expect(afterBalance.stars).toBe(13);
  });

  test('GET /api/nexo-lp/templates/:id/prompt returns censored prompt before purchase and original after', async () => {
    const userId = 'user-prompt-routes';
    const session = await createSession(userId, {
      initial_prompt: 'Original secret prompt',
    });
    const template = await createAvailableTemplate({
      session_id: session.id,
      prompt_censored: '[PROMPT BLOQUEADO]',
    });

    const censoredRes = await request(app)
      .get(`/api/nexo-lp/templates/${template.id}/prompt`)
      .query({ userId });

    expect(censoredRes.status).toBe(200);
    expect(censoredRes.body.success).toBe(true);
    expect(censoredRes.body.data.unlocked).toBe(false);
    expect(censoredRes.body.data.censored).toBe(true);
    expect(censoredRes.body.data.prompt).toBe('[PROMPT BLOQUEADO]');

    await request(app)
      .post(`/api/nexo-lp/templates/${template.id}/buy`)
      .send({ userId });

    const unlockedRes = await request(app)
      .get(`/api/nexo-lp/templates/${template.id}/prompt`)
      .query({ userId });

    expect(unlockedRes.status).toBe(200);
    expect(unlockedRes.body.success).toBe(true);
    expect(unlockedRes.body.data.unlocked).toBe(true);
    expect(unlockedRes.body.data.censored).toBe(false);
    expect(unlockedRes.body.data.prompt).toBe('Original secret prompt');
  });

  test('POST /api/nexo-lp/preview/:sessionId/public returns public preview URL', async () => {
    const userId = 'user-public-preview-routes';
    const session = await createSession(userId);

    const res = await request(app)
      .post(`/api/nexo-lp/preview/${session.id}/public`)
      .send({ userId });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.token).toMatch(/^pub-/);
    expect(res.body.data.url).toContain(`/preview/public/${res.body.data.token}.html`);

    createdPublicTokens.push(res.body.data.token);

    const filePath = PreviewService.getPublicPreviewPath(res.body.data.token);
    expect(fs.existsSync(filePath)).toBe(true);
    const content = fs.readFileSync(filePath, 'utf-8');
    expect(content).toContain('<h1>Public Preview Test</h1>');
  });

  test('Static file at /preview/public/:token.html is served', async () => {
    const userId = 'user-static-preview-routes';
    const session = await createSession(userId, {
      current_html: '<h1>Static Preview Test</h1>',
    });

    const publishRes = await request(app)
      .post(`/api/nexo-lp/preview/${session.id}/public`)
      .send({ userId });

    expect(publishRes.status).toBe(201);
    const { token } = publishRes.body.data;
    createdPublicTokens.push(token);

    const staticRes = await request(app).get(`/preview/public/${token}.html`);

    expect(staticRes.status).toBe(200);
    expect(staticRes.text).toContain('<h1>Static Preview Test</h1>');
    expect(staticRes.headers['content-type']).toMatch(/text\/html/);
  });

  test('POST /api/nexo-lp/preview/:sessionId/public rejects unauthorized user', async () => {
    const ownerId = 'user-owner-routes';
    const otherId = 'user-other-routes';
    const session = await createSession(ownerId);

    const res = await request(app)
      .post(`/api/nexo-lp/preview/${session.id}/public`)
      .send({ userId: otherId });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  test('POST /api/nexo-lp/templates/:id/buy requires userId', async () => {
    const template = await createAvailableTemplate();

    const res = await request(app)
      .post(`/api/nexo-lp/templates/${template.id}/buy`)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('MISSING_PARAM');
  });

  test('POST /api/nexo-lp/templates/:id/buy rejects insufficient currency and does not create purchase', async () => {
    const userId = 'user-insufficient-routes';
    await createUserWithBalance(userId, { stars: 2, suns: 0, moons: 0 });
    const template = await createAvailableTemplate({ price_stars: 5 });

    const res = await request(app)
      .post(`/api/nexo-lp/templates/${template.id}/buy`)
      .send({ userId });

    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.body.success).toBe(false);

    const purchase = await TemplatePurchaseRepository.findByTemplateAndUser(template.id, userId);
    expect(purchase).toBeUndefined();
  });

  test('POST /api/nexo-lp/templates/:id/buy returns 404 for non-existent template', async () => {
    const userId = 'user-nonexistent-buy-routes';
    await createUserWithBalance(userId, { stars: 50, suns: 5, moons: 1 });

    const res = await request(app)
      .post('/api/nexo-lp/templates/tpl-does-not-exist/buy')
      .send({ userId });

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  test('GET /api/nexo-lp/templates/:id/prompt returns 404 for non-existent template', async () => {
    const userId = 'user-nonexistent-prompt-routes';

    const res = await request(app)
      .get('/api/nexo-lp/templates/tpl-does-not-exist/prompt')
      .query({ userId });

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  test('POST /api/nexo-lp/preview/:sessionId/public returns 400 when session has no HTML', async () => {
    const userId = 'user-no-html-routes';
    const session = await createSession(userId, { current_html: null });

    const res = await request(app)
      .post(`/api/nexo-lp/preview/${session.id}/public`)
      .send({ userId });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});
