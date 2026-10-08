-- 004_customers.sql

CREATE TABLE customers (
  id text PRIMARY KEY,
  merchant_id text NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  store_id text NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  name text NOT NULL,
  phone text,
  email text,
  address text,
  notes text,
  balance_minor text NOT NULL DEFAULT '0',
  balance_currency text NOT NULL DEFAULT 'INR',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
CREATE INDEX idx_customers_store ON customers(store_id);
CREATE INDEX idx_customers_phone ON customers(store_id, phone) WHERE phone IS NOT NULL;

CREATE TYPE ledger_entry_kind AS ENUM ('CREDIT', 'DEBIT', 'PAYMENT', 'ADJUSTMENT');

CREATE TABLE customer_ledger_entries (
  id text PRIMARY KEY,
  customer_id text NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  merchant_id text NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  store_id text NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  type ledger_entry_kind NOT NULL,
  amount_minor text NOT NULL,
  currency text NOT NULL DEFAULT 'INR',
  description text,
  reference_bill_id text,
  reference_payment_id text,
  actor_user_id text REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_cle_customer ON customer_ledger_entries(customer_id);
