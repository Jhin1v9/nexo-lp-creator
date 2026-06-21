/**
 * NEXO Landing Page Creator v3.0 - Admin Routes Tests
 *
 * Basic integration tests for the redesigned admin API.
 */

const fs = require('fs');
const path = require('path');
const request = require('supertest');
const express = require('express');

const testDbPath = path.join(__dirname, '../../../data/nexo-lp-test-admin-routes.db');
process.env.NEXO_LP_DB_PATH = testDbPath;
process.env.NODE_ENV = 'test';
process.env.KIMI_BRIDGE_ENABLED = 'false';

const { initializeDatabase, closeDatabase } = require('../../models/sqlite');
const UserRepository = require('../../models/repositories/UserRepository');
const CurrencyRepository = require('../../models/repositories/CurrencyRepository');
const SessionRepository = require('../../models/repositories/SessionRepository');
const TemplateRepository = require('../../models/repositories/TemplateRepository');
const MiningJobRepository = require('../../models/repositories/MiningJobRepository');
const TemplatePurchaseRepository = require('../../models/repositories/TemplatePurchaseRepository');
const SanitizationOrchestrator = require('../../services/lpSanitizationOrchestrator');
const lpGenerationService = require('../../services/lpGenerationService');
const adminRoutes = require('../../routes/adminRoutes');

jest.spyOn(SanitizationOrchestrator, 'startSanitization').mockResolvedValue({ success: true });
jest.spyOn(lpGenerationService, 'startGeneration').mockResolvedValue({ success: true });

const ADMIN_SECRET = 'test-admin-secret-1234567890';
process.env.ADMIN_SECRET = ADMIN_SECRET;

const ADMIN_ACTOR_ID = 'admin-test-actor';
const TEST_USER_ID = 'admin-test-user';

let app;

function adminHeaders() {
  return { Authorization: `Bearer ${ADMIN_SECRET}` };
}

