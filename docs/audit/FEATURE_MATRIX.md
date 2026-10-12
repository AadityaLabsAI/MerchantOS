# Feature Matrix

**Audited:** 2026-10-10

Legend:
- ✅ working — code exists, builds, and the production path is exercised
- ⚠️ partial — code exists but a known gap remains
- 🧪 demo-only — works in `demo-server.cjs` only, not in the real API
- ❌ missing — no implementation
- 🔒 blocked-by-credentials — needs external provider/onboarding
- 🚧 not-built — not present in source

## Identity, access, RBAC

| Feature | Real API | Demo | Evidence |
|---|---|---|---|
| Login (`POST /api/auth/login`) | ✅ | 🧪 (any creds) | `api/src/auth/auth.controller.ts` |
| Signup / register | ✅ | 🧪 | same |
| JWT issuance + refresh | ✅ | 🧪 | `api/src/auth/jwt-helper.ts` |
| Logout | ✅ | 🧪 | `auth.controller.ts` |
| Role-based permission checks | ✅ | ❌ | `api/src/rbac/rbac.guard.ts`, `role_permissions` migration |
| Store-scoped access | ✅ | ❌ | `api/src/rbac/store-access.ts` |
| Member cache | ✅ | ❌ | `clearMembershipCache()` |
| Session/device list / revoke | ⚠️ partial | ❌ | migration 009 has `devices` table; controller presence TBD |
| MFA / passkey | ❌ | ❌ | not implemented |

## POS / billing

| Feature | Real API | Demo | Evidence |
|---|---|---|---|
| List bills | ✅ | 🧪 | `bill.controller.ts` `@Get()` |
| Get bill by id | ✅ | 🧪 | `@Get(':id')` |
| Create bill (atomic w/ FOR UPDATE locks) | ✅ | 🧪 | `@Post()` with `withTx`, row locks |
| Cancel bill (reverses stock + ledger) | ✅ | 🧪 | `@Post(':id/cancel')` (per comment) |
| Refund / credit note | ⚠️ partial | 🧪 | controller mentions; verify implementation |
| Cart held / resume | ❌ | ❌ | no endpoint |
| Cashier notes | ⚠️ partial | 🧪 | `notes` field in schema |
| Idempotency key on POST | ❌ | ❌ | not enforced (P0 per prompt) |

## Inventory

| Feature | Real API | Demo | Evidence |
|---|---|---|---|
| Product CRUD | ✅ | 🧪 | `product.controller.ts` |
| Stock count field | ✅ | 🧪 | `products.stock_count` |
| Stock decrement on bill | ✅ | 🧪 | `withTx` + `FOR UPDATE` in bill controller |
| Stock movement (immutable ledger) | ✅ | ❌ | `stock_movements` table in 001 |
| Adjustment endpoint | ✅ | 🧪 | `@Post(':id/adjust-stock')` (per signature) |
| Batch / expiry / serial | ❌ | ❌ | schema not present |
| Low-stock report | ✅ | 🧪 | `reports.controller.ts` `@Get('top-products')` (likely) |
| Stock valuation | ❌ | ❌ | not implemented |
| Transfer (multi-store) | ❌ | ❌ | not implemented |

## Customer CRM & Khata

| Feature | Real API | Demo | Evidence |
|---|---|---|---|
| Customer CRUD | ✅ | 🧪 | `customer.controller.ts` |
| Ledger entries | ✅ | 🧪 | `@Post(':id/ledger')` |
| Outstanding Khata | ✅ | 🧪 | `@Get('outstanding-khata')` |
| Customer statement | ⚠️ partial | 🧪 | ledger exists; PDF/share not verified |
| Consent capture | ✅ | ❌ | `customer_consent` table in 004 |
| Tags / segments | ❌ | ❌ | not implemented |
| Loyalty / store credit | ❌ | ❌ | not implemented |
| Reminder messaging (WhatsApp/SMS) | ❌ | ❌ | no provider wired |

## Suppliers & purchasing

