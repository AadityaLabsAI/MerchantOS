-- 006_suppliers.sql

CREATE TABLE suppliers (
  id text PRIMARY KEY,
  merchant_id text NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  store_id text NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  name text NOT NULL,
  phone text,
  email text,
  address text,
  gstin text,
  balance_minor text NOT NULL DEFAULT '0',
  balance_currency text NOT NULL DEFAULT 'INR',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_suppliers_store ON suppliers(store_id);

CREATE TABLE supplier_purchases (
  id text PRIMARY KEY,
  merchant_id text NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  store_id text NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  supplier_id text NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
  invoice_number text,
  state text NOT NULL DEFAULT 'RECEIVED',
  total_minor text NOT NULL,
  currency text NOT NULL DEFAULT 'INR',
  notes text,
  created_by text REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_sp_supplier ON supplier_purchases(supplier_id);

CREATE TYPE expense_kind AS ENUM ('RENT', 'UTILITIES', 'SALARY', 'INVENTORY', 'MAINTENANCE', 'MARKETING', 'TRAVEL', 'MISC');

CREATE TABLE expenses (
  id text PRIMARY KEY,
  merchant_id text NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  store_id text NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  category expense_kind NOT NULL,
  amount_minor text NOT NULL,
  currency text NOT NULL DEFAULT 'INR',
  description text NOT NULL,
  receipt_url text,
  vendor text,
  paid_at timestamptz NOT NULL DEFAULT now(),
  created_by text REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_expenses_store ON expenses(store_id);
CREATE INDEX idx_expenses_paid ON expenses(paid_at);
