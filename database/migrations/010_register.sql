-- 010_mark_applied.sql - register all migrations
INSERT INTO schema_migrations (version, description) VALUES
  ('001_foundation', 'merchants, stores, users, roles, permissions'),
  ('002_role_permissions', 'OWNER/MANAGER/CASHIER/ACCOUNTANT/STAFF matrix'),
  ('003_catalog', 'products + stock movements'),
  ('004_customers', 'customers + khata ledger'),
  ('005_bills', 'bills + bill_items'),
  ('006_suppliers', 'suppliers + purchases + expenses'),
  ('007_shifts', 'shifts + entries'),
  ('008_payments', 'payment_sessions + payments + notification outbox'),
  ('009_devices_auth_audit', 'devices + refresh tokens + audit + AI memory')
ON CONFLICT (version) DO NOTHING;