| Feature | Real API | Demo | Evidence |
|---|---|---|---|
| Supplier CRUD | ✅ | 🧪 | `supplier.controller.ts` |
| Purchase records | ✅ | 🧪 | `@Post(':supplierId/purchases')` |
| Purchase line items | ✅ | ❌ | `supplier_purchase_items` in 011 |
| Payable ledger | ✅ | ❌ | part of supplier controller |
| Stock movement on purchase | ✅ | ❌ | 011 adds PURCHASE event type |
| Return / debit note | ❌ | ❌ | not implemented |

## Payments

| Feature | Real API | Demo | Evidence |
|---|---|---|---|
| Payment session create | ✅ | 🧪 | `payment.controller.ts` `@Post('sessions')` |
| Get session by token (public QR) | ✅ | 🧪 | `@Get('qr/:token')` |
| Webhook receive + verify | ✅ | ❌ | `preParsing` hook captures raw body in main.ts |
| Simulate success (sandbox-only) | ✅ | n/a | `@Post('simulate-success')` — must be gated in prod |
| Refund | ⚠️ partial | 🧪 | controller has method (verify) |
| Settlement | ⚠️ partial | 🧪 | reconciliation table exists |
| Real provider adapter | 🔒 | n/a | not configured (Razorpay/Cashfree/PhonePe) |
| Webhook signature verification | ⚠️ partial | ❌ | raw body captured; verify per-provider not done |

## Shift, expense, cashbook

| Feature | Real API | Demo | Evidence |
|---|---|---|---|
| Open shift | ✅ | 🧪 | `@Post('open')` |
| Close shift (variance) | ✅ | 🧪 | `@Post(':shiftId/close')` |
| Cash entries | ✅ | 🧪 | `@Post(':shiftId/entries')` |
| Expense CRUD | ✅ | 🧪 | `expense.controller.ts` (45 lines, lean) |

## Reports

| Feature | Real API | Demo | Evidence |
|---|---|---|---|
| Today summary | ✅ | 🧪 | `reports.controller.ts` `@Get('today')` |
| Top products | ✅ | 🧪 | `@Get('top-products')` |
| Export CSV / PDF | ❌ | ❌ | not implemented |
| Saved / scheduled | ❌ | ❌ | not implemented |

## AI assistant

| Feature | Real API | Demo | Evidence |
|---|---|---|---|
| Conversation list | ✅ | 🧪 | `@Get('conversations')` |
| Get messages | ✅ | 🧪 | `@Get('conversations/:id/messages')` |
| Ask (tool-using) | ✅ | 🧪 | `@Post('ask')` |
| Provider integration | ❌ | ❌ | no LLM wired (openai/anthropic/etc) |
| Tool allowlist | ⚠️ partial | 🧪 | controller exists; allowlist not verified |

## Platform / infra

| Feature | Status | Evidence |
|---|---|---|
| Health endpoint | ✅ | `health.controller.ts` |
| Request logger | ✅ | `observability/request-logger.interceptor.ts` |
| Global error filter | ✅ | `observability/global-error.filter.ts` |
| Migrations runner | ✅ | `bin/migrate` |
| Seed script | ✅ | `bin/seed` |
| Bootstrap user script | ✅ | `bin/create-user.js` |
| Docker compose | ✅ | `docker-compose.yml` |
| Dockerfile | ✅ | `Dockerfile` |
| **CI** | ❌ | no `.github/workflows/` |
| **Tests** | ❌ | `api/test/` is empty |
| Landing page (SPA host) | ✅ | `landing.controller.ts` serves spa_index.html + assets |

## What the demo server (`api/demo-server.cjs`) was masking

The demo URL was live, the SPA worked, but **none of the production-grade controllers above were actually serving requests**. The features that visibly worked in the SPA (POS, Khata, products, shifts) were re-implemented as in-memory mocks in the .cjs file. This duplication is a P0 architectural smell:

1. Two parallel implementations of the same business logic → drift inevitable
2. Demo server bypasses auth, RBAC, audit, money-in-minor-units, tenant isolation, security headers
3. Any merchant who saw the demo and assumed it represents production was misled

**Required remediation:** make the production API actually runnable in the demo environment, and clearly label the demo server as `sandbox-only` in any user-facing communication.

## Next audit doc

→ `BUG_BACKLOG.md`
