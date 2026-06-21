-- ============================================================
-- Migration 017: Add status to template_purchases
-- Adds a status column so the admin panel can display purchase state.
-- ============================================================

ALTER TABLE template_purchases ADD COLUMN status TEXT NOT NULL DEFAULT 'completed';

CREATE INDEX IF NOT EXISTS idx_template_purchases_status ON template_purchases(status);
