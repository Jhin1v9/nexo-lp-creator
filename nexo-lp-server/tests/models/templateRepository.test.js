/**
 * NEXO Landing Page Creator v3.0 - TemplateRepository Tests
 */

const fs = require('fs');
const path = require('path');

process.env.NODE_ENV = 'test';
process.env.NEXO_LP_DB_PATH = path.join(__dirname, '../../../data/nexo-lp-test-template.db');

const { initializeDatabase, closeDatabase } = require('../../models/sqlite');
const TemplateRepository = require('../../models/repositories/TemplateRepository');
const TemplatePurchaseRepository = require('../../models/repositories/TemplatePurchaseRepository');

describe('TemplateRepository & TemplatePurchaseRepository', () => {
  const testDbPath = process.env.NEXO_LP_DB_PATH;

  beforeAll(async () => {
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
    await initializeDatabase();
  });

  afterAll(async () => {
    closeDatabase();
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });

  test('create stores sanitization and preview fields', async () => {
    const template = await TemplateRepository.create({
      name: 'Sanitized Template',
      description: 'A template with sanitization data',
      category: 'landing',
      stack: 'static-html-tailwind',
      status: 'available',
      original_html: '<html>original</html>',
      sanitized_html: '<html>sanitized</html>',
      sanitization_log: { step: 'completed', reason: 'none' },
      public_preview_token: 'preview-abc-123',
      prompt_hash: 'hash123',
      prompt_censored: 'censored prompt',
      price_stars: 10,
      price_suns: 2,
      price_moons: 1,
      session_id: 'sess-test-123',
      kimi_chat_url: 'https://kimi.ai/chat/123',
    });

    expect(template.id).toBeDefined();
    expect(template.status).toBe('available');
    expect(template.original_html).toBe('<html>original</html>');
    expect(template.sanitized_html).toBe('<html>sanitized</html>');
    expect(template.sanitization_log).toBe(JSON.stringify({ step: 'completed', reason: 'none' }));
    expect(template.public_preview_token).toBe('preview-abc-123');
    expect(template.prompt_hash).toBe('hash123');
    expect(template.prompt_censored).toBe('censored prompt');
    expect(template.price_stars).toBe(10);
    expect(template.price_suns).toBe(2);
    expect(template.price_moons).toBe(1);
    expect(template.session_id).toBe('sess-test-123');
    expect(template.kimi_chat_url).toBe('https://kimi.ai/chat/123');

    const found = await TemplateRepository.findById(template.id);
    expect(found.public_preview_token).toBe('preview-abc-123');
  });

  test('findBySessionId returns template', async () => {
    const sessionId = `sess-${Date.now()}`;
    const template = await TemplateRepository.create({
      name: 'Session Linked Template',
      session_id: sessionId,
    });

    const found = await TemplateRepository.findBySessionId(sessionId);
    expect(found).not.toBeNull();
    expect(found.id).toBe(template.id);
    expect(found.session_id).toBe(sessionId);
  });

  test('findByPublicPreviewToken returns template', async () => {
    const token = `token-${Date.now()}`;
    const template = await TemplateRepository.create({
      name: 'Public Preview Template',
      public_preview_token: token,
    });

    const found = await TemplateRepository.findByPublicPreviewToken(token);
    expect(found).not.toBeNull();
    expect(found.id).toBe(template.id);
    expect(found.public_preview_token).toBe(token);
  });

  test('findAll excludes failed status by default', async () => {
    await TemplateRepository.create({ name: 'Available One', status: 'available' });
    await TemplateRepository.create({ name: 'Sanitizing One', status: 'sanitizing' });
    await TemplateRepository.create({ name: 'Failed One', status: 'failed' });

    const result = await TemplateRepository.findAll({ limit: 100 });
    const names = result.templates.map(t => t.name);

    expect(names).toContain('Available One');
    expect(names).toContain('Sanitizing One');
    expect(names).not.toContain('Failed One');

    const failedResult = await TemplateRepository.findAll({ status: 'failed', limit: 100 });
    const failedNames = failedResult.templates.map(t => t.name);
    expect(failedNames).toContain('Failed One');
  });

  test('TemplatePurchaseRepository records a purchase', async () => {
    const template = await TemplateRepository.create({
      name: 'Purchasable Template',
      price_stars: 50,
      price_suns: 5,
      price_moons: 1,
    });

    const purchase = await TemplatePurchaseRepository.create({
      template_id: template.id,
      user_id: 'user-123',
      price_stars: 50,
      price_suns: 5,
      price_moons: 1,
    });

    expect(purchase.id).toMatch(/^tpu-/);
    expect(purchase.template_id).toBe(template.id);
    expect(purchase.user_id).toBe('user-123');
    expect(purchase.price_stars).toBe(50);
    expect(purchase.price_suns).toBe(5);
    expect(purchase.price_moons).toBe(1);

    const foundById = await TemplatePurchaseRepository.findById(purchase.id);
    expect(foundById.template_id).toBe(template.id);

    const foundByTemplateAndUser = await TemplatePurchaseRepository.findByTemplateAndUser(
      template.id,
      'user-123'
    );
    expect(foundByTemplateAndUser).not.toBeNull();
    expect(foundByTemplateAndUser.id).toBe(purchase.id);

    const userPurchases = await TemplatePurchaseRepository.findByUser('user-123');
    expect(userPurchases.length).toBeGreaterThanOrEqual(1);
    expect(userPurchases.map(p => p.id)).toContain(purchase.id);
  });
});
