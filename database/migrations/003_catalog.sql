-- 003_catalog.sql

CREATE TABLE products (
  id text PRIMARY KEY,
  merchant_id text NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  store_id text NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  sku text NOT NULL,
  barcode text,
  name text NOT NULL,
  category text,
  description text,
  price_minor text NOT NULL,
  cost_minor text NOT NULL DEFAULT '0',
  currency text NOT NULL DEFAULT 'INR',
  tax_bps integer NOT NULL DEFAULT 0,
  stock_count bigint NOT NULL DEFAULT 0,
  low_stock_threshold bigint NOT NULL DEFAULT 5,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(store_id, sku)
);
CREATE INDEX idx_products_store ON products(store_id);
CREATE INDEX idx_products_barcode ON products(barcode) WHERE barcode IS NOT NULL;

CREATE TYPE stock_movement_kind AS ENUM ('PURCHASE', 'SALE', 'RETURN', 'ADJUSTMENT', 'DAMAGE');

CREATE TABLE stock_movements (
  id text PRIMARY KEY,
  merchant_id text NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  store_id text NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  product_id text NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  type stock_movement_kind NOT NULL,
  quantity bigint NOT NULL,
  unit_cost_minor text,
  reference_bill_id text,
  reference_purchase_id text,
  actor_user_id text REFERENCES users(id) ON DELETE SET NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_stock_movements_product ON stock_movements(product_id);
