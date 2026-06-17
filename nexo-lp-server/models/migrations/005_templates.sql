-- ============================================================
-- Migration 005: Templates Table
-- ============================================================
-- Stores reusable landing page templates.

CREATE TABLE IF NOT EXISTS templates (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    category TEXT NOT NULL DEFAULT 'landing'
        CHECK (category IN ('business', 'startup', 'portfolio', 'ecommerce', 'saas', 'agency', 'personal', 'event', 'landing', 'other')),
    stack TEXT NOT NULL DEFAULT 'react-tailwind',
    thumbnail_url TEXT,
    html TEXT,
    css TEXT,
    js TEXT,
    config TEXT,                      -- JSON string with template configuration
    tags TEXT,                        -- Comma-separated tags
    source TEXT,                      -- 'mined', 'generated', 'manual'
    usage_count INTEGER NOT NULL DEFAULT 0,
    rating REAL DEFAULT 0,
    is_public BOOLEAN NOT NULL DEFAULT 1,
    created_by TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Index for category filtering
CREATE INDEX IF NOT EXISTS idx_templates_category ON templates(category);

-- Index for stack filtering
CREATE INDEX IF NOT EXISTS idx_templates_stack ON templates(stack);

-- Index for search by name
CREATE INDEX IF NOT EXISTS idx_templates_name ON templates(name);

-- Index for public templates
CREATE INDEX IF NOT EXISTS idx_templates_public ON templates(is_public) WHERE is_public = 1;
