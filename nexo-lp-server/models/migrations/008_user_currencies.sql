-- ============================================================
-- Migration 008: User Currencies Table
-- ============================================================
-- Stores virtual currency balances for the multi-mode economy:
-- stars (Estrelas), suns (Sóis), moons (Lunas).

CREATE TABLE IF NOT EXISTS user_currencies (
    user_id TEXT PRIMARY KEY,
    stars INTEGER NOT NULL DEFAULT 0,
    suns INTEGER NOT NULL DEFAULT 0,
    moons INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_user_currencies_user_id ON user_currencies(user_id);
