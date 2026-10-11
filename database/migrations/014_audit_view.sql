-- 014_audit_view.sql
-- Add the audit:view permission to the catalog and grant it to OWNER + MANAGER + ACCOUNTANT.
-- Required for the new GET /api/audit endpoint.
INSERT INTO permission_catalog (key, description) VALUES
  ('audit:view', 'View the merchant audit log')
ON CONFLICT (key) DO NOTHING;

INSERT INTO role_permissions (role, permission_key) VALUES
  ('OWNER',      'audit:view'),
  ('MANAGER',    'audit:view'),
  ('ACCOUNTANT', 'audit:view')
ON CONFLICT DO NOTHING;
