/**
 * NEXO Landing Page Creator v3.0 - Template Service Tests
 */

const fs = require('fs');
const path = require('path');

const testDbPath = path.join(__dirname, '../../../data/nexo-lp-test-template.db');
process.env.NEXO_LP_DB_PATH = testDbPath;
process.env.NODE_ENV = 'test';

jest.mock('../../services/lpSanitizationOrchestrator', () => ({
  startSanitization: jest.fn().mockResolvedValue({ success: true }),
}));

const { initializeDatabase, closeDatabase } = require('../../models/sqlite');
const SessionRepository = require('../../models/repositories/SessionRepository');
const TemplateRepository = require('../../models/repositories/TemplateRepository');
const CurrencyRepository = require('../../models/repositories/CurrencyRepository');
const PreviewService = require('../../services/lpPreviewService');
const SanitizationOrchestrator = require('../../services/lpSanitizationOrchestrator');
const TemplateService = require('../../services/lpTemplateService');

describe('lpTemplateService', () => {
  const createdTokens = [];

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

  afterEach(async () => {
    for (const token of createdTokens) {
      const filePath = PreviewService.getPublicPreviewPath(token);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }
    createdTokens.length = 0;
    SanitizationOrchestrator.startSanitization.mockClear();
  });

  function generateValidHtml() {
    const filler = '<p>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.</p>'.repeat(250);
    return `<!DOCTYPE html><html><head><title>Test</title></head><body>${filler}<section>Hero</section></body></html>`;
  }

  async function createSession(userId, overrides = {}) {
    return SessionRepository.create({
      user_id: userId,
      initial_prompt: 'A test landing page for my startup',
      stack: 'react-tailwind',
      status: 'preview',
      current_html: generateValidHtml(),
      kimi_chat_url: 'http://kimi.example.com/chat/test',
      ...overrides,
    });
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
      source: 'generated',
      price_stars: 5,
      price_suns: 0,
      price_moons: 0,
      prompt_censored: '[CENSORED]',
      ...overrides,
    });
  }

  test('publishFromSession creates sanitizing template with public preview', async () => {
    const userId = 'user-publisher';
    const session = await createSession(userId);

    const template = await TemplateService.publishFromSession(session.id, userId);

    expect(template).toBeDefined();
    expect(template.status).toBe('sanitizing');
    expect(template.source).toBe('generated');
    expect(template.price_stars).toBe(5);
    expect(template.session_id).toBe(session.id);
    expect(template.public_preview_token).toMatch(/^pub-/);
    expect(template.is_public).toBe(1);

    createdTokens.push(template.public_preview_token);

    const filePath = PreviewService.getPublicPreviewPath(template.public_preview_token);
    expect(fs.existsSync(filePath)).toBe(true);

    const content = fs.readFileSync(filePath, 'utf-8');
    expect(content).toContain('Sanitizing template...');

    expect(SanitizationOrchestrator.startSanitization).toHaveBeenCalledWith(
      session.id,
      session.current_html,
      session.initial_prompt,
      session.kimi_chat_url,
      userId
    );
  });

  test('buyTemplate charges currency and records purchase', async () => {
    const buyerId = 'user-buyer';
    const template = await createAvailableTemplate({ price_stars: 7 });

    const beforeBalance = await CurrencyRepository.getBalance(buyerId);
    expect(beforeBalance.stars).toBe(50);

    const purchase = await TemplateService.buyTemplate(template.id, buyerId);

    expect(purchase).toBeDefined();
    expect(purchase.template_id).toBe(template.id);
    expect(purchase.user_id).toBe(buyerId);
    expect(purchase.price_stars).toBe(7);

    const afterBalance = await CurrencyRepository.getBalance(buyerId);
    expect(afterBalance.stars).toBe(43);
  });

  test('useTemplate requires purchase and copies code to new session', async () => {
    const userId = 'user-template';
    const template = await createAvailableTemplate({
      html: '<section class="hero">Hero</section>',
      css: '.hero { font-size: 2rem; }',
      js: 'console.log("loaded");',
    });

    await expect(TemplateService.useTemplate(template.id, userId)).rejects.toThrow('Template not purchased');

    await TemplateService.buyTemplate(template.id, userId);

    const beforeTemplate = await TemplateRepository.findById(template.id);
    const usageBefore = beforeTemplate.usage_count;

    const newSession = await TemplateService.useTemplate(template.id, userId);

    expect(newSession).toBeDefined();
    expect(newSession.success).toBe(true);
    expect(newSession.sessionId).toBeDefined();
    expect(newSession.templateId).toBe(template.id);
    expect(newSession.templateName).toBe(template.name);
    expect(newSession.status).toBe('created');
    expect(newSession.stack).toBe(template.stack);
    expect(newSession.current_html).toBe(template.html);
    expect(newSession.generated_css).toBe(template.css);
    expect(newSession.generated_js).toBe(template.js);

    const persistedSession = await SessionRepository.findById(newSession.sessionId);
    expect(persistedSession.user_id).toBe(userId);
    expect(persistedSession.initial_prompt).toBe(`Template based on ${template.name}`);

    const afterTemplate = await TemplateRepository.findById(template.id);
    expect(afterTemplate.usage_count).toBe(usageBefore + 1);
  });

  test('getTemplatePrompt returns censored if not purchased', async () => {
    const userId = 'user-curious';
    const template = await createAvailableTemplate({
      prompt_censored: '[PROMPT BLOCKED]',
    });

    const result = await TemplateService.getTemplatePrompt(template.id, userId);

    expect(result.unlocked).toBe(false);
    expect(result.censored).toBe(true);
    expect(result.prompt).toBe('[PROMPT BLOCKED]');
  });

  test('publishUnreviewedFromSession creates unreviewed template at half price', async () => {
    const userId = 'user-unreviewed';
    const session = await createSession(userId);

    const template = await TemplateService.publishUnreviewedFromSession(session.id, userId, 'review-failed');

    expect(template).toBeDefined();
    expect(template.status).toBe('unreviewed');
    expect(template.source).toBe('generated');
    expect(template.price_stars).toBe(3); // default 5 / 2 rounded up
    expect(template.original_price_stars).toBe(5);
    expect(template.unreviewed_reason).toBe('review-failed');
    expect(template.session_id).toBe(session.id);
    expect(template.public_preview_token).toMatch(/^pub-/);
    expect(template.is_public).toBe(1);

    createdTokens.push(template.public_preview_token);

    const filePath = PreviewService.getPublicPreviewPath(template.public_preview_token);
    expect(fs.existsSync(filePath)).toBe(true);

    // Sanitization should NOT be triggered automatically for unreviewed publishes.
    expect(SanitizationOrchestrator.startSanitization).not.toHaveBeenCalled();
  });

  test('publishUnreviewedFromSession rejects invalid HTML', async () => {
    const userId = 'user-invalid';
    const session = await createSession(userId, { current_html: '<h1>Too short</h1>' });

    await expect(TemplateService.publishUnreviewedFromSession(session.id, userId)).rejects.toThrow('Session does not contain valid HTML');
  });

  test('promoteToReviewed restores original price and status', async () => {
    const userId = 'user-promote';
    const session = await createSession(userId);
    const template = await TemplateService.publishUnreviewedFromSession(session.id, userId, 'cron-backfill');
    createdTokens.push(template.public_preview_token);

    const promoted = await TemplateService.promoteToReviewed(template.id);

    expect(promoted).toBeDefined();
    expect(promoted.status).toBe('approved');
    expect(promoted.is_public).toBe(2);
    expect(promoted.price_stars).toBe(template.original_price_stars);
    expect(promoted.unreviewed_reason).toBeNull();
    expect(promoted.reviewed_at).toBeTruthy();
  });
});
