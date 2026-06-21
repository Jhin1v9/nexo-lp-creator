/**
 * NEXO Landing Page Creator v3.0 - Admin Auth Middleware Tests
 */

const request = require('supertest');
const express = require('express');
const requireAdmin = require('../../security/adminAuth');

const ADMIN_SECRET = 'test-admin-secret-1234567890';

function createApp() {
  const app = express();
  app.get('/admin/events', requireAdmin, (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.write('data: {}\n\n');
    res.end();
  });
  app.patch('/admin/templates/:id', requireAdmin, (req, res) => {
    res.json({ userId: req.userId });
  });
  return app;
}

describe('requireAdmin', () => {
  let app;

  beforeEach(() => {
    process.env.ADMIN_SECRET = ADMIN_SECRET;
    app = createApp();
  });

  afterEach(() => {
    delete process.env.ADMIN_SECRET;
  });

  test('allows requests with a valid Bearer token', async () => {
    const res = await request(app)
      .patch('/admin/templates/tpl-123')
      .set('Authorization', `Bearer ${ADMIN_SECRET}`)
      .expect(200);
    expect(res.body.userId).toBe('admin');
  });

  test('allows GET requests with a valid adminToken query parameter', async () => {
    const res = await request(app)
      .get(`/admin/events?adminToken=${ADMIN_SECRET}`)
      .expect(200);
    expect(res.headers['content-type']).toMatch(/text\/event-stream/);
  });

  test('rejects requests without a token', async () => {
    await request(app).patch('/admin/templates/tpl-123').expect(401);
  });

  test('rejects requests with an invalid token', async () => {
    await request(app)
      .patch('/admin/templates/tpl-123')
      .set('Authorization', 'Bearer wrong-token')
      .expect(401);
  });

  test('rejects GET requests with an invalid adminToken', async () => {
    await request(app).get('/admin/events?adminToken=wrong-token').expect(401);
  });

  test('returns 500 when ADMIN_SECRET is not configured', async () => {
    delete process.env.ADMIN_SECRET;
    const res = await request(app)
      .patch('/admin/templates/tpl-123')
      .set('Authorization', `Bearer ${ADMIN_SECRET}`)
      .expect(500);
    expect(res.body.error).toBe('Server misconfigured');
  });
});