describe('Admin Routes', () => {
  beforeAll(async () => {
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
    await initializeDatabase();

    // Build a minimal app using admin routes exactly as production mounts them.
    app = express();
    app.use(express.json());
    app.use('/api/nexo-lp/admin', adminRoutes);

    // Ensure a test user exists for the user-management tests.
    await UserRepository.create({
      id: TEST_USER_ID,
      email: 'admin-test@example.com',
      name: 'Test User',
      status: 'active',
      role: 'user',
    });
    // Ensure the user's currency row exists with the default welcome balance.
    await CurrencyRepository.getBalance(TEST_USER_ID);
  });

  afterAll(async () => {
    closeDatabase();
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });

  test('GET /admin/stats returns dashboard statistics', async () => {
    const res = await request(app)
      .get('/api/nexo-lp/admin/stats')
      .set(adminHeaders())
      .expect(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('templates');
    expect(res.body.data).toHaveProperty('sessions');
    expect(res.body.data).toHaveProperty('purchases');
    expect(res.body.data).toHaveProperty('jobs');
  });

  test('GET /admin/stats rejects unauthenticated requests', async () => {
    const res = await request(app).get('/api/nexo-lp/admin/stats').expect(401);
    expect(res.body.success).toBe(false);
  });

  test('GET /admin/users returns paginated users', async () => {
    await SessionRepository.create({
      user_id: TEST_USER_ID,
      initial_prompt: 'Test',
      stack: 'html-tailwind',
      status: 'created',
    });

    const res = await request(app)
      .get('/api/nexo-lp/admin/users')
      .set(adminHeaders())
      .expect(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('users');
    expect(res.body.data).toHaveProperty('pagination');
    expect(res.body.data.users.some((u) => u.id === TEST_USER_ID)).toBe(true);
  });

  test('PATCH /admin/users/:id updates user role', async () => {
    const res = await request(app)
      .patch(`/api/nexo-lp/admin/users/${TEST_USER_ID}`)
      .set(adminHeaders())
      .send({ role: 'admin', name: 'Admin User' })
      .expect(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.role).toBe('admin');
    expect(res.body.data.name).toBe('Admin User');
  });

  test('POST /admin/users/:id/block blocks a user', async () => {
    const res = await request(app)
      .post(`/api/nexo-lp/admin/users/${TEST_USER_ID}/block`)
      .set(adminHeaders())
      .expect(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('blocked');
  });

  test('POST /admin/users/:id/unblock unblocks a user', async () => {
    const res = await request(app)
      .post(`/api/nexo-lp/admin/users/${TEST_USER_ID}/unblock`)
      .set(adminHeaders())
      .expect(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('active');
  });

  test('GET /admin/settings returns generation settings', async () => {
    const res = await request(app)
      .get('/api/nexo-lp/admin/settings')
      .set(adminHeaders())
      .expect(200);
    expect(res.body.success).toBe(true);
    expect(Object.prototype.hasOwnProperty.call(res.body.data, 'generation.mode')).toBe(true);
    expect(Object.prototype.hasOwnProperty.call(res.body.data, 'generation.modes')).toBe(true);
  });

  test('PATCH /admin/settings updates generation settings', async () => {
    const res = await request(app)
      .patch('/api/nexo-lp/admin/settings')
      .set(adminHeaders())
      .send({ 'generation.mode': 'multi-page' })
      .expect(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data['generation.mode']).toBe('multi-page');
  });

  test('POST /admin/currency/credit credits user currency', async () => {
    const res = await request(app)
      .post('/api/nexo-lp/admin/currency/credit')
      .set(adminHeaders())
      .send({ userId: TEST_USER_ID, currency: 'stars', amount: 10 })
      .expect(200);
    expect(res.body.success).toBe(true);

    const balance = await CurrencyRepository.getBalance(TEST_USER_ID);
    expect(balance.stars).toBe(60);
  });

  test('POST /admin/currency/deduct deducts user currency', async () => {
    const res = await request(app)
      .post('/api/nexo-lp/admin/currency/deduct')
      .set(adminHeaders())
      .send({ userId: TEST_USER_ID, currency: 'stars', amount: 3 })
      .expect(200);
    expect(res.body.success).toBe(true);

    const balance = await CurrencyRepository.getBalance(TEST_USER_ID);
    expect(balance.stars).toBe(57);
  });

  test('GET /admin/templates lists templates with a price alias', async () => {
    await TemplateRepository.create({
      name: 'Admin Test Template',
      description: 'Test',
      category: 'landing',
      stack: 'html-tailwind',
      html: '<h1>Test</h1>',
      status: 'available',
      source: 'manual',
      price_stars: 5,
    });

    const res = await request(app)
      .get('/api/nexo-lp/admin/templates')
      .set(adminHeaders())
      .expect(200);
    expect(res.body.success).toBe(true);
    const templates = res.body.data.templates || res.body.data;
    expect(Array.isArray(templates)).toBe(true);
    const first = templates[0];
    expect(first).toHaveProperty('price');
    expect(first.price).toBe(first.price_stars);
  });

  test('PATCH /admin/templates/:id rejects unauthenticated requests', async () => {
    const template = await TemplateRepository.create({
      name: 'Unauth Template',
      description: 'Test',
      category: 'landing',
      stack: 'html-tailwind',
      html: '<h1>Test</h1>',
      status: 'available',
      source: 'manual',
      price_stars: 1,
    });

    const res = await request(app)
      .patch(`/api/nexo-lp/admin/templates/${template.id}`)
      .send({ name: 'Hacked' })
      .expect(401);
    expect(res.body.success).toBe(false);
  });

  test('PATCH /admin/templates/:id updates template and maps price to price_stars', async () => {
    const template = await TemplateRepository.create({
      name: 'Update Template',
      description: 'Test',
      category: 'landing',
      stack: 'html-tailwind',
      html: '<h1>Test</h1>',
      status: 'available',
      source: 'manual',
      price_stars: 2,
    });

    const res = await request(app)
      .patch(`/api/nexo-lp/admin/templates/${template.id}`)
      .set(adminHeaders())
      .send({ name: 'Updated Name', price: 9 })
      .expect(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.name).toBe('Updated Name');
    expect(res.body.data.price_stars).toBe(9);
  });

  test('GET /admin/sessions lists sessions', async () => {
    const res = await request(app)
      .get('/api/nexo-lp/admin/sessions')
      .set(adminHeaders())
      .expect(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  test('GET /admin/purchases lists purchases', async () => {
    const res = await request(app)
      .get('/api/nexo-lp/admin/purchases')
      .set(adminHeaders())
      .expect(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  test('GET /admin/mining-jobs lists mining jobs', async () => {
    const res = await request(app)
      .get('/api/nexo-lp/admin/mining-jobs')
      .set(adminHeaders())
      .expect(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  test('GET /admin/users/:id returns user profile', async () => {
    const res = await request(app)
      .get(`/api/nexo-lp/admin/users/${TEST_USER_ID}`)
      .set(adminHeaders())
      .expect(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe(TEST_USER_ID);
    expect(res.body.data).toHaveProperty('balances');
  });

  test('POST /admin/users/:id/impersonate generates a token', async () => {
    const res = await request(app)
      .post(`/api/nexo-lp/admin/users/${TEST_USER_ID}/impersonate`)
      .set(adminHeaders())
      .expect(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('token');
    expect(res.body.data.userId).toBe(TEST_USER_ID);
  });

  test('POST /admin/templates/:id/approve approves a template', async () => {
    const template = await TemplateRepository.create({
      name: 'Approve Template',
      description: 'Test',
      category: 'landing',
      stack: 'html-tailwind',
      html: '<h1>Test</h1>',
      status: 'unreviewed',
      source: 'manual',
      price_stars: 3,
    });

    const res = await request(app)
      .post(`/api/nexo-lp/admin/templates/${template.id}/approve`)
      .set(adminHeaders())
      .expect(200);
    expect(res.body.success).toBe(true);
    expect(['approved', 'available']).toContain(res.body.data.status);
  });

  test('DELETE /admin/templates/:id deletes a template', async () => {
    const template = await TemplateRepository.create({
      name: 'Delete Template',
      description: 'Test',
      category: 'landing',
      stack: 'html-tailwind',
      html: '<h1>Test</h1>',
      status: 'available',
      source: 'manual',
      price_stars: 1,
    });

    const res = await request(app)
      .delete(`/api/nexo-lp/admin/templates/${template.id}`)
      .set(adminHeaders())
      .expect(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.deleted).toBe(true);

    const gone = await TemplateRepository.findById(template.id);
    expect(gone).toBeUndefined();
  });

  test('POST /admin/templates/:id/sanitize queues sanitization', async () => {
    const session = await SessionRepository.create({
      user_id: TEST_USER_ID,
      initial_prompt: 'Sanitize test',
      stack: 'html-tailwind',
      status: 'preview',
      current_html: '<h1>OK</h1>',
    });

    const template = await TemplateRepository.create({
      name: 'Sanitize Template',
      description: 'Test',
      category: 'landing',
      stack: 'html-tailwind',
      html: '<h1>Test</h1>',
      status: 'available',
      source: 'manual',
      price_stars: 2,
      session_id: session.id,
    });

    const res = await request(app)
      .post(`/api/nexo-lp/admin/templates/${template.id}/sanitize`)
      .set(adminHeaders())
      .expect(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.queued).toBe(true);
  });

  test('POST /admin/sessions/:id/regenerate queues regeneration', async () => {
    const session = await SessionRepository.create({
      user_id: TEST_USER_ID,
      initial_prompt: 'Regenerate test',
      stack: 'html-tailwind',
      status: 'created',
    });

    const res = await request(app)
      .post(`/api/nexo-lp/admin/sessions/${session.id}/regenerate`)
      .set(adminHeaders())
      .expect(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.queued).toBe(true);
    expect(lpGenerationService.startGeneration).toHaveBeenCalled();
  });

  test('DELETE /admin/sessions/:id deletes a session', async () => {
    const session = await SessionRepository.create({
      user_id: TEST_USER_ID,
      initial_prompt: 'Delete session test',
      stack: 'html-tailwind',
      status: 'created',
    });

    const res = await request(app)
      .delete(`/api/nexo-lp/admin/sessions/${session.id}`)
      .set(adminHeaders())
      .expect(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.deleted).toBe(true);

    const gone = await SessionRepository.findById(session.id);
    expect(gone).toBeUndefined();
  });

  test('GET /admin/purchases lists purchases', async () => {
    const template = await TemplateRepository.create({
      name: 'Purchase Template',
      description: 'Test',
      category: 'landing',
      stack: 'html-tailwind',
      html: '<h1>Test</h1>',
      status: 'available',
      source: 'manual',
      price_stars: 4,
    });

    await TemplatePurchaseRepository.create({
      template_id: template.id,
      user_id: TEST_USER_ID,
      price_stars: 4,
      status: 'completed',
    });

    const res = await request(app)
      .get('/api/nexo-lp/admin/purchases')
      .set(adminHeaders())
      .expect(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.some((p) => p.user_id === TEST_USER_ID)).toBe(true);
  });

  test('POST /admin/mining-jobs/:id/retry resets status to pending', async () => {
    const job = await MiningJobRepository.create({
      url: 'https://example.com',
      user_id: TEST_USER_ID,
      status: 'failed',
    });

    const res = await request(app)
      .post(`/api/nexo-lp/admin/mining-jobs/${job.id}/retry`)
      .set(adminHeaders())
      .expect(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('pending');
  });

  test('POST /admin/mining-jobs/:id/pause and resume toggle status', async () => {
    const job = await MiningJobRepository.create({
      url: 'https://example.com',
      user_id: TEST_USER_ID,
      status: 'pending',
    });

    const paused = await request(app)
      .post(`/api/nexo-lp/admin/mining-jobs/${job.id}/pause`)
      .set(adminHeaders())
      .expect(200);
    expect(paused.body.data.status).toBe('paused');

    const resumed = await request(app)
      .post(`/api/nexo-lp/admin/mining-jobs/${job.id}/resume`)
      .set(adminHeaders())
      .expect(200);
    expect(resumed.body.data.status).toBe('pending');
  });

});
