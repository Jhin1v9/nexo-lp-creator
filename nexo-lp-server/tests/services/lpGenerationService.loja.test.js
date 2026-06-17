/**
 * NEXO Landing Page Creator v3.0 - Generation Service LOJA Integration Tests
 */

const fs = require('fs');
const path = require('path');

const testDbPath = path.join(__dirname, '../../../data/nexo-lp-test-generation-loja.db');
process.env.NEXO_LP_DB_PATH = testDbPath;
process.env.NODE_ENV = 'test';
process.env.KIMI_BRIDGE_ENABLED = 'true';
process.env.KIMI_COOLDOWN_MS = '1';
process.env.KIMI_TIMEOUT = '0';

jest.mock('../../services/lpBridgeAdapter.cjs', () => ({
  initializeContext: jest.fn((sessionId, persisted = {}) => ({
    sessionId,
    userId: persisted.userId || `user-${Date.now()}`,
    chatUrl: persisted.chatUrl || null,
  })),
  sendMessage: jest.fn(),
  cancelStream: jest.fn(),
}));

jest.mock('../../services/lpSanitizationService', () => ({
  hashPrompt: jest.fn((prompt) => `hash-${prompt}`),
  makeCensoredPrompt: jest.fn(() => '[CENSORED PROMPT]'),
  startSanitization: jest.fn().mockResolvedValue({ success: true }),
}));

const { initializeDatabase, closeDatabase } = require('../../models/sqlite');
const SessionRepository = require('../../models/repositories/SessionRepository');
const TemplateRepository = require('../../models/repositories/TemplateRepository');
const PreviewService = require('../../services/lpPreviewService');
const lpTemplateService = require('../../services/lpTemplateService');
const BridgeAdapter = require('../../services/lpBridgeAdapter.cjs');
const lpGenerationService = require('../../services/lpGenerationService');

describe('lpGenerationService LOJA integration', () => {
  const userId = 'user-loja-generation';
  const createdTokens = [];
  let sessionId;

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

    if (sessionId) {
      const previewPath = PreviewService.getPreviewFilePath(sessionId);
      if (fs.existsSync(previewPath)) {
        fs.unlinkSync(previewPath);
      }
      const assetsPath = PreviewService.getPreviewAssetsPath(sessionId);
      if (fs.existsSync(assetsPath)) {
        fs.rmSync(assetsPath, { recursive: true, force: true });
      }
    }

    BridgeAdapter.sendMessage.mockClear();
    BridgeAdapter.initializeContext.mockClear();
  });

  async function createSession(overrides = {}) {
    const { metadata_json, ...rest } = overrides;
    const session = await SessionRepository.create({
      user_id: userId,
      initial_prompt: 'A landing page for my coffee shop',
      stack: 'react-tailwind',
      status: 'created',
      current_html: '<h1>Coffee Shop</h1>',
      ...rest,
    });

    if (metadata_json !== undefined) {
      await SessionRepository.updateMetadata(session.id, JSON.parse(metadata_json));
    } else {
      await SessionRepository.updateMetadata(session.id, { kimiUserId: userId });
    }

    return SessionRepository.findById(session.id);
  }

  function mockBridgeResponses() {
    BridgeAdapter.sendMessage.mockImplementation(async (_context, _prompt, options = {}) => {
      switch (options.phase) {
        case 'intention':
          return {
            content: JSON.stringify({
              title: 'Coffee Shop',
              description: 'Fresh coffee landing page',
              sections: ['hero', 'features', 'cta'],
              style: {
                tone: 'modern',
                colors: { primary: '#3B82F6', secondary: '#1E293B', accent: '#10B981' },
                typography: 'modern',
              },
              target: { audience: 'general', purpose: 'branding' },
            }),
          };
        case 'structure':
          return {
            content: JSON.stringify({
              layout: 'single-page',
              sections: [
                { id: 'hero', type: 'hero-section', components: ['heading', 'subheading'], order: 1 },
                { id: 'features', type: 'features-section', components: ['feature-cards'], order: 2 },
                { id: 'cta', type: 'cta-section', components: ['cta-button'], order: 3 },
              ],
              navigation: true,
              responsive_breakpoints: ['mobile', 'tablet', 'desktop'],
            }),
          };
        case 'code':
          return {
            content: '```html\n<!DOCTYPE html><html><body><h1>Coffee Shop</h1><section><p>Fresh coffee</p></section></body></html>\n```',
          };
        case 'review':
          return {
            content: JSON.stringify({ score: 90, issues: [], suggestions: [], passed: true }),
          };
        default:
          return { content: '' };
      }
    });
  }

  test('publishes generated landing page to LOJA after preview succeeds', async () => {
    const session = await createSession();
    sessionId = session.id;

    const publishSpy = jest.spyOn(lpTemplateService, 'publishFromSession');
    mockBridgeResponses();

    await lpGenerationService.startGeneration(
      sessionId,
      'A landing page for my coffee shop',
      'react-tailwind',
      { userId }
    );

    const finalSession = await SessionRepository.findById(sessionId);
    expect(finalSession.status).toBe('preview');

    const template = await TemplateRepository.findBySessionId(sessionId);
    expect(template).not.toBeNull();
    expect(template.status).toBe('sanitizing');
    expect(template.session_id).toBe(sessionId);
    expect(template.created_by).toBe(userId);
    expect(template.public_preview_token).toMatch(/^pub-/);

    createdTokens.push(template.public_preview_token);

    const publicPath = PreviewService.getPublicPreviewPath(template.public_preview_token);
    expect(fs.existsSync(publicPath)).toBe(true);

    expect(publishSpy).toHaveBeenCalledWith(sessionId, userId);
    publishSpy.mockRestore();
  }, 30000);

  test('completes generation successfully when LOJA publish fails', async () => {
    const session = await createSession();
    sessionId = session.id;

    const publishSpy = jest
      .spyOn(lpTemplateService, 'publishFromSession')
      .mockRejectedValue(new Error('LOJA publish failed'));
    mockBridgeResponses();

    await lpGenerationService.startGeneration(
      sessionId,
      'A landing page for my coffee shop',
      'react-tailwind',
      { userId }
    );

    const finalSession = await SessionRepository.findById(sessionId);
    expect(finalSession.status).not.toBe('failed');
    expect(finalSession.status).toBe('preview');

    publishSpy.mockRestore();
  }, 30000);
});
