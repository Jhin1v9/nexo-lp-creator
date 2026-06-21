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

jest.mock('../../services/lpSanitizationOrchestrator', () => ({
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

  test('publishes as unreviewed when QA review fails and does not rebuild', async () => {
    const session = await createSession();
    sessionId = session.id;

    let codeCallCount = 0;
    let reviewCallCount = 0;

    BridgeAdapter.sendMessage.mockImplementation(async (_context, prompt, options = {}) => {
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
        case 'code': {
          codeCallCount += 1;
          return {
            content: '```html\n<!DOCTYPE html><html><body><h1>Coffee Shop</h1><button>Click</button></body></html>\n```',
          };
        }
        case 'review': {
          reviewCallCount += 1;
          return {
            content: JSON.stringify({
              score: 65,
              issues: [
                { severity: 'error', message: 'Missing viewport meta tag' },
                { severity: 'warning', message: 'Button missing type attribute' },
              ],
              suggestions: ['Add viewport meta', 'Add button type'],
              passed: true, // intentionally wrong to test normalization
            }),
          };
        }
        default:
          return { content: '' };
      }
    });

    await lpGenerationService.startGeneration(
      sessionId,
      'A landing page for my coffee shop',
      'react-tailwind',
      { userId }
    );

    const finalSession = await SessionRepository.findById(sessionId);
    expect(finalSession.status).toBe('preview');

    // We keep the original HTML; no AI rebuild loop should run.
    expect(codeCallCount).toBe(1);
    expect(reviewCallCount).toBe(1);

    // The preview phase should never be sent to the AI bridge
    const previewCalls = BridgeAdapter.sendMessage.mock.calls.filter(([, , opts]) => opts && opts.phase === 'preview');
    expect(previewCalls.length).toBe(0);

    // Final HTML is the original generated HTML
    expect(finalSession.current_html).toContain('<h1>Coffee Shop</h1>');
  }, 30000);

  test('sends complete HTML (not truncated) to QA review when HTML exceeds 4000 chars', async () => {
    const session = await createSession();
    sessionId = session.id;

    const longHtml = '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Long Page</title></head><body><h1>Long Page</h1>' +
      '<p>' + 'x'.repeat(5000) + '</p>' +
      '</body></html>';

    BridgeAdapter.sendMessage.mockImplementation(async (_context, prompt, options = {}) => {
      switch (options.phase) {
        case 'intention':
          return {
            content: JSON.stringify({
              title: 'Long Page',
              description: 'A long landing page',
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
          return { content: `\`\`\`html\n${longHtml}\n\`\`\`` };
        case 'review':
          return {
            content: JSON.stringify({ score: 95, issues: [], suggestions: [], passed: true }),
          };
        default:
          return { content: '' };
      }
    });

    await lpGenerationService.startGeneration(
      sessionId,
      'A landing page with lots of content',
      'react-tailwind',
      { userId }
    );

    const reviewCalls = BridgeAdapter.sendMessage.mock.calls.filter(([, , opts]) => opts && opts.phase === 'review');
    expect(reviewCalls.length).toBeGreaterThanOrEqual(1);

    const reviewPrompt = reviewCalls[0][1];
    expect(reviewPrompt).toContain(longHtml);
    expect(reviewPrompt).not.toContain(longHtml.substring(0, 4000) + 'CRITICAL RULES');
    expect(reviewPrompt.length).toBeGreaterThan(longHtml.length + 200);

    const finalSession = await SessionRepository.findById(sessionId);
    expect(finalSession.status).toBe('preview');
  }, 30000);

  describe('JSON parsing robustness', () => {
    test('extractJsonObject parses JSON prefixed with Kimi code-block header', () => {
      const review = {
        score: 72,
        issues: [{ severity: 'error', message: 'Hero overflow' }],
        suggestions: ['Fix it'],
        passed: false,
      };
      const text = `JSON\n${JSON.stringify(review)}`;
      const parsed = lpGenerationService.extractJsonObject(text);
      expect(parsed).toEqual(review);
    });

    test('extractJsonObject parses JSON inside markdown code block', () => {
      const review = { score: 90, issues: [], suggestions: [], passed: true };
      const text = `\`\`\`json\n${JSON.stringify(review)}\n\`\`\``;
      const parsed = lpGenerationService.extractJsonObject(text);
      expect(parsed).toEqual(review);
    });

    test('extractJsonObject parses plain JSON', () => {
      const review = { score: 85, issues: [], suggestions: [], passed: false };
      const parsed = lpGenerationService.extractJsonObject(JSON.stringify(review));
      expect(parsed).toEqual(review);
    });

    test('extractJsonObject parses JSON wrapped in explanatory text', () => {
      const review = {
        score: 72,
        issues: [{ severity: 'error', message: 'Mobile menu lacks aria attributes' }],
        suggestions: ['Add aria-label'],
        passed: false,
      };
      const text = `Aqui está o review solicitado:\n${JSON.stringify(review)}\nEspero que ajude.`;
      const parsed = lpGenerationService.extractJsonObject(text);
      expect(parsed).toEqual(review);
    });

    test('safeJsonParse returns fallback when no JSON is found', () => {
      const fallback = { score: 0, issues: [] };
      const parsed = lpGenerationService.safeJsonParse('just plain text without json', fallback);
      expect(parsed).toEqual(fallback);
    });

    test('extractJsonObject parses JSON with trailing commas', () => {
      const text = `{\n  "score": 72,\n  "issues": [{\n    "severity": "error",\n    "message": "Broken link",\n  },],\n  "passed": false,\n}`;
      const parsed = lpGenerationService.extractJsonObject(text);
      expect(parsed.score).toBe(72);
      expect(parsed.issues).toHaveLength(1);
      expect(parsed.issues[0].message).toBe('Broken link');
    });

    test('extractJsonObject picks the review-like object among multiple JSON objects', () => {
      const small = JSON.stringify({ ok: true });
      const review = JSON.stringify({
        score: 55,
        issues: [{ severity: 'critical', message: 'Truncated HTML' }],
        suggestions: ['Fix it'],
        passed: false,
      });
      const text = `${small}\n${review}\n${small}`;
      const parsed = lpGenerationService.extractJsonObject(text);
      expect(parsed.score).toBe(55);
      expect(parsed.issues).toHaveLength(1);
    });

    test('extractJsonObject normalizes old {ok, corrections} schema', () => {
      const text = JSON.stringify({
        ok: false,
        corrections: ['Fix div', 'Add alt text'],
        metadata: { category: 'saas' },
      });
      const parsed = lpGenerationService.extractJsonObject(text);
      expect(parsed.passed).toBe(false);
      expect(parsed.issues).toHaveLength(2);
      expect(parsed.issues[0].severity).toBe('warning');
    });

    test('extractJsonObject parses a top-level issues array', () => {
      const issues = [{ severity: 'warning', message: 'Low contrast' }];
      const parsed = lpGenerationService.extractJsonObject(JSON.stringify(issues));
      expect(parsed.issues).toEqual(issues);
    });
  });

  test('does not send fix prompts and keeps original HTML when QA review fails', async () => {
    const session = await createSession();
    sessionId = session.id;

    const realIssues = [
      { severity: 'error', message: 'Hero phone mockup board overflows container' },
      { severity: 'warning', message: 'Viewport meta prevents zoom' },
    ];

    let fixPromptReceived = false;

    BridgeAdapter.sendMessage.mockImplementation(async (_context, prompt, options = {}) => {
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
        case 'code': {
          if (prompt.includes('PHASE: Rebuild / Fix')) {
            fixPromptReceived = true;
          }
          return {
            content: '```html\n<!DOCTYPE html><html><body><h1>Coffee Shop</h1><button>Click</button></body></html>\n```',
          };
        }
        case 'review':
          return {
            content: `JSON\n${JSON.stringify({
              score: 72,
              issues: realIssues,
              suggestions: ['Fix overflow', 'Allow zoom'],
              passed: false,
            })}`,
          };
        default:
          return { content: '' };
      }
    });

    await lpGenerationService.startGeneration(
      sessionId,
      'A landing page for my coffee shop',
      'react-tailwind',
      { userId }
    );

    const finalSession = await SessionRepository.findById(sessionId);
    expect(finalSession.status).toBe('preview');
    expect(fixPromptReceived).toBe(false);
    expect(finalSession.current_html).toContain('<h1>Coffee Shop</h1>');
  }, 30000);

  test('retries review prompt and publishes as unreviewed when review response stays unparseable', async () => {
    const session = await createSession();
    sessionId = session.id;

    const EXPECTED_REVIEW_CALLS = 2; // initial + one retry

    BridgeAdapter.sendMessage.mockImplementation(async (_context, prompt, options = {}) => {
      switch (options.phase) {
        case 'intention':
          return {
            content: JSON.stringify({
              title: 'Coffee Shop',
              description: 'Fresh coffee landing page',
              sections: ['hero', 'features', 'cta'],
              style: { tone: 'modern', colors: { primary: '#3B82F6' }, typography: 'modern' },
              target: { audience: 'general', purpose: 'branding' },
            }),
          };
        case 'structure':
          return {
            content: JSON.stringify({
              layout: 'single-page',
              sections: [{ id: 'hero', type: 'hero-section', components: ['heading'], order: 1 }],
              navigation: true,
              responsive_breakpoints: ['mobile', 'tablet', 'desktop'],
            }),
          };
        case 'code':
          return {
            content: '```html\n<!DOCTYPE html><html><body><h1>Coffee Shop</h1><button>Click</button></body></html>\n```',
          };
        case 'review':
          // Persistently return a response that cannot be parsed as JSON
          return {
            content: 'I think the page looks good overall, but there are a few minor improvements we could make.',
          };
        default:
          return { content: '' };
      }
    });

    await lpGenerationService.startGeneration(
      sessionId,
      'A landing page for my coffee shop',
      'react-tailwind',
      { userId }
    );

    const finalSession = await SessionRepository.findById(sessionId);
    // v4.2-fix: an unparseable review no longer fails the whole generation.
    // The page is published as unreviewed instead, so the session ends in preview.
    expect(finalSession.status).not.toBe('failed');
    expect(finalSession.status).toBe('preview');

    // Initial review + retry (no bug-detector fallback)
    const reviewCalls = BridgeAdapter.sendMessage.mock.calls.filter(([, , opts]) => opts && opts.phase === 'review');
    expect(reviewCalls.length).toBe(EXPECTED_REVIEW_CALLS);

    // Retry prompts should ask for strict JSON and include the previous raw response
    const retryPrompts = reviewCalls.slice(1).map((call) => call[1]);
    for (const retryPrompt of retryPrompts) {
      expect(retryPrompt).toContain('JSON');
      expect(retryPrompt).toContain('I think the page looks good overall');
    }
  }, 30000);
});
