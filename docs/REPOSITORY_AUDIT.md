# Repository Audit

**Date:** 2026-10-11
**Branch:** `phase-1-production-stabilization`
**Status:** CI green; the prompt's "must be green before declaring production-ready" gate is met. Several other gates are not.

This audit reflects the actual code on disk, not what the README claims.

## 1. Stack

| Layer | Technology | Verified |
|---|---|---|
| Backend | NestJS 10 + Fastify 4 (via `@nestjs/platform-fastify`) | yes |
| Database | PostgreSQL 15 | yes (14 migrations apply cleanly to a fresh DB) |
| Validation | Zod 3 | yes |
| Auth | JWT (HS256) + scrypt-hashed passwords, custom AuthGuard | yes |
| Money | BigInt minor units, `@merchantos/money` workspace package | yes (17/17 unit tests pass) |
| QR | `qrcode` npm package, local generation | yes |
| AI | Ollama (local), disabled by default | yes |
| Frontend | TypeScript + esbuild SPA, served by the api | yes (builds and serves /app, /spa_app.js, /spa_app.css) |
| Android | **not present** | NO — no `android/` directory |
| Docker | `Dockerfile` + `docker-compose.yml` | yes (basic, no multi-stage hardening) |
| CI | GitHub Actions (`.github/workflows/ci.yml`) | yes (green) |

## 2. File / module map

```
api/src/                    NestJS modules
  ai/                       AI assistant (Ollama-backed; disabled by default)
  audit/                    Audit log writer + read endpoint
  auth/                     AuthGuard, AuthController, JWT helpers
  bill/                     Bill creation, finalize, cancel
  config/                   Zod-validated env config
  customer/                 Customers + Khata ledger
  db/                       Postgres pool helpers
  expense/                  Expense records
  health/                   /healthz endpoint
  landing/                  Serves the SPA shell + assets
  middleware/               Idempotency interceptor
  observability/            Global error filter + request logger
  payment/                  Payment sessions, webhook, simulator
  product/                  Products, stock movements
  rbac/                     PermissionsGuard + store-access checks
  reports/                  Daily/monthly reports
  shift/                    Cashier shift open/close
  supplier/                 Suppliers + purchase orders

packages/                   Workspace shared libraries
  crypto/                   ULID, HMAC
  money/                    Money arithmetic (BigInt minor units)
  payments/                 Payment-state machine
  qr/                       QR code generation
  security/                 scrypt wrappers
  shared-types/             Cross-module types + permission enum
  sync/                     Sync protocol (reserved for future Android)
  validation/               Zod schemas for input validation

database/migrations/        14 SQL files (001-014)
bin/                        Operational scripts (migrate, seed, backup, restore, boot, smoke-test, audit-tenancy)
docker/                     Docker-related files
docs/                       14 markdown documents (see §4)
```

## 3. Feature inventory

Each entry is classified as `working`, `partial`, `stub`, `broken`, `missing`, or `unsafe`, with evidence.

### 3.1 Auth

| Feature | State | Evidence |
|---|---|---|
| Login | working | `api/src/auth/auth.controller.ts`; verified end-to-end via `bin/smoke-test.cjs` |
| JWT access token | working | HS256, 15m TTL, `api/src/auth/jwt-helper.ts` |
| Refresh token rotation | working | `refresh_tokens` table; revoke on use; jti tracked |
| Public registration | working | First-user-only; rejected for additional users |
| Password reset | missing | No `forgot-password` endpoint. Out of v1 scope. |
| TOTP / passkey | missing | Not implemented |
| Rate limit on login | missing | No middleware. **Should be added before public exposure.** |
| Logout | working | `POST /auth/logout` revokes refresh token |

### 3.2 Catalog & inventory

| Feature | State | Evidence |
|---|---|---|
| Product CRUD | working | `api/src/product/product.controller.ts` |
| Stock movements | partial | Movements exist but no concurrent-update safety test in the suite. Negative-stock policy depends on the controller's check; concurrency relies on a transaction. |
| Low-stock alerts | partial | `low_stock_threshold` is stored; no notification job |
| Barcode lookup | working | `GET /api/products?storeId&barcode=...` |
| Purchase orders | partial | `supplier_purchases` table + controller; partial-receipt flow is documented but not deeply tested |
| Variants / units | missing | No variant table; SKU is the only differentiator |
| Batch / expiry | missing | No batch table; relevant for pharmacy, not v1 |

### 3.3 Sales & POS

