/**
 * NEXO Landing Page Creator v3.0 - UserRepository Tests
 */

const fs = require('fs');
const path = require('path');

process.env.NODE_ENV = 'test';
process.env.NEXO_LP_DB_PATH = path.join(__dirname, '../../../data/nexo-lp-test-user.db');

const { initializeDatabase, closeDatabase } = require('../../models/sqlite');
const UserRepository = require('../../models/repositories/UserRepository');
const CurrencyRepository = require('../../models/repositories/CurrencyRepository');
const TemplateRepository = require('../../models/repositories/TemplateRepository');
const TemplatePurchaseRepository = require('../../models/repositories/TemplatePurchaseRepository');

describe('UserRepository', () => {
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

  test('creates a user and finds it by id with default status and role', async () => {
    const user = await UserRepository.create({
      id: 'usr-test-001',
      email: 'test001@example.com',
      name: 'Test User',
    });

    expect(user.id).toBe('usr-test-001');
    expect(user.email).toBe('test001@example.com');
    expect(user.name).toBe('Test User');
    expect(user.status).toBe('active');
    expect(user.role).toBe('user');
    expect(user.created_at).toBeDefined();
    expect(user.updated_at).toBeDefined();

    const found = await UserRepository.findById('usr-test-001');
    expect(found).not.toBeNull();
    expect(found.email).toBe('test001@example.com');
    expect(found.status).toBe('active');
    expect(found.role).toBe('user');
  });

  test('stringifies metadata_json object before insert', async () => {
    const user = await UserRepository.create({
      id: 'usr-test-metadata',
      email: 'metadata@example.com',
      name: 'Metadata User',
      metadataJson: { theme: 'dark', onboarded: true },
    });

    expect(user.id).toBe('usr-test-metadata');
    expect(user.metadata_json).toBe('{"theme":"dark","onboarded":true}');

    const found = await UserRepository.findById('usr-test-metadata');
    expect(found.metadata_json).toBe('{"theme":"dark","onboarded":true}');
  });

  test('findOrCreate creates a missing user and returns an existing user', async () => {
    const created = await UserRepository.findOrCreate('usr-test-findorcreate', {
      email: 'findorcreate@example.com',
      name: 'Find Or Create',
    });

    expect(created.id).toBe('usr-test-findorcreate');
    expect(created.email).toBe('findorcreate@example.com');
    expect(created.name).toBe('Find Or Create');
    expect(created.status).toBe('active');
    expect(created.role).toBe('user');

    const existing = await UserRepository.findOrCreate('usr-test-findorcreate', {
      email: 'ignored@example.com',
      name: 'Ignored',
    });

    expect(existing.id).toBe('usr-test-findorcreate');
    expect(existing.email).toBe('findorcreate@example.com');
    expect(existing.name).toBe('Find Or Create');
  });

  test('update sets status and role through the generic update method', async () => {
    await UserRepository.create({
      id: 'usr-test-002',
      email: 'test002@example.com',
      name: 'Admin Candidate',
      status: 'active',
      role: 'user',
    });

    const blocked = await UserRepository.update('usr-test-002', { status: 'blocked' });
    expect(blocked.status).toBe('blocked');

    const admin = await UserRepository.update('usr-test-002', { role: 'admin' });
    expect(admin.role).toBe('admin');

    const refreshed = await UserRepository.findById('usr-test-002');
    expect(refreshed.status).toBe('blocked');
    expect(refreshed.role).toBe('admin');
  });

  test('update ignores disallowed columns', async () => {
    const user = await UserRepository.create({
      id: 'usr-test-disallowed',
      email: 'disallowed@example.com',
      name: 'Disallowed',
    });

    const updated = await UserRepository.update('usr-test-disallowed', {
      name: 'Allowed Name',
      status: 'blocked',
      id: 'hijacked-id',
      created_at: '2000-01-01T00:00:00.000Z',
      password: 'secret',
    });

    expect(updated.id).toBe('usr-test-disallowed');
    expect(updated.name).toBe('Allowed Name');
    expect(updated.status).toBe('blocked');
    expect(updated.password).toBeUndefined();
  });

  test('list returns paginated users with balances and purchase aggregates', async () => {
    await UserRepository.create({
      id: 'usr-test-003',
      email: 'test003@example.com',
      name: 'Rich User',
    });

    await CurrencyRepository.setBalance('usr-test-003', { stars: 100, suns: 10, moons: 1 });

    // Foreign keys are now enforced, so the referenced templates must exist.
    await TemplateRepository.create({ id: 'tpl-test-001', name: 'Template One', price_stars: 20 });
    await TemplateRepository.create({ id: 'tpl-test-002', name: 'Template Two', price_stars: 5 });

    await TemplatePurchaseRepository.create({
      id: 'tpu-test-001',
      template_id: 'tpl-test-001',
      user_id: 'usr-test-003',
      price_stars: 20,
      price_suns: 2,
      price_moons: 0,
    });

    await TemplatePurchaseRepository.create({
      id: 'tpu-test-002',
      template_id: 'tpl-test-002',
      user_id: 'usr-test-003',
      price_stars: 5,
      price_suns: 0,
      price_moons: 1,
    });

    const result = await UserRepository.list({}, 1, 100);

    expect(result).toHaveProperty('users');
    expect(result).toHaveProperty('pagination');
    expect(result.pagination).toEqual({
      page: 1,
      limit: 100,
      total: expect.any(Number),
      totalPages: expect.any(Number),
    });
    expect(Array.isArray(result.users)).toBe(true);
    expect(result.pagination.total).toBeGreaterThanOrEqual(1);

    const rich = result.users.find(u => u.id === 'usr-test-003');

    expect(rich).toBeDefined();
    expect(Number(rich.balance_stars)).toBe(100);
    expect(Number(rich.balance_suns)).toBe(10);
    expect(Number(rich.balance_moons)).toBe(1);
    expect(Number(rich.total_spent_stars)).toBe(25);
    expect(Number(rich.total_spent_suns)).toBe(2);
    expect(Number(rich.total_spent_moons)).toBe(1);
    expect(Number(rich.total_purchases)).toBe(2);
  });
});
