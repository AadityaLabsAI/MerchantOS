-- 001_foundation.sql

CREATE TYPE role_kind AS ENUM ('OWNER', 'MANAGER', 'CASHIER', 'ACCOUNTANT', 'STAFF');

CREATE TABLE merchants (
  id text PRIMARY KEY,
  name text NOT NULL,
  owner_email text NOT NULL UNIQUE,
  phone text,
  settings jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE stores (
  id text PRIMARY KEY,
  merchant_id text NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  name text NOT NULL,
  address text,
  city text,
  state text,
  pincode text,
  phone text,
  settings jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_stores_merchant ON stores(merchant_id);

CREATE TABLE users (
  id text PRIMARY KEY,
  merchant_id text NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  email text NOT NULL,
  name text NOT NULL,
  password_hash text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  last_login_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(merchant_id, email)
);

CREATE TABLE store_memberships (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  store_id text NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  merchant_id text NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  role role_kind NOT NULL,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, store_id)
);
CREATE INDEX idx_sm_user ON store_memberships(user_id);
CREATE INDEX idx_sm_store ON store_memberships(store_id);

CREATE TABLE permission_catalog (
  key text PRIMARY KEY,
  description text NOT NULL
);

CREATE TABLE role_permissions (
  role role_kind NOT NULL,
  permission_key text NOT NULL REFERENCES permission_catalog(key) ON DELETE CASCADE,
  PRIMARY KEY (role, permission_key)
);

INSERT INTO permission_catalog (key, description) VALUES
  ('billing:create', 'Create bills'),
  ('billing:view', 'View bills'),
  ('billing:cancel', 'Cancel bills'),
  ('billing:refund', 'Issue refunds'),
  ('inventory:view', 'View inventory'),
  ('inventory:edit', 'Edit products / stock'),
  ('expenses:create', 'Record expenses'),
  ('expenses:view', 'View expenses'),
  ('purchases:view', 'View purchase orders'),
  ('purchases:create', 'Create purchase orders'),
  ('purchases:edit', 'Edit purchase orders'),
  ('suppliers:view', 'View suppliers'),
  ('suppliers:create', 'Create suppliers'),
  ('suppliers:edit', 'Edit suppliers'),
  ('customers:view', 'View customers'),
  ('customers:create', 'Create customers'),
  ('customers:edit', 'Edit customers'),
  ('khata:adjust', 'Adjust customer ledger'),
  ('reports:view', 'View reports'),
  ('shifts:view', 'View shifts'),
  ('shifts:manage', 'Open / close shifts'),
  ('shifts:close', 'Close a shift opened by another user'),
  ('payments:refund', 'Refund a payment'),
  ('payments:view', 'View payments'),
  ('staff:manage', 'Add/edit/remove staff'),
  ('settings:edit', 'Edit merchant settings'),
  ('devices:manage', 'Add/remove devices'),
  ('assistant:use', 'Use AI assistant')
ON CONFLICT (key) DO NOTHING;
