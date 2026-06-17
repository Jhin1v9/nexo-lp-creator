-- ============================================================
-- Migration 011: LOJA Rich Metadata
-- Adds subcategory and Kimi-generated metadata for marketplace.
-- ============================================================

ALTER TABLE templates ADD COLUMN subcategory TEXT;
ALTER TABLE templates ADD COLUMN metadata_json TEXT; -- JSON: tags, niche, audience, difficulty, features, colors, style, seoKeywords, badges, whyBuy, useCases

CREATE INDEX IF NOT EXISTS idx_templates_subcategory ON templates(subcategory);
