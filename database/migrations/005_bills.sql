-- 005_bills.sql

CREATE TYPE bill_state AS ENUM ('DRAFT', 'FINALIZED', 'REFUNDED', 'CANCELLED', 'PAYMENT_PENDING', 'PAYMENT_FAILED');

CREATE TABLE bills (
  id text PRIMARY KEY,
  merchant_id text NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  store_id text NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  customer_id text REFERENCES customers(id) ON DELETE SET NULL,
  state bill_state NOT NULL DEFAULT 'DRAFT',
  subtotal_minor text NOT NULL,
  tax_minor text NOT NULL,
  total_minor text NOT NULL,
  currency text NOT NULL DEFAULT 'INR',
  notes text,
  created_by text REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_bills_state ON bills(state);
CREATE INDEX idx_bills_store ON bills(store_id);
CREATE INDEX idx_bills_customer ON bills(customer_id);

CREATE TABLE bill_items (
  id text PRIMARY KEY,
  bill_id text NOT NULL REFERENCES bills(id) ON DELETE CASCADE,
  product_id text NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  name text NOT NULL,
  quantity bigint NOT NULL,
  unit_price_minor text NOT NULL,
  line_total_minor text NOT NULL,
  tax_bps integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_bill_items_bill ON bill_items(bill_id);
