/**
 * NEXO Landing Page Creator v3.0 - Generation API Tests
 *
 * Integration test for the /generate endpoint. The real AI bridge is mocked
 * so the full pipeline can be exercised without external dependencies.
 */

const fs = require('fs');
const path = require('path');
const request = require('supertest');

const testDbPath = path.join(__dirname, '../../../data/nexo-lp-test-generation.db');
process.env.NEXO_LP_DB_PATH = testDbPath;
process.env.NODE_ENV = 'test';
process.env.KIMI_BRIDGE_ENABLED = 'false';
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
const BridgeAdapter = require('../../services/lpBridgeAdapter.cjs');

let app;

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
          content: '```html\n<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Coffee Shop</title></head><body><h1>Coffee Shop</h1><section><p>Fresh coffee</p></section></body></html>\n```',
        };
      case 'review':
        return {
          content: JSON.stringify({ score: 95, issues: [], suggestions: [], passed: true }),
        };
      default:
        return { content: '' };
    }
  });
}

describe('Generation API', () => {
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

  test('POST /generate completes all phases including code and preview', async () => {
    mockBridgeResponses();

    const sessionRes = await request(app)
      .post('/api/nexo-lp/sessions')
      .send({ userId: 'test-user', initialPrompt: 'coffee shop landing page' });
    expect(sessionRes.status).toBe(201);
    const sessionId = sessionRes.body.data.id;

    const previewRes = await request(app)
      .post(`/api/nexo-lp/preview/${sessionId}`)
      .send({ html: '<html>test</html>' });
    expect(previewRes.status).toBe(200);

    const genRes = await request(app)
      .post('/api/nexo-lp/generate')
      .send({ sessionId, prompt: 'coffee shop landing page' });
    expect(genRes.status).toBe(202);

    // Wait for background generation to finish
    await new Promise((r) => setTimeout(r, 10000));

    const finalRes = await request(app).get(`/api/nexo-lp/sessions/${sessionId}`);
    const finalSession = finalRes.body.data;

    expect(finalSession.status).toBe('preview');
    expect(finalSession.status).not.toBe('failed');
    expect(finalSession.current_html).toBeTruthy();
    expect(finalSession.current_html.length).toBeGreaterThan(100);

    // The persisted preview file should match the session's current HTML
    const finalPreviewRes = await request(app).get(`/api/nexo-lp/preview/${sessionId}`);
    expect(finalPreviewRes.status).toBe(200);
    expect(finalPreviewRes.body.data.html).toContain(finalSession.current_html);

    // A version snapshot should have been created
    const versionsRes = await request(app).get(`/api/nexo-lp/sessions/${sessionId}/versions`);
    expect(versionsRes.status).toBe(200);
    expect(versionsRes.body.data.length).toBeGreaterThan(0);
  }, 60000);
});
