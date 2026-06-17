-- ============================================================
-- Migration 009: Template Prices
-- ============================================================
-- Adds virtual currency prices to the templates table so the LOJA
-- can sell generated/sanitized landing pages.

ALTER TABLE templates ADD COLUMN price_stars INTEGER NOT NULL DEFAULT 0;
ALTER TABLE templates ADD COLUMN price_suns INTEGER NOT NULL DEFAULT 0;
ALTER TABLE templates ADD COLUMN price_moons INTEGER NOT NULL DEFAULT 0;
