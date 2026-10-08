-- 007_shifts.sql

CREATE TYPE shift_state AS ENUM ('OPEN', 'CLOSED');

CREATE TABLE shifts (
  id text PRIMARY KEY,
  merchant_id text NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  store_id text NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  state shift_state NOT NULL DEFAULT 'OPEN',
  opened_by text NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  opened_at timestamptz NOT NULL DEFAULT now(),
  opening_cash_minor text NOT NULL DEFAULT '0',
  opening_cash_currency text NOT NULL DEFAULT 'INR',
  closed_by text REFERENCES users(id) ON DELETE SET NULL,
  closed_at timestamptz,
  closing_cash_minor text,
  closing_cash_currency text,
  expected_cash_minor text,
  expected_cash_currency text,
  notes text,
  total_sales_minor text,
  total_sales_currency text,
  total_expenses_minor text,
  total_expenses_currency text
);
CREATE INDEX idx_shifts_store ON shifts(store_id);
CREATE INDEX idx_shifts_state ON shifts(state);

CREATE TABLE shift_entries (
  id text PRIMARY KEY,
  shift_id text NOT NULL REFERENCES shifts(id) ON DELETE CASCADE,
  type text NOT NULL,
  amount_minor text NOT NULL,
  currency text NOT NULL DEFAULT 'INR',
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_se_shift ON shift_entries(shift_id);
