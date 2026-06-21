-- ============================================================
-- Migration 016: Template approved/rejected statuses
-- Adds explicit admin review statuses to the templates table.
-- SQLite does not support ALTER TABLE DROP CHECK, so we recreate the table.
-- ============================================================

CREATE TABLE templates_new (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    category TEXT NOT NULL DEFAULT 'landing'
        CHECK (category IN ('business', 'startup', 'portfolio', 'ecommerce', 'saas', 'agency', 'personal', 'event', 'landing', 'other')),
    subcategory TEXT,
    stack TEXT NOT NULL DEFAULT 'react-tailwind',
    thumbnail_url TEXT,
    html TEXT,
    css TEXT,
    js TEXT,
    config TEXT,
    tags TEXT,
    source TEXT,
    usage_count INTEGER NOT NULL DEFAULT 0,
    rating REAL DEFAULT 0,
    is_public BOOLEAN NOT NULL DEFAULT 1,
    created_by TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    price_stars INTEGER NOT NULL DEFAULT 0,
    price_suns INTEGER NOT NULL DEFAULT 0,
    price_moons INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'available'
        CHECK (status IN ('sanitizing', 'available', 'failed', 'unreviewed', 'approved', 'rejected')),
    original_html TEXT,
    sanitized_html TEXT,
    sanitization_log TEXT,
    public_preview_token TEXT,
    prompt_hash TEXT,
    prompt_censored TEXT,
    session_id TEXT,
    kimi_chat_url TEXT,
    metadata_json TEXT,
    reviewed_at DATETIME,
    unreviewed_reason TEXT,
    original_price_stars INTEGER,
    original_price_suns INTEGER,
    original_price_moons INTEGER
);

INSERT INTO templates_new (
    id, name, description, category, subcategory, stack, thumbnail_url,
    html, css, js, config, tags, source, usage_count, rating, is_public,
    created_by, created_at, updated_at,
    price_stars, price_suns, price_moons,
    status, original_html, sanitized_html, sanitization_log,
    public_preview_token, prompt_hash, prompt_censored,
    session_id, kimi_chat_url, metadata_json,
    reviewed_at, unreviewed_reason,
    original_price_stars, original_price_suns, original_price_moons
)
SELECT
    id, name, description, category, subcategory, stack, thumbnail_url,
    html, css, js, config, tags, source, usage_count, rating, is_public,
    created_by, created_at, updated_at,
    price_stars, price_suns, price_moons,
    status, original_html, sanitized_html, sanitization_log,
    public_preview_token, prompt_hash, prompt_censored,
    session_id, kimi_chat_url, metadata_json,
    reviewed_at, unreviewed_reason,
    original_price_stars, original_price_suns, original_price_moons
FROM templates;

DROP TABLE templates;
ALTER TABLE templates_new RENAME TO templates;

-- Recreate indexes
CREATE INDEX IF NOT EXISTS idx_templates_category ON templates(category);
CREATE INDEX IF NOT EXISTS idx_templates_stack ON templates(stack);
CREATE INDEX IF NOT EXISTS idx_templates_name ON templates(name);
CREATE INDEX IF NOT EXISTS idx_templates_public ON templates(is_public) WHERE is_public = 1;
CREATE INDEX IF NOT EXISTS idx_templates_status ON templates(status);
CREATE INDEX IF NOT EXISTS idx_templates_public_preview_token ON templates(public_preview_token);
CREATE INDEX IF NOT EXISTS idx_templates_session_id ON templates(session_id);
CREATE INDEX IF NOT EXISTS idx_templates_subcategory ON templates(subcategory);
