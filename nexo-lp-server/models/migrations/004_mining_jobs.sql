-- ============================================================
-- Migration 004: Mining Jobs Table
-- ============================================================
-- Tracks template mining pipeline jobs.

CREATE TABLE IF NOT EXISTS mining_jobs (
    id TEXT PRIMARY KEY,
    url TEXT NOT NULL,
    user_id TEXT,
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'queued', 'scraping', 'analyzing', 'extracting', 'completed', 'failed')),
    progress INTEGER NOT NULL DEFAULT 0
        CHECK (progress >= 0 AND progress <= 100),
    result TEXT,                      -- JSON string with mined template data
    error_message TEXT,
    queue_position INTEGER,
    started_at DATETIME,
    completed_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Index for status-based polling
CREATE INDEX IF NOT EXISTS idx_mining_jobs_status ON mining_jobs(status);

-- Index for user jobs
CREATE INDEX IF NOT EXISTS idx_mining_jobs_user_id ON mining_jobs(user_id);

-- Index for queue ordering
CREATE INDEX IF NOT EXISTS idx_mining_jobs_queue_position ON mining_jobs(queue_position);
