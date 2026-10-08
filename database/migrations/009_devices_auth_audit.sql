-- 009_devices_auth_audit.sql

CREATE TABLE devices (
  id text PRIMARY KEY,
  merchant_id text NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  store_id text NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  name text NOT NULL,
  kind text NOT NULL DEFAULT 'pos',
  api_key_hash text NOT NULL,
  last_seen_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE refresh_tokens (
  jti text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  replaced_by text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_rt_user ON refresh_tokens(user_id);

CREATE TABLE audit_log (
  id text PRIMARY KEY,
  merchant_id text NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  store_id text REFERENCES stores(id) ON DELETE SET NULL,
  actor_user_id text REFERENCES users(id) ON DELETE SET NULL,
  action text NOT NULL,
  target_type text NOT NULL,
  target_id text,
  request_id text,
  ip text,
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_merchant ON audit_log(merchant_id);
CREATE INDEX idx_audit_target ON audit_log(target_type, target_id);
CREATE INDEX idx_audit_actor ON audit_log(actor_user_id);

CREATE TABLE ai_conversations (
  id text PRIMARY KEY,
  merchant_id text NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  store_id text NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE ai_messages (
  id text PRIMARY KEY,
  conversation_id text NOT NULL REFERENCES ai_conversations(id) ON DELETE CASCADE,
  role text NOT NULL,
  content text NOT NULL,
  prompt_tokens integer,
  completion_tokens integer,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_aim_conv ON ai_messages(conversation_id);
