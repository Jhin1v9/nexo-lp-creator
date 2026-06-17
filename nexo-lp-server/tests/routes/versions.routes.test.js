/**
 * NEXO Landing Page Creator v3.0 - Versions API Tests
 */

const fs = require('fs');
const path = require('path');
const request = require('supertest');

const testDbPath = path.join(__dirname, '../../../data/nexo-lp-test-routes.db');
process.env.NEXO_LP_DB_PATH = testDbPath;
process.env.NODE_ENV = 'test';

const { initializeDatabase, closeDatabase } = require('../../models/sqlite');

let app;

describe('Versions API', () => {
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

  let sessionId;

  beforeEach(async () => {
    const res = await request(app)
      .post('/api/nexo-lp/sessions')
      .send({ userId: 'test-user', initialPrompt: 'version test' });
    sessionId = res.body.data.id;
  });

  test('POST /sessions/:id/versions saves a version', async () => {
    const res = await request(app)
      .post(`/api/nexo-lp/sessions/${sessionId}/versions`)
      .send({ html: '<html>v1</html>', note: 'Initial version' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.html).toBe('<html>v1</html>');
    expect(res.body.data.change_summary).toBe('Initial version');
  });

  test('GET /sessions/:id/versions lists versions newest first', async () => {
    await request(app)
      .post(`/api/nexo-lp/sessions/${sessionId}/versions`)
      .send({ html: 'v1', note: 'first' });
    await request(app)
      .post(`/api/nexo-lp/sessions/${sessionId}/versions`)
      .send({ html: 'v2', note: 'second' });

    const res = await request(app).get(`/api/nexo-lp/sessions/${sessionId}/versions`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.data[0].html).toBe('v2');
  });

  test('POST /sessions/:id/versions/:versionId/rollback restores html', async () => {
    const saveRes = await request(app)
      .post(`/api/nexo-lp/sessions/${sessionId}/versions`)
      .send({ html: '<html>v1</html>', note: 'first' });
    const versionId = saveRes.body.data.id;

    await request(app)
      .post(`/api/nexo-lp/preview/${sessionId}`)
      .send({ html: '<html>current</html>' });

    const rollbackRes = await request(app)
      .post(`/api/nexo-lp/sessions/${sessionId}/versions/${versionId}/rollback`);

    expect(rollbackRes.status).toBe(200);
    expect(rollbackRes.body.data.html).toBe('<html>v1</html>');

    const sessionRes = await request(app).get(`/api/nexo-lp/sessions/${sessionId}`);
    expect(sessionRes.body.data.current_html).toBe('<html>v1</html>');
  });
});
