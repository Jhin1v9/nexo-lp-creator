-- ============================================================
-- Migration 002: Session Versions Table
-- ============================================================
-- Tracks version history of generated landing pages.
-- Each revision creates a new version entry.

CREATE TABLE IF NOT EXISTS session_versions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    version_number INTEGER NOT NULL,
    html TEXT,
    css TEXT,
    js TEXT,
    metadata TEXT,                    -- JSON string with generation metadata
    change_summary TEXT,              -- Brief description of changes
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

-- Index for version lookup by session
CREATE INDEX IF NOT EXISTS idx_versions_session_id ON session_versions(session_id);

-- Composite index for ordered version retrieval
CREATE INDEX IF NOT EXISTS idx_versions_session_number ON session_versions(session_id, version_number);
