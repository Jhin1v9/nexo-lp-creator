-- ============================================================
-- Migration 006: Deployments Table
-- ============================================================
-- Tracks deployment history for landing pages.

CREATE TABLE IF NOT EXISTS deployments (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    user_id TEXT,
    type TEXT NOT NULL DEFAULT 'github',
    url TEXT,
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'in_progress', 'success', 'failed')),
    metadata TEXT,                    -- JSON string with deployment details
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_deployments_session_id ON deployments(session_id);
CREATE INDEX IF NOT EXISTS idx_deployments_status ON deployments(status);
CREATE INDEX IF NOT EXISTS idx_deployments_created_at ON deployments(created_at);
