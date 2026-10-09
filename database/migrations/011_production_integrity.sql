-- 011_production_integrity.sql
-- Repair gaps in supplier receiving and make merchant reporting timezone-aware.
ALTER TABLE stores
  ADD COLUMN IF NOT EXISTS timezone text NOT NULL DEFAULT 'Asia/Kolkata';

CREATE TABLE IF NOT EXISTS supplier_purchase_items (
  id text PRIMARY KEY,
  purchase_id text NOT NULL REFERENCES supplier_purchases(id) ON DELETE CASCADE,
  merchant_id text NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  store_id text NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  product_id text NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  quantity bigint NOT NULL CHECK (quantity > 0),
  unit_cost_minor text NOT NULL CHECK (unit_cost_minor ~ '^[0-9]+$'),
  line_total_minor text NOT NULL CHECK (line_total_minor ~ '^[0-9]+$'),
  currency text NOT NULL CHECK (char_length(currency) = 3),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_supplier_purchase_items_purchase
  ON supplier_purchase_items(purchase_id);
CREATE INDEX IF NOT EXISTS idx_supplier_purchase_items_store
  ON supplier_purchase_items(merchant_id, store_id, created_at DESC);

-- If stock_movements.type is an enum, add the PURCHASE event without assuming
-- the enum's physical name. If it is text, no schema change is necessary.
DO $$
DECLARE movement_type text;
BEGIN
  SELECT udt_name INTO movement_type
    FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'stock_movements' AND column_name = 'type';
  IF movement_type IS NOT NULL AND EXISTS (
    SELECT 1 FROM pg_type WHERE typname = movement_type AND typtype = 'e'
  ) THEN
    EXECUTE format('ALTER TYPE %I ADD VALUE IF NOT EXISTS %L', movement_type, 'PURCHASE');
  END IF;
END $$;

INSERT INTO schema_migrations (version, description)
VALUES ('011_production_integrity', 'Supplier purchase lines and store timezone')
ON CONFLICT (version) DO NOTHING;
