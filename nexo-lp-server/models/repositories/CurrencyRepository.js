/**
 * NEXO Landing Page Creator v3.0 - Currency Repository
 *
 * Manages virtual currency balances: stars (Estrelas),
 * suns (Sóis), and moons (Lunas).
 *
 * @module models/repositories/CurrencyRepository
 * @version 3.0.0
 */

const { query, queryOne, run } = require('../sqlite');

const DEFAULT_BALANCE = {
  stars: 50,
  suns: 5,
  moons: 1,
};

class CurrencyRepository {
  /**
   * Get or create a user's balance
   * @param {string} userId
   * @returns {object} { userId, stars, suns, moons }
   */
  async getBalance(userId) {
    if (!userId) {
      throw new Error('userId is required');
    }

    let row = await queryOne('SELECT * FROM user_currencies WHERE user_id = ?', [userId]);

    if (!row) {
      await run(
        `INSERT INTO user_currencies (user_id, stars, suns, moons)
         VALUES (?, ?, ?, ?)`,
        [userId, DEFAULT_BALANCE.stars, DEFAULT_BALANCE.suns, DEFAULT_BALANCE.moons]
      );
      row = await queryOne('SELECT * FROM user_currencies WHERE user_id = ?', [userId]);
    }

    return {
      userId: row.user_id,
      stars: row.stars,
      suns: row.suns,
      moons: row.moons,
    };
  }

  /**
   * Deduct currencies from a user's balance
   * @param {string} userId
   * @param {object} costs { stars, suns, moons }
   * @returns {object} updated balance
   */
  async deduct(userId, costs) {
    const balance = await this.getBalance(userId);

    const stars = costs.stars || 0;
    const suns = costs.suns || 0;
    const moons = costs.moons || 0;

    if (balance.stars < stars || balance.suns < suns || balance.moons < moons) {
      throw new Error('Insufficient currency balance');
    }

    await run(
      `UPDATE user_currencies
       SET stars = stars - ?, suns = suns - ?, moons = moons - ?, updated_at = CURRENT_TIMESTAMP
       WHERE user_id = ?`,
      [stars, suns, moons, userId]
    );

    return this.getBalance(userId);
  }

  /**
   * Credit currencies to a user's balance
   * @param {string} userId
   * @param {object} amounts { stars, suns, moons }
   * @returns {object} updated balance
   */
  async credit(userId, amounts) {
    if (!userId) {
      throw new Error('userId is required');
    }

    await this.getBalance(userId); // ensure row exists

    await run(
      `UPDATE user_currencies
       SET stars = stars + ?, suns = suns + ?, moons = moons + ?, updated_at = CURRENT_TIMESTAMP
       WHERE user_id = ?`,
      [amounts.stars || 0, amounts.suns || 0, amounts.moons || 0, userId]
    );

    return this.getBalance(userId);
  }

  /**
   * Set a user's balance explicitly (admin/refund use)
   * @param {string} userId
   * @param {object} amounts { stars, suns, moons }
   * @returns {object} updated balance
   */
  async setBalance(userId, amounts) {
    if (!userId) {
      throw new Error('userId is required');
    }

    await run(
      `INSERT INTO user_currencies (user_id, stars, suns, moons)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET
         stars = excluded.stars,
         suns = excluded.suns,
         moons = excluded.moons,
         updated_at = CURRENT_TIMESTAMP`,
      [userId, amounts.stars || 0, amounts.suns || 0, amounts.moons || 0]
    );

    return this.getBalance(userId);
  }
}

module.exports = new CurrencyRepository();
