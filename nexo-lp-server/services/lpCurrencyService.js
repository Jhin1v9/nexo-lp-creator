/**
 * NEXO Landing Page Creator v3.0 - Currency Service
 *
 * Virtual economy: stars (Estrelas), suns (Sóis), moons (Lunas).
 * Handles balance checks, debits/credits, and pricing for generation modes.
 *
 * @module services/lpCurrencyService
 * @version 3.0.0
 */

const CurrencyRepository = require('../models/repositories/CurrencyRepository');
const config = require('../config/nexo-lp-config');

const cfg = config.currencies || {};

const COSTS = {
  generate: {
    stars: { stars: cfg.costs?.generate?.stars ?? 2, suns: 0, moons: 0 },
    suns: { stars: 0, suns: cfg.costs?.generate?.suns ?? 1, moons: 0 },
    moons: { stars: 0, suns: 0, moons: cfg.costs?.generate?.moons ?? 1 },
  },
  rebuild: {
    stars: cfg.costs?.rebuild?.stars ?? 1,
    suns: cfg.costs?.rebuild?.suns ?? 1,
    moons: cfg.costs?.rebuild?.moons ?? 0,
  },
  publish: {
    stars: cfg.costs?.publish?.stars ?? 1,
    suns: cfg.costs?.publish?.suns ?? 0,
    moons: cfg.costs?.publish?.moons ?? 0,
  },
  useTemplate: { stars: 0, suns: 0, moons: 0 },
};

const EXCHANGE = {
  sunsToStars: cfg.exchange?.sunsToStars ?? 10,
  moonsToSuns: cfg.exchange?.moonsToSuns ?? 5,
  moonsToStars: (cfg.exchange?.moonsToSuns ?? 5) * (cfg.exchange?.sunsToStars ?? 10),
};

class CurrencyService {
  /**
   * Get a user's balance
   * @param {string} userId
   * @returns {Promise<object>} { stars, suns, moons }
   */
  async getBalance(userId) {
    return CurrencyRepository.getBalance(userId);
  }

  /**
   * Check if a user can afford a given cost
   * @param {string} userId
   * @param {object} cost { stars, suns, moons }
   * @returns {Promise<boolean>}
   */
  async canAfford(userId, cost) {
    const balance = await this.getBalance(userId);
    return (
      balance.stars >= (cost.stars || 0) &&
      balance.suns >= (cost.suns || 0) &&
      balance.moons >= (cost.moons || 0)
    );
  }

  /**
   * Deduct cost for a specific operation
   * @param {string} userId
   * @param {string} operation - generate|rebuild|publish|useTemplate
   * @param {string} mode - stars|suns|moons (only for generate)
   * @returns {Promise<object>} { oldBalance, newBalance, cost }
   */
  async charge(userId, operation, mode = 'stars') {
    if (!userId) {
      throw new Error('userId is required');
    }

    const cost = this.getCost(operation, mode);
    const oldBalance = await CurrencyRepository.getBalance(userId);

    if (!await this.canAfford(userId, cost)) {
      throw new Error(`Insufficient balance: need ${this.formatCost(cost)}`);
    }

    const newBalance = await CurrencyRepository.deduct(userId, cost);
    return { oldBalance, newBalance, cost };
  }

  /**
   * Credit currencies (refunds, rewards)
   * @param {string} userId
   * @param {object} amounts { stars, suns, moons }
   * @returns {Promise<object>} new balance
   */
  async credit(userId, amounts) {
    return CurrencyRepository.credit(userId, amounts);
  }

  /**
   * Get cost for an operation
   * @param {string} operation
   * @param {string} mode
   * @returns {object} { stars, suns, moons }
   */
  getCost(operation, mode = 'stars') {
    if (operation === 'generate') {
      return COSTS.generate[mode] || COSTS.generate.stars;
    }
    return COSTS[operation] || { stars: 0, suns: 0, moons: 0 };
  }

  /**
   * Convert currencies using the internal exchange rate
   * @param {string} from - stars|suns|moons
   * @param {string} to - stars|suns|moons
   * @param {number} amount
   * @returns {number}
   */
  convert(from, to, amount) {
    if (from === to) return amount;
    if (from === 'suns' && to === 'stars') return amount * EXCHANGE.sunsToStars;
    if (from === 'moons' && to === 'suns') return amount * EXCHANGE.moonsToSuns;
    if (from === 'moons' && to === 'stars') return amount * EXCHANGE.moonsToStars;
    if (from === 'stars' && to === 'suns') return amount / EXCHANGE.sunsToStars;
    if (from === 'suns' && to === 'moons') return amount / EXCHANGE.moonsToSuns;
    if (from === 'stars' && to === 'moons') return amount / EXCHANGE.moonsToStars;
    return amount;
  }

  /**
   * Format a cost object for display
   * @param {object} cost
   * @returns {string}
   */
  formatCost(cost) {
    const parts = [];
    if (cost.stars) parts.push(`${cost.stars} ⭐`);
    if (cost.suns) parts.push(`${cost.suns} ☀️`);
    if (cost.moons) parts.push(`${cost.moons} 🌙`);
    return parts.join(' ') || 'free';
  }
}

module.exports = new CurrencyService();
module.exports.COSTS = COSTS;
module.exports.EXCHANGE = EXCHANGE;
