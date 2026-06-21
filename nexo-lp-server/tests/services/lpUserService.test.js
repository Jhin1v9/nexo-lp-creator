/**
 * NEXO Landing Page Creator v3.0 - User Service Tests
 */

const fs = require('fs');
const path = require('path');

const testDbPath = path.join(__dirname, '../../../data/nexo-lp-test-user.db');
process.env.NEXO_LP_DB_PATH = testDbPath;
process.env.NODE_ENV = 'test';

const { initializeDatabase, closeDatabase } = require('../../models/sqlite');
const UserRepository = require('../../models/repositories/UserRepository');
const CurrencyRepository = require('../../models/repositories/CurrencyRepository');
const SessionRepository = require('../../models/repositories/SessionRepository');
const TemplateRepository = require('../../models/repositories/TemplateRepository');
const TemplatePurchaseRepository = require('../../models/repositories/TemplatePurchaseRepository');
const AdminLogRepository = require('../../models/repositories/AdminLogRepository');
const lpUserService = require('../../services/lpUserService');

describe('lpUserService', () => {
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

  describe('ensureExists', () => {
    test('creates a new user when one does not exist', async () => {
      const user = await lpUserService.ensureExists('usr-ensure-new');
      expect(user).toHaveProperty('id', 'usr-ensure-new');
      expect(user).toHaveProperty('status', 'active');
    });

    test('returns existing user without creating a duplicate', async () => {
      const first = await lpUserService.ensureExists('usr-ensure-existing');
      const second = await lpUserService.ensureExists('usr-ensure-existing');
      expect(second.id).toBe(first.id);
    });
  });

  describe('getProfile', () => {
    test('returns null for an unknown user', async () => {
      const profile = await lpUserService.getProfile('usr-does-not-exist');
      expect(profile).toBeNull();
    });

    test('returns enriched profile for a user', async () => {
      const userId = 'usr-profile';
      await lpUserService.ensureExists(userId);

      // Seed related data
      await CurrencyRepository.credit(userId, { stars: 10, suns: 2, moons: 1 });
      const session = await SessionRepository.create({
        user_id: userId,
        initial_prompt: 'Test session',
        stack: 'react-tailwind',
        status: 'created',
      });
      const template = await TemplateRepository.create({
        name: 'User Template',
        description: 'Created by user',
        category: 'landing',
        stack: 'react-tailwind',
        html: '<h1>Hello</h1>',
        status: 'available',
        created_by: userId,
        is_public: 1,
        price_stars: 5,
      });
      const purchase = await TemplatePurchaseRepository.create({
        template_id: template.id,
        user_id: userId,
        price_stars: 5,
        price_suns: 1,
        price_moons: 0,
      });

      const profile = await lpUserService.getProfile(userId);

      expect(profile).toHaveProperty('id', userId);
      expect(profile.balances).toMatchObject({
        userId,
        stars: 60,
        suns: 7,
        moons: 2,
      });
      expect(profile.purchases).toHaveLength(1);
      expect(profile.purchases[0].id).toBe(purchase.id);
      expect(profile.totalPurchases).toBe(1);
      expect(profile.totalSpent).toEqual({ stars: 5, suns: 1, moons: 0 });
      expect(profile.sessions).toHaveLength(1);
      expect(profile.sessions[0].id).toBe(session.id);
      expect(profile.publishedTemplates).toHaveLength(1);
      expect(profile.publishedTemplates[0].id).toBe(template.id);
      expect(profile.adminHistory).toEqual([]);
    });
  });

  describe('setStatus', () => {
    test('updates user status and logs the action', async () => {
      const userId = 'usr-status';
      const adminUserId = 'usr-admin';
      await lpUserService.ensureExists(userId);

      const updated = await lpUserService.setStatus(userId, 'blocked', adminUserId);
      expect(updated.status).toBe('blocked');

      const history = await AdminLogRepository.listByTarget('user', userId);
      expect(history).toHaveLength(1);
      expect(history[0].action).toBe('user.blocked');
      expect(history[0].user_id).toBe(adminUserId);
      expect(history[0].target_id).toBe(userId);
    });
  });
});