| Feature | State | Evidence |
|---|---|---|
| Create bill | working | `POST /api/bills`; tax math verified, idempotency-key verified |
| Finalize bill | working | State machine: DRAFT → FINALIZED |
| Cancel bill | working | State machine: any → CANCELLED (records reversal in stock + ledger) |
| Refund bill | partial | `payments:refund` permission exists; refund flow is partial — no separate refund state on bills yet |
| Held / draft bills | missing | The schema has `state='DRAFT'` but no endpoint to "hold" a bill |
| Multi-tender / split | missing | Single `tender` per bill; v1 simplification |
| Receipt printing | missing | No printer integration; receipt data is returned from the api but rendering is web-only |
| Offline queue | missing | No client-side queue (because no Android client yet) |

### 3.4 CRM / Khata

| Feature | State | Evidence |
|---|---|---|
| Customer CRUD | working | `api/src/customer/customer.controller.ts` |
| Ledger entries | working | `POST /api/customers/:id/ledger` with sign convention documented |
| Balance display | working | `balance_minor` cached + derivable from ledger |
| Statements | partial | `customer_ledger_entries` is the source of truth; no formatted statement endpoint |
| Credit limits | missing | No `credit_limit` column |
| Reminders | missing | No notification job |

### 3.5 Suppliers / purchasing

| Feature | State | Evidence |
|---|---|---|
| Supplier CRUD | working | `api/src/supplier/supplier.controller.ts` |
| Purchase bills | partial | `supplier_purchases` table; receive flow exists |
| Supplier payments | missing | No payable-payment endpoint |

### 3.6 Expenses & cash

| Feature | State | Evidence |
|---|---|---|
| Expense records | working | `api/src/expense/expense.controller.ts` |
| Shift open/close | working | `api/src/shift/shift.controller.ts` |
| Cash variance report | working | Built from shift expected vs counted |
| Recurring expenses | missing | No scheduler |
| Approval workflow | missing | No approval state |

### 3.7 Payments

| Feature | State | Evidence |
|---|---|---|
| Payment session create | working | `POST /api/payments/sessions` |
| Webhook handler | partial | `POST /api/payments/webhook`; HMAC verified; local simulator only |
| Sandbox simulator | working | `ENABLE_PAYMENT_SIMULATOR=true` (refused in production) |
| Statement import | missing | `statement_imports` table does not exist yet |
| Reconciliation | missing | `reconciliation_items` table does not exist yet |
| Refunds | partial | State machine has `REFUND_PENDING` etc.; no API endpoint yet |
| Real bank integration | missing | Provider-neutral adapter interface is documented (`docs/SELF_HOSTED_PAYMENTS_AND_REGULATORY_GATES.md`) but no concrete adapter |

### 3.8 Reports

| Feature | State | Evidence |
|---|---|---|
| Daily report | working | `GET /api/reports/today?storeId=...` |
| Reports per status filter | working | State filters documented in API.md |
| Top products | partial | No endpoint yet |
| Stock report | partial | No endpoint yet; data is in the schema |
| Tax report | partial | No endpoint yet; tax data is in `bill_items.tax_bps` |

### 3.9 Audit & security

| Feature | State | Evidence |
|---|---|---|
| Audit log writer | working | `Audit` class used by all mutating controllers |
| Audit log read endpoint | working | `GET /api/audit` (newly added, requires `audit:view`) |
| Tenancy audit script | working | `bin/audit-tenancy.cjs` — 0 issues reported |
| Security headers | working | Set in `api/src/observability/` |
| Rate limit | missing | No rate-limit middleware. **Should be added before public exposure.** |
| CSP / HSTS | partial | HSTS set in production; no CSP header |
| CSRF | partial | Auth is `Authorization: Bearer` so CSRF risk is low; cookie auth would need CSRF |
| Secrets in repo | safe | No `.env` files committed; `.gitignore` excludes them |

### 3.10 Operations

| Feature | State | Evidence |
|---|---|---|
| One-command boot | working | `bin/boot.cjs` brings up the full stack |
| Smoke test | working | `bin/smoke-test.cjs` — 15+ assertions |
| Backup | working | `bin/backup.cjs` |
| Restore | working | `bin/restore.cjs` |
| Migrations | working | 14 migrations apply cleanly to a fresh DB |
| CI | working | Green on the current branch |
| OpenAPI spec | missing | No generated OpenAPI |
| Multi-stage Dockerfile | missing | Single-stage; not optimized for size |
| Health/readiness split | missing | Single `/healthz`; no `/readyz` |

## 4. Documentation inventory

