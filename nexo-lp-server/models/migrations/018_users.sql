-- ============================================================
-- Migration 018: Users Table
-- ============================================================
-- Central user directory for the admin redesign.

CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT,
    name TEXT,
    status TEXT NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'blocked')),
    role TEXT NOT NULL DEFAULT 'user'
        CHECK (role IN ('user', 'admin')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_seen_at DATETIME,
    metadata_json TEXT
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);

-- Backfill existing user ids from related tables
INSERT OR IGNORE INTO users (
    id,
    email,
    name,
    status,
    role,
    created_at,
    updated_at,
    last_seen_at,
    metadata_json
)
SELECT
    user_id,
    user_id || '@backfill.local',
    NULL,
    'active',
    'user',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP,
    NULL,
    NULL
FROM (
    SELECT DISTINCT user_id FROM sessions WHERE user_id IS NOT NULL AND user_id <> ''
    UNION
    SELECT DISTINCT user_id FROM template_purchases WHERE user_id IS NOT NULL AND user_id <> ''
    UNION
    SELECT DISTINCT user_id FROM user_currencies WHERE user_id IS NOT NULL AND user_id <> ''
);
