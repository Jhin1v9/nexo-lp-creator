-- ============================================================
-- Migration 019: Allow paused status on mining_jobs
-- ============================================================
-- The admin UI can pause/resume mining jobs, but the original
-- CHECK constraint did not include 'paused'.

PRAGMA foreign_keys = OFF;

BEGIN TRANSACTION;

ALTER TABLE mining_jobs RENAME TO mining_jobs_old;

CREATE TABLE mining_jobs (
    id TEXT PRIMARY KEY,
    url TEXT NOT NULL,
    user_id TEXT,
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'queued', 'scraping', 'analyzing', 'extracting', 'completed', 'failed', 'paused')),
    progress INTEGER NOT NULL DEFAULT 0
        CHECK (progress >= 0 AND progress <= 100),
    result TEXT,
    error_message TEXT,
    queue_position INTEGER,
    started_at DATETIME,
    completed_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO mining_jobs
SELECT * FROM mining_jobs_old;

DROP TABLE mining_jobs_old;

CREATE INDEX IF NOT EXISTS idx_mining_jobs_status ON mining_jobs(status);
CREATE INDEX IF NOT EXISTS idx_mining_jobs_user_id ON mining_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_mining_jobs_queue_position ON mining_jobs(queue_position);

COMMIT;

PRAGMA foreign_keys = ON;