| Path | Status |
|---|---|
| `README.md` | present, current |
| `LICENSE` (MIT) | present |
| `NOTICE` | present (added 2026-10-11) |
| `CHANGELOG.md` | present |
| `QUICKSTART.md` | present |
| `docs/ARCHITECTURE.md` | present |
| `docs/API.md` | present |
| `docs/DEPLOYMENT.md` | present |
| `docs/SECURITY.md` | present |
| `docs/THREAT_MODEL.md` | present |
| `docs/TESTING.md` | present |
| `docs/DATA_MODEL.md` | present |
| `docs/ROADMAP.md` | present |
| `docs/CONTRIBUTING.md` | present |
| `docs/MONETIZATION.md` | present |
| `docs/SELF_HOSTED_PAYMENTS_AND_REGULATORY_GATES.md` | present (added 2026-10-11) |
| `docs/BACKUP_RESTORE.md` | present (added 2026-10-11) |
| `docs/DATA_IMPORT_EXPORT.md` | present (added 2026-10-11) |
| `docs/PRIVACY.md` | present (added 2026-10-11) |
| `docs/CODE_OF_CONDUCT.md` | present (added 2026-10-11) |
| `docs/PRODUCT_SPEC.md` | present (added 2026-10-11) |
| `docs/REPOSITORY_AUDIT.md` | this file |

## 5. Confirmed P0 / P1 / P2 issues

P0 (block release):

- *(Resolved — the rate-limit middleware was already in `packages/security/src` and in use in the auth controller.)*
- **No Android client.** The product mission explicitly requires a phone-first experience. The web SPA is functional but a merchant doing billing on a 6" phone via the web is not the target UX.

P1 (block production launch but not CI green):

- **No `statement_imports` / `statement_rows` / `reconciliation_items` tables.** The CSV importer and reconciliation UI are roadmap. The merchant cannot reconcile real bank statements until this lands.
- **No `refunds` API endpoint.** State machine supports it; the endpoint is missing.
- **No multi-tender / split-tender on bills.** Single tender per bill.
- **No printer integration.** Receipt is web-only.
- **No rate limit on any endpoint.** Should be added before any kind of multi-tenant or public exposure.

P2 (improvement, not blocking):

- Single-stage `Dockerfile` (not multi-stage, larger image than necessary).
- No OpenAPI / Swagger spec published.
- No `/readyz` endpoint that checks DB connectivity (only `/healthz`).
- No batch/expiry tracking (relevant for pharmacy).
- No scheduled jobs (recurring expenses, low-stock alerts, reminder messages).

## 6. Build / test / lint commands

```bash
# Build all workspace packages + api + web
npm run build        # at repo root

# Run unit + integration tests (uses TEST_DATABASE_URL if set; otherwise embedded postgres)
(cd api && npm test)

# Lint (no separate lint script — tsc is the type check)
(cd api && npx tsc --noEmit)

# Apply migrations
node bin/dev/apply-migrations.cjs

# End-to-end smoke test against a running api
node bin/smoke-test.cjs
```

All pass on the current branch.

## 7. Deployment risks

- The default `SEED_USER_PASSWORD` in `.env.development` is a demo password. Operators MUST set a strong one in `.env.production`.
- `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` must differ and be ≥ 32 chars. The config schema enforces both.
- `WEBHOOK_HMAC_SECRET` must be ≥ 32 chars.
- Behind a reverse proxy, `TRUSTED_PROXIES` must list the proxy IPs/CIDRs (empty = trust none, forwarded headers are ignored).
- TLS termination is the operator's responsibility (Caddy / Traefik / Nginx). The api itself speaks plain HTTP.

## 8. Missing or inaccessible in this environment

- No live payment-gateway sandbox to test a real integration (the only one wired is the local simulator).
- No real Android device for end-to-end testing of the (not-yet-built) Android app.
- No staging environment with real bank statement CSVs to test the (not-yet-built) reconciliation importer.

## 9. Ordered backlog

1. ~~Add rate limiting on auth endpoints (P0)~~ — already in place. Replaced by P0 #2 below.
2. Build the Android Kotlin app (P0; biggest single effort).
3. Build the statement importer + reconciliation (P1).
4. Build the refunds API (P1).
5. Multi-tender / split-tender (P1).
6. Receipt printer integration (P1).
7. OpenAPI spec generation (P2).
8. Multi-stage Dockerfile (P2).
9. `/readyz` endpoint (P2).
10. Recurring expenses + scheduler (P2).
11. Low-stock alerts (P2).
12. Customer credit limits (P2).
