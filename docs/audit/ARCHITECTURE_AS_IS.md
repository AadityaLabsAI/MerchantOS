# Architecture As-Is

**Audited:** 2026-10-10

## System shape (verified from source)

```
┌─────────────────────────────────────────────────────────────────┐
│  Browser (SPA — TypeScript + esbuild + Tailwind)                │
│  web/src/* → build.mjs → spa_app.js/css/html                    │
└─────────────────────────────────────────────────────────────────┘
                              │  HTTPS / JSON
                              │  /api/*  +  / (landing)
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  Backend: NestJS + Fastify                                      │
│  api/src/main.ts                                                │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ Global guards: AuthGuard(JWT) + PermissionsGuard(RBAC)  │   │
│  │ Security headers: CSP, HSTS(prod), X-Frame, Permissions │   │
│  │ CORS: env-driven, credentials allowed                    │   │
│  │ Body limit: 2 MB; request timeout: 30s; keepalive: 60s  │   │
│  │ Webhook raw-body capture: /api/webhooks/*               │   │
│  └──────────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ Modules:                                                 │   │
│  │  auth → JWT helpers + login controller                   │   │
│  │  rbac → role/permission checks, store-access (cache)     │   │
│  │  audit → append-only event log                           │   │
│  │  observability → request logger, global error filter     │   │
│  │  bill, payment, product, customer, supplier, expense,    │   │
│  │  shift, reports, ai, health, landing                     │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │  pg pool
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  PostgreSQL (via 11 SQL migrations, idempotent runner)         │
│  database/migrations/001..011                                   │
│  schema_migrations table tracks applied versions                │
└─────────────────────────────────────────────────────────────────┘

Shared packages (consumed by both api/ and packages themselves):
  money, payments, qr, crypto, sync, validation, security, shared-types
```

## Authentication & authorization flow

1. Request hits any `/api/*` route (except `/api/health`, `/api/auth/login`, `/api/auth/signup`, `/api/landing/*`, `/api/webhooks/*`).
2. `AuthGuard` (in `api/src/auth/auth.guard.ts`) extracts `Authorization: Bearer <jwt>`.
3. JWT verified using `JwtService` from `@nestjs/jwt`.
4. `PermissionsGuard` (in `api/src/rbac/rbac.guard.ts`) checks role/permission against the action and target resource.
5. `store-access.ts` provides store-scoped access checks with an in-memory membership cache (`clearMembershipCache()` on shutdown).

**This is the intended production path** — but it is *not* what the public demo URL was using. The demo server (`api/demo-server.cjs`) bypasses all of this.

## Data model (from migrations)

11 migrations, lexically ordered:

| # | File | Domain |
|---|---|---|
| 001 | foundation.sql | Core tables: merchant, store, user, session, etc. |
| 002 | role_permissions.sql | RBAC tables |
| 003 | catalog.sql | Product, category, unit, price, tax profile |
| 004 | customers.sql | Customer + customer_consent |
| 005 | bills.sql | Bill, bill_item, invoice, return/credit_note |
| 006 | suppliers.sql | Supplier + payable ledger |
| 007 | shifts.sql | Shift + cash movements |
| 008 | payments.sql | Payment session, event, refund, settlement, reconciliation |
| 009 | devices_auth_audit.sql | Device registry, audit log |
| 010 | register.sql | Bootstrap registration |
| 011 | production_integrity.sql | Late-stage hardening constraints |

(Detailed table introspection not done in this audit pass; recommended for `BUG_BACKLOG.md`.)

## Money representation (per `packages/money`)

Integer minor units + ISO currency code. NOT binary float. This satisfies the prompt's "Money is integer minor units with currency codes and explicit rounding" requirement.

## What is NOT in the architecture (verified absent)

- ❌ Native Android client (no `android/`, no Kotlin sources)
- ❌ Real payment provider adapter (controller exists; provider registry is empty)
- ❌ Email/SMS provider integration (no SMTP/WhatsApp/Twilio wiring)
- ❌ Redis or any cache layer beyond in-process membership cache
- ❌ Container orchestration beyond the supplied `docker-compose.yml`
- ❌ Push notification service
- ❌ Soundbox native code
- ❌ CI/CD pipeline (no `.github/workflows/` — verified)

## Module boundaries (intended)

- **Identity & access**: auth, rbac, audit
- **Catalog**: product, customers (CRM read model)
- **Inventory**: not yet extracted as a separate module — currently spread across product + bill + customer
- **Sales**: bill (cart, finalize, return, credit_note)
- **Payments**: payment (intent, event, refund, settlement, reconciliation)
- **Ledgers**: customer + supplier + expense + cash movement
- **Purchasing**: supplier (purchase-order, goods-receipt, invoice are in migration 006)
- **Workforce**: shift (cash float, opening/closing, variance)
- **Reporting**: reports
- **AI**: ai (controller only; provider unwired)
- **Sync**: packages/sync (engine exists, no client integration yet)

These are the boundaries the prompt recommends. They are partially in place; some are still intertwined (e.g. inventory touches product + bill).

## Data flow for a typical cash bill (intended path)

```
Browser → POST /api/bill (JWT + storeId in membership)
  → AuthGuard verifies token
  → PermissionsGuard checks `bill:create` for the store
  → Bill controller validates input (zod via @merchantos/validation)
  → Begin transaction
  → Insert bill + bill_items
  → Decrement product.stock (or insert stock_movement?)
  → Insert cash_movement (linked to shift if open)
  → If credit sale → insert customer_ledger_entry
  → Commit
  → Audit event
  → Response with bill + receipt
```

**However, this end-to-end path is not exercised by any automated test in the repo today.** Whether it works in the real API can only be confirmed by actually running it — which requires a live PostgreSQL with all migrations applied.

## What's actually live at the public URL

- **`demo-server.cjs`** (Fastify in-memory, no DB, accepts any email/password)
- All API routes mirror the v1.3.0 SPA's expected shape (singular forms: `/api/bill`, `/api/customer`, etc.)
- Data resets on every restart
- No audit log persisted
- No tenant isolation (no concept of multiple merchants in the demo)
- No rate limiting
- No CSP/HSTS (it's a dev server)
- CORS permissive

## Architectural mismatches between demo and reality

| Concern | Demo (`demo-server.cjs`) | Real (`api/src/main.ts`) |
|---|---|---|
| Auth | Stub — any creds accepted | JWT + RBAC + store-scope |
| Data | In-memory, hardcoded sample | PostgreSQL via migrations |
| Idempotency | Not implemented | Partially (per audit — needs verification) |
| Multi-tenant | Single tenant | Merchant → Store → User with memberships |
| Audit | Not persisted | Append-only audit table |
| Money | Native JS numbers | Integer minor units via @merchantos/money |
| Error envelope | Plain `{error: ...}` | Consistent via global error filter |
| Observability | `logger: false` | Request logger interceptor + structured logs |
| Security headers | None | CSP (prod), HSTS (prod), X-Frame, Referrer-Policy |

## Next audit doc

→ `FEATURE_MATRIX.md`
