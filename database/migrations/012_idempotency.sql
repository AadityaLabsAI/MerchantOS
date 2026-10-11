-- 012_idempotency.sql
-- Adds idempotency key support for retry-safe write operations.
-- When a client sends the same Idempotency-Key header twice (network retry,
-- double-tap, offline replay), the second request must return the same
-- response without creating a duplicate financial mutation.

CREATE TABLE IF NOT EXISTS idempotency_keys (
  key text PRIMARY KEY,
  merchant_id text NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  store_id text NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  endpoint text NOT NULL,
  request_hash text NOT NULL,
  response_status integer NOT NULL,
  response_body jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours')
);
CREATE INDEX IF NOT EXISTS idx_idempotency_expires
  ON idempotency_keys(expires_at);

-- Add idempotency_key column to bills so we can correlate bills ↔ keys
ALTER TABLE bills
  ADD COLUMN IF NOT EXISTS idempotency_key text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_bills_merchant_idem
  ON bills(merchant_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- Add idempotency_key column to payment_sessions too
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'payment_sessions') THEN
    ALTER TABLE payment_sessions
      ADD COLUMN IF NOT EXISTS idempotency_key text;
    BEGIN
      CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_sessions_merchant_idem
        ON payment_sessions(merchant_id, idempotency_key)
        WHERE idempotency_key IS NOT NULL;
    EXCEPTION WHEN duplicate_table THEN NULL;
    END;
  END IF;
END $$;

INSERT INTO schema_migrations (version, description)
VALUES ('012_idempotency', 'Idempotency keys for retry-safe writes')
ON CONFLICT (version) DO NOTHING;
