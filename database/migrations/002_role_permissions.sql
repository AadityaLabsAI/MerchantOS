-- 002_role_permissions.sql

INSERT INTO role_permissions (role, permission_key)
SELECT 'OWNER', key FROM permission_catalog
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role, permission_key) VALUES
  ('MANAGER','billing:create'),('MANAGER','billing:view'),('MANAGER','billing:cancel'),('MANAGER','billing:refund'),
  ('MANAGER','inventory:view'),('MANAGER','inventory:edit'),
  ('MANAGER','expenses:create'),('MANAGER','expenses:view'),
  ('MANAGER','purchases:view'),('MANAGER','purchases:create'),
  ('MANAGER','suppliers:view'),
  ('MANAGER','customers:view'),('MANAGER','customers:create'),('MANAGER','customers:edit'),
  ('MANAGER','khata:adjust'),
  ('MANAGER','reports:view'),
  ('MANAGER','shifts:view'),('MANAGER','shifts:manage'),
  ('MANAGER','payments:view'),
  ('MANAGER','assistant:use'),
  ('CASHIER','billing:create'),('CASHIER','billing:view'),
  ('CASHIER','inventory:view'),
  ('CASHIER','customers:view'),('CASHIER','customers:create'),
  ('CASHIER','shifts:view'),('CASHIER','shifts:manage'),
  ('CASHIER','payments:view'),
  ('ACCOUNTANT','billing:view'),
  ('ACCOUNTANT','expenses:create'),('ACCOUNTANT','expenses:view'),
  ('ACCOUNTANT','purchases:view'),('ACCOUNTANT','purchases:create'),('ACCOUNTANT','purchases:edit'),
  ('ACCOUNTANT','suppliers:view'),
  ('ACCOUNTANT','customers:view'),
  ('ACCOUNTANT','reports:view'),
  ('ACCOUNTANT','shifts:view'),
  ('ACCOUNTANT','payments:view'),
  ('STAFF','billing:view'),
  ('STAFF','inventory:view'),
  ('STAFF','customers:view'),
  ('STAFF','shifts:view')
ON CONFLICT DO NOTHING;
