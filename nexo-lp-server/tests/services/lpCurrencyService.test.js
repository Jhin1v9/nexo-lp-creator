/**
 * NEXO Landing Page Creator v3.0 - Currency Service Tests
 */

const fs = require('fs');
const path = require('path');

const testDbPath = path.join(__dirname, '../../../data/nexo-lp-test-currency.db');
process.env.NEXO_LP_DB_PATH = testDbPath;
process.env.NODE_ENV = 'test';

const { initializeDatabase, closeDatabase } = require('../../models/sqlite');
const lpCurrencyService = require('../../services/lpCurrencyService');

describe('lpCurrencyService', () => {
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

  test('getBalance creates default balance for new user', async () => {
    const balance = await lpCurrencyService.getBalance('user-new');
    expect(balance.stars).toBe(50);
    expect(balance.suns).toBe(5);
    expect(balance.moons).toBe(1);
  });

  test('charge deducts correct amount for stars generation', async () => {
    const result = await lpCurrencyService.charge('user-new', 'generate', 'stars');
    expect(result.cost).toEqual({ stars: 2, suns: 0, moons: 0 });
    expect(result.newBalance.stars).toBe(48);
  });

  test('charge fails when balance is insufficient', async () => {
    await lpCurrencyService.charge('user-poor', 'generate', 'moons'); // spends the 1 moon
    await expect(lpCurrencyService.charge('user-poor', 'generate', 'moons')).rejects.toThrow('Insufficient balance');
  });

  test('credit increases balance', async () => {
    await lpCurrencyService.getBalance('user-credit');
    const balance = await lpCurrencyService.credit('user-credit', { stars: 10, suns: 1 });
    expect(balance.stars).toBe(60);
    expect(balance.suns).toBe(6);
  });

  test('formatCost renders emojis correctly', () => {
    expect(lpCurrencyService.formatCost({ stars: 2, suns: 1, moons: 1 })).toContain('⭐');
    expect(lpCurrencyService.formatCost({ stars: 2, suns: 1, moons: 1 })).toContain('☀️');
    expect(lpCurrencyService.formatCost({ stars: 2, suns: 1, moons: 1 })).toContain('🌙');
  });
});
