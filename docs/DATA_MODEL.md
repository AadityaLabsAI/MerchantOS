# MerchantOS — Data Model

The database is PostgreSQL 15+ (verified against 18). All primary keys are
ULIDs encoded as 26-character Crockford-base32 strings (lexicographically
sortable, URL-safe). Every multi-tenant row carries `merchant_id`; every
store-scoped row carries `store_id`.

## 29 tables, grouped by domain

### Identity & access (5)
- `merchants(id, name, country, currency, created_at)` — the tenant.
- `stores(id, merchant_id, name, timezone, address, created_at)` — a
  physical or logical location of a merchant.
- `users(id, merchant_id, email UNIQUE, password_hash, password_salt, full_name, role, status, created_at, last_login_at)`.
- `refresh_tokens(id, user_id, token_hash, expires_at, created_at, revoked_at)`.
- `devices(id, store_id, user_id, name, last_seen_at, ...)` — POS terminals.

### Authorization (2)
- `permission_catalog(id, code UNIQUE, description)` — every action the
  system understands.
- `role_permissions(role, permission_id)` — many-to-many between roles
  (`OWNER`, `MANAGER`, `CASHIER`, `STAFF`) and permissions.
- `store_memberships(user_id, store_id)` — which stores a user can see.

### Catalog (1)
- `products(id, merchant_id, store_id, sku, name, description, category,
  price_minor text, currency, tax_bps, stock_minor text, unit, created_at, updated_at)`.
  - `price_minor` and `stock_minor` are `text` (BigInt in the API).
  - `tax_bps` is basis points (1800 = 18%).

### Customers & Khata (2)
- `customers(id, merchant_id, store_id, name, phone, address, email,
  opening_balance_minor, currency, created_at, updated_at)`.
- `customer_ledger_entries(id, customer_id, merchant_id, store_id,
  type, amount_minor, currency, ref_bill_id, ref_payment_id,
  description, created_at)`. `type ∈ {OPENING, SALE, PAYMENT, ADJUSTMENT}`.

### Billing (2)
- `bills(id, merchant_id, store_id, customer_id, state, subtotal_minor,
  tax_minor, total_minor, currency, idempotency_key UNIQUE NULLS NOT DISTINCT,
  created_at, finalized_at)`. `state ∈ {DRAFT, FINALIZED, VOID}`.
- `bill_items(id, bill_id, product_id, name, quantity, unit_price_minor,
  line_total_minor, tax_bps)`.

### Inventory (1)
- `stock_movements(id, merchant_id, store_id, product_id, type,
  quantity_signed, unit_cost_minor, ref_bill_id, ref_purchase_id, note,
  created_at)`. Append-only. `type ∈ {OPENING, ADJUSTMENT, SALE, PURCHASE,
  TRANSFER_IN, TRANSFER_OUT}`. Current stock =
  `SUM(quantity_signed) WHERE product_id = X`.

### Suppliers (3)
- `suppliers(id, merchant_id, name, phone, address, opening_balance_minor,
  currency, created_at)`.
- `supplier_purchases(id, merchant_id, store_id, supplier_id, invoice_no,
  total_minor, currency, received_at, created_at)`.
- `supplier_purchase_items(id, purchase_id, merchant_id, store_id,
  product_id, quantity, unit_cost_minor, line_total_minor, currency)`.

### Shifts (2)
- `shifts(id, merchant_id, store_id, user_id, opened_at, closed_at,
  opening_cash_minor, closing_cash_minor, expected_cash_minor, variance_minor,
  currency, status)`. `status ∈ {OPEN, CLOSED, RECONCILED}`.
- `shift_entries(id, shift_id, type, amount_minor, currency, ref_id, note,
  created_at)`. `type ∈ {SALE, REFUND, CASH_IN, CASH_OUT, EXPENSE}`.

### Payments (3)
- `payment_sessions(id, merchant_id, store_id, bill_id, provider,
  provider_session_id, payment_token, qr_payload, amount_minor, currency,
  status, expires_at, created_at)`. `status ∈ {CREATED, PENDING, SUCCEEDED,
  FAILED, EXPIRED, REFUNDED}`.
- `payment_events(id, session_id, type, raw_payload, headers, signature,
  verified, received_at)`. Append-only log of every webhook received.
- `payments(id, merchant_id, store_id, bill_id, session_id, method,
  amount_minor, tip_minor, currency, provider, provider_ref, paid_at, created_at)`.

### Expenses (1)
- `expenses(id, merchant_id, store_id, category, amount_minor, currency,
  vendor, note, occurred_at, created_at)`.

### Audit (1)
- `audit_log(id, merchant_id, store_id, actor_id, action, entity_type,
  entity_id, request_id, ip, ua, payload jsonb, created_at)`. Append-only.

### Notifications (1)
- `notification_events(id, merchant_id, store_id, channel, target,
  template, payload jsonb, status, sent_at, created_at)`. `channel ∈
  {SMS, WHATSAPP, EMAIL, PUSH}`. `status ∈ {QUEUED, SENT, FAILED, DLQ}`.

### AI (2)
- `ai_conversations(id, merchant_id, store_id, user_id, title, created_at,
  updated_at)`.
- `ai_messages(id, conversation_id, role, content, model, tokens_in,
  tokens_out, created_at)`. `role ∈ {USER, ASSISTANT, SYSTEM, TOOL}`.

### Idempotency (1)
- `idempotency_keys(key, merchant_id, request_hash, response_status,
  response_body, created_at, expires_at)`. Keys expire after 24h.

### Schema (1)
- `schema_migrations(version text PRIMARY KEY, applied_at timestamptz, description)`.

## Money rules (recap)

- All `*_minor` columns are `text` (BigInt in the API, decimal string in JSON).
- All `*_currency` columns are `char(3)` ISO 4217.
- All `*_bps` columns are integer basis points (`1800` = 18%, never `0.18`).
- The API never lets a client send a floating-point number for a money field.
- Mixed-currency math is rejected at the type level.

## Indexes

- Every `(merchant_id, created_at)` query has a composite index.
- Every `store_id` foreign key has an index.
- `customers.phone` is indexed for the customer search by phone.
- `bills.idempotency_key` is `UNIQUE NULLS NOT DISTINCT` so the
  unique-per-merchant semantics work even with NULL values from non-idempotent
  writes.
- `audit_log.created_at` is indexed for time-range scans.

## Triggers and constraints

- `bills` state transitions: `DRAFT → FINALIZED → VOID`. Out-of-order transitions
  are rejected at the application layer.
- `stock_movements` are append-only. There is no UPDATE or DELETE grant on the
  API role for this table.
- `audit_log` is append-only for the same reason.
- All FKs use `ON DELETE` explicitly: most are `CASCADE` for tenant data
  removal, but `payments.bill_id` and `bills.customer_id` are `RESTRICT` to
  preserve financial history.

## Migrations

Migrations are pure SQL files in `database/migrations/`, applied in lexical
order by `bin/dev/apply-migrations.cjs`. Each migration is idempotent
(`CREATE TABLE IF NOT EXISTS`, `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`).
A successful apply inserts a row in `schema_migrations` with the file name.

Adding a migration:
1. Create `database/migrations/0XX_description.sql`.
2. Use `IF NOT EXISTS` so re-runs are safe.
3. Do not edit a previously-applied migration; add a new one.
4. Update `docs/DATA_MODEL.md` (this file) to reflect the new table.
