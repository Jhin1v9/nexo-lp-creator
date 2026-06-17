-- ============================================================
-- Migration 011: Add kimi_chat_url column to sessions
-- ============================================================

ALTER TABLE sessions ADD COLUMN kimi_chat_url TEXT;

CREATE INDEX IF NOT EXISTS idx_sessions_kimi_chat_url ON sessions(kimi_chat_url);
