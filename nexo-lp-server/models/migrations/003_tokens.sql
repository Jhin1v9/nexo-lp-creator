-- ============================================================
-- Migration 003: Token Balances and Transactions
-- ============================================================
-- Manages the token economy: balances per user and transaction log.

CREATE TABLE IF NOT EXISTS token_balances (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL UNIQUE,
    balance INTEGER NOT NULL DEFAULT 50,
    total_earned INTEGER NOT NULL DEFAULT 50,
    total_spent INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS token_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    amount INTEGER NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('deduct', 'credit', 'refund', 'bonus')),
    action TEXT NOT NULL,             -- e.g., 'generate', 'deploy', 'rebuild', 'mining'
    session_id TEXT,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE SET NULL
);

-- Index for user balance lookups
CREATE INDEX IF NOT EXISTS idx_token_balances_user_id ON token_balances(user_id);

-- Index for transaction history
CREATE INDEX IF NOT EXISTS idx_token_transactions_user_id ON token_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_token_transactions_created_at ON token_transactions(created_at);
