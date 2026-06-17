-- ============================================================
-- Migration 010: LOJA + Sanitization + Public Preview
-- ============================================================

ALTER TABLE templates ADD COLUMN status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('sanitizing', 'available', 'failed'));
ALTER TABLE templates ADD COLUMN original_html TEXT;
ALTER TABLE templates ADD COLUMN sanitized_html TEXT;
ALTER TABLE templates ADD COLUMN sanitization_log TEXT; -- JSON
ALTER TABLE templates ADD COLUMN public_preview_token TEXT;
ALTER TABLE templates ADD COLUMN prompt_hash TEXT;
ALTER TABLE templates ADD COLUMN prompt_censored TEXT;
ALTER TABLE templates ADD COLUMN session_id TEXT;
ALTER TABLE templates ADD COLUMN kimi_chat_url TEXT;

CREATE INDEX IF NOT EXISTS idx_templates_status ON templates(status);
CREATE INDEX IF NOT EXISTS idx_templates_public_preview_token ON templates(public_preview_token);
CREATE INDEX IF NOT EXISTS idx_templates_session_id ON templates(session_id);

CREATE TABLE IF NOT EXISTS template_purchases (
  id TEXT PRIMARY KEY,
  template_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  price_stars INTEGER NOT NULL DEFAULT 0,
  price_suns INTEGER NOT NULL DEFAULT 0,
  price_moons INTEGER NOT NULL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (template_id) REFERENCES templates(id)
);

CREATE INDEX IF NOT EXISTS idx_template_purchases_template_user ON template_purchases(template_id, user_id);
