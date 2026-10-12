-- 013_ai_merchant.sql
-- Add merchant_id to ai_messages for tenancy defense-in-depth and report joins.
ALTER TABLE ai_messages
  ADD COLUMN IF NOT EXISTS merchant_id text REFERENCES merchants(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_ai_messages_merchant
  ON ai_messages(merchant_id, created_at DESC);
