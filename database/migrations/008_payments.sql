-- 008_payments.sql

CREATE TYPE payment_session_state AS ENUM ('CREATED', 'PENDING', 'PROCESSING', 'SUCCESS', 'VERIFIED', 'FAILED', 'EXPIRED', 'CANCELLED');
CREATE TYPE payment_event_kind AS ENUM ('payment.created', 'payment.processing', 'payment.succeeded', 'payment.failed', 'payment.expired', 'payment.refunded', 'payment.cancelled');

CREATE TABLE payment_sessions (
  id text PRIMARY KEY,
  payment_token text NOT NULL UNIQUE,
  merchant_id text NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  store_id text NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  device_id text,
  bill_id text REFERENCES bills(id) ON DELETE SET NULL,
  customer_id text REFERENCES customers(id) ON DELETE SET NULL,
  provider text NOT NULL DEFAULT 'local',
  provider_session_id text NOT NULL,
  provider_payment_id text,
  amount_minor text NOT NULL,
  currency text NOT NULL DEFAULT 'INR',
  description text,
  state payment_session_state NOT NULL DEFAULT 'CREATED',
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  paid_at timestamptz,
  verified_at timestamptz,
  failed_at timestamptz,
  failure_reason text
);
CREATE INDEX idx_ps_state ON payment_sessions(state);
CREATE INDEX idx_ps_merchant ON payment_sessions(merchant_id);
CREATE INDEX idx_ps_bill ON payment_sessions(bill_id);

CREATE TABLE payment_events (
  id text PRIMARY KEY,
  payment_session_id text NOT NULL REFERENCES payment_sessions(id) ON DELETE CASCADE,
  provider_event_id text NOT NULL,
  event_type payment_event_kind NOT NULL,
  previous_state payment_session_state,
  new_state payment_session_state,
  amount_minor text,
  currency text,
  raw jsonb,
  occurred_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(payment_session_id, provider_event_id)
);

CREATE TABLE payments (
  id text PRIMARY KEY,
  payment_session_id text NOT NULL UNIQUE REFERENCES payment_sessions(id) ON DELETE CASCADE,
  merchant_id text NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  provider text NOT NULL,
  provider_payment_id text NOT NULL,
  amount_minor text NOT NULL,
  currency text NOT NULL DEFAULT 'INR',
  payment_method text,
  paid_at timestamptz NOT NULL,
  verified_at timestamptz,
  raw_provider jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_payments_merchant ON payments(merchant_id);

CREATE TABLE notification_events (
  id text PRIMARY KEY,
  merchant_id text NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  store_id text REFERENCES stores(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  dedup_key text NOT NULL UNIQUE,
  payload jsonb NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_notification_unread ON notification_events(created_at) WHERE consumed_at IS NULL;
