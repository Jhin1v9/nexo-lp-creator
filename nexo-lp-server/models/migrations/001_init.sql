-- Migration 001: Initialize Sessions Table

CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    project_id TEXT,
    status TEXT NOT NULL DEFAULT 'created'
        CHECK (status IN ('created', 'intention', 'structure', 'code', 'review', 'preview', 'deployed', 'failed', 'archived')),
    initial_prompt TEXT,
    stack TEXT NOT NULL DEFAULT 'static-html-tailwind',
    intention_json TEXT,
    design_json TEXT,
    current_html TEXT,
    generated_css TEXT,
    generated_js TEXT,
    metadata_json TEXT,
    preview_url TEXT,
    deploy_url TEXT,
    version INTEGER NOT NULL DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);
CREATE INDEX IF NOT EXISTS idx_sessions_created_at ON sessions(created_at);
