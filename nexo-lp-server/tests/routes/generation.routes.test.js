/**
 * NEXO Landing Page Creator v3.0 - Generation API Tests (mock mode)
 */

const fs = require('fs');
const path = require('path');
const request = require('supertest');

const testDbPath = path.join(__dirname, '../../../data/nexo-lp-test-generation.db');
process.env.NEXO_LP_DB_PATH = testDbPath;
process.env.NODE_ENV = 'test';
process.env.KIMI_BRIDGE_ENABLED = 'false';

const { initializeDatabase, closeDatabase } = require('../../models/sqlite');

let app;

describe('Generation API (mock mode)', () => {
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

    // A version snapshot should have been created
    const versionsRes = await request(app).get(`/api/nexo-lp/sessions/${sessionId}/versions`);
    expect(versionsRes.status).toBe(200);
    expect(versionsRes.body.data.length).toBeGreaterThan(0);
  }, 60000);
});
