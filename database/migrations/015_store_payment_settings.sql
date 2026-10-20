-- Merchant-configurable UPI receiving details. Intentionally no Data API policies:
-- the application accesses this table through its server-side PostgreSQL role.
-- If Supabase's Data API is enabled, anon/authenticated clients cannot read these
-- rows directly; merchant settings must go through the authenticated MerchantOS API.
CREATE TABLE IF NOT EXISTS store_payment_settings (
  store_id text PRIMARY KEY REFERENCES stores(id) ON DELETE CASCADE,
  merchant_id text NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  upi_vpa text NOT NULL,
  payee_name text NOT NULL,
  phone text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT store_payment_settings_vpa_length CHECK (length(trim(upi_vpa)) BETWEEN 3 AND 300),
  CONSTRAINT store_payment_settings_payee_length CHECK (length(trim(payee_name)) BETWEEN 1 AND 80),
  CONSTRAINT store_payment_settings_phone_length CHECK (phone IS NULL OR length(phone) <= 20)
);

CREATE INDEX IF NOT EXISTS idx_store_payment_settings_merchant
  ON store_payment_settings(merchant_id);

ALTER TABLE store_payment_settings ENABLE ROW LEVEL SECURITY;

-- Supabase provides these roles; local PostgreSQL CI might not. Keep the
-- migration portable while explicitly denying direct Data API table grants.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON TABLE store_payment_settings FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON TABLE store_payment_settings FROM authenticated;
  END IF;
END
$$;
