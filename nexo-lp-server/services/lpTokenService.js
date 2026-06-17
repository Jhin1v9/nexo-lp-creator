/**
 * NEXO Landing Page Creator v3.0 - Token Service
 * Manages the token economy. Async SQLite operations.
 */

const { query, queryOne, run } = require('../models/sqlite');

const DEFAULT_BALANCE = 50;
const COSTS = {
  generate: 10,
  deploy: 5,
  rebuild: 5,
  mining: 2,
  template: 3,
};

class TokenService {
  /**
   * Ensure user has a token balance record
   */
  async ensureBalance(userId) {
    const existing = await queryOne('SELECT * FROM token_balances WHERE user_id = ?', [userId]);

    if (!existing) {
      const now = new Date().toISOString();
      await run(
        'INSERT INTO token_balances (user_id, balance, total_earned, total_spent, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
        [userId, DEFAULT_BALANCE, DEFAULT_BALANCE, 0, now, now]
      );
      await run(
        'INSERT INTO token_transactions (user_id, amount, type, action, description, created_at) VALUES (?, ?, ?, ?, ?, ?)',
        [userId, DEFAULT_BALANCE, 'credit', 'signup', 'Initial token grant for new user', now]
      );

      return {
        userId,
        balance: DEFAULT_BALANCE,
        totalEarned: DEFAULT_BALANCE,
        totalSpent: 0,
      };
    }

    return {
      userId: existing.user_id,
      balance: existing.balance,
      totalEarned: existing.total_earned,
      totalSpent: existing.total_spent,
    };
  }

  /**
   * Get token balance for a user
   */
  async getBalance(userId) {
    if (!userId) throw new Error('userId is required');
    const balance = await this.ensureBalance(userId);
    return balance.balance;
  }

  /**
   * Get full balance details
   */
  async getBalanceDetails(userId) {
    if (!userId) throw new Error('userId is required');
    const balance = await this.ensureBalance(userId);

    const transactions = await query(
      'SELECT * FROM token_transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT 20',
      [userId]
    );

    return {
      ...balance,
      recentTransactions: transactions.map(t => ({
        id: t.id,
        amount: t.amount,
        type: t.type,
        action: t.action,
        sessionId: t.session_id,
        description: t.description,
        createdAt: t.created_at,
      })),
    };
  }

  /**
   * Deduct tokens
   */
  async deduct(userId, amount, action = 'generic', sessionId = null) {
    if (!userId) throw new Error('userId is required');
    if (!amount || amount <= 0) throw new Error('Amount must be positive');

    await this.ensureBalance(userId);

    const current = await queryOne('SELECT balance FROM token_balances WHERE user_id = ?', [userId]);

    if (current.balance < amount) {
      return {
        success: false,
        error: `Insufficient tokens. Required: ${amount}, Available: ${current.balance}`,
        balance: current.balance,
      };
    }

    const now = new Date().toISOString();
    await run(
      'UPDATE token_balances SET balance = balance - ?, total_spent = total_spent + ?, updated_at = ? WHERE user_id = ?',
      [amount, amount, now, userId]
    );
    await run(
      'INSERT INTO token_transactions (user_id, amount, type, action, session_id, description, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [userId, amount, 'deduct', action, sessionId, `Token deduction for ${action}`, now]
    );

    const updated = await queryOne('SELECT balance FROM token_balances WHERE user_id = ?', [userId]);

    return {
      success: true,
      remaining: updated.balance,
      deducted: amount,
    };
  }

  /**
   * Credit tokens
   */
  async credit(userId, amount, reason = 'bonus') {
    if (!userId) throw new Error('userId is required');
    if (!amount || amount <= 0) throw new Error('Amount must be positive');

    await this.ensureBalance(userId);

    const now = new Date().toISOString();
    await run(
      'UPDATE token_balances SET balance = balance + ?, total_earned = total_earned + ?, updated_at = ? WHERE user_id = ?',
      [amount, amount, now, userId]
    );
    await run(
      'INSERT INTO token_transactions (user_id, amount, type, action, description, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      [userId, amount, 'credit', reason, `Token credit: ${reason}`, now]
    );

    const updated = await queryOne('SELECT balance FROM token_balances WHERE user_id = ?', [userId]);
    return { userId, balance: updated.balance, credited: amount };
  }

  /**
   * Refund tokens
   */
  async refund(userId, amount, sessionId = null, reason = 'refund') {
    return this.credit(userId, amount, `refund-${reason}`);
  }

  /**
   * Check if user has enough tokens
   */
  async hasEnough(userId, requiredAmount) {
    const balance = await this.getBalance(userId);
    return balance >= requiredAmount;
  }

  /**
   * Get cost for an action
   */
  getActionCost(action) {
    return COSTS[action] || 1;
  }

  /**
   * Get all costs
   */
  getAllCosts() {
    return { ...COSTS };
  }

  /**
   * Get transaction history
   */
  async getTransactionHistory(userId, options = {}) {
    if (!userId) throw new Error('userId is required');
    const limit = options.limit || 50;
    const offset = options.offset || 0;

    const transactions = await query(
      'SELECT * FROM token_transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?',
      [userId, limit, offset]
    );

    return transactions.map(t => ({
      id: t.id,
      amount: t.amount,
      type: t.type,
      action: t.action,
      sessionId: t.session_id,
      description: t.description,
      createdAt: t.created_at,
    }));
  }

  /**
   * Get usage stats
   */
  async getUsageStats(userId) {
    if (!userId) throw new Error('userId is required');
    await this.ensureBalance(userId);

    const stats = await query(
      `SELECT action, COUNT(*) as count, SUM(amount) as total FROM token_transactions WHERE user_id = ? AND type = 'deduct' GROUP BY action`,
      [userId]
    );

    const balance = await queryOne('SELECT * FROM token_balances WHERE user_id = ?', [userId]);

    return {
      currentBalance: balance.balance,
      totalEarned: balance.total_earned,
      totalSpent: balance.total_spent,
      deductionsByAction: stats.reduce((acc, s) => {
        acc[s.action] = { count: s.count, total: s.total };
        return acc;
      }, {}),
    };
  }
}

module.exports = new TokenService();
