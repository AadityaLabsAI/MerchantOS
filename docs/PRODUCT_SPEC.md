# MerchantOS — Product Specification

**Audience:** founders, product, design, QA, and self-hosting operators.
**Goal:** define the v1 user journeys, acceptance criteria and what is explicitly out of scope, in the same language as the code.

---

## 1. Primary user

A single-shop or small-multi-shop Indian merchant — kirana, garments, electronics, pharmacy, restaurant, salon, wholesaler — who needs to run their daily business from one Android phone plus an optional browser. They are non-technical; the operator who installs MerchantOS for them may be the same person, a family member, or a local IT consultant.

## 2. Core journeys (acceptance criteria)

### 2.1 First-time setup

A new operator can take a fresh Ubuntu 22.04+ server, run the install steps, and reach a working MerchantOS in < 30 minutes.

**Acceptance:**
- `node bin/boot.cjs --port=3000` exits 0 with the api listening on port 3000.
- `node bin/smoke-test.cjs http://127.0.0.1:3000` reports 15+ passes, 0 fails.
- The operator can open `http://<server-ip>:3000/app` in a browser and see the login screen.
- Logging in with the seed OWNER credentials takes them to the dashboard.

### 2.2 Create a store and add the first product

**Acceptance:**
- An OWNER can create a store via the API or the web UI.
- An OWNER or MANAGER can add a product (SKU, name, price, optional barcode, optional category, optional tax rate).
- A duplicate SKU in the same store is rejected with a clear error.

### 2.3 First sale

**Acceptance:**
- A CASHIER can scan/select a product, set a quantity, and finalize the bill.
- The bill record persists with correct subtotal, tax and total (BigInt, no float drift).
- A stock movement is created; `products.stock_count` is decremented atomically.
- A `bills` row with `state='FINALIZED'` and a corresponding `bill_items` row exist.
- An `audit_log` row records who created the bill and from which store.
- The total of today's bills shows in `GET /api/reports/today`.

### 2.4 Customer Khata

**Acceptance:**
- An OWNER or MANAGER can add a customer with optional phone/email.
- A CREDIT ledger entry increases the customer's balance; the system displays the new balance.
- A PAYMENT ledger entry (negative minor) decreases the balance.
- The cached `balance_minor` is always equal to the sum of the customer's ledger entries (invariant; tested in `bin/audit-tenancy.cjs` and the test suite).

### 2.5 Cash shift

**Acceptance:**
- A CASHIER can open a shift with an opening cash count.
- During the shift, sales, expenses and cash movements are linked to the open shift.
- The CASHIER can close the shift with a counted cash total; the system reports any variance.

### 2.6 End-of-day report

**Acceptance:**
- An OWNER or MANAGER can pull `GET /api/reports/today?storeId=...` and see:
  - Total sales (sum of finalized bills)
  - Total tax collected
  - Number of bills
  - Average bill value
  - Breakdown by payment method
  - Breakdown by category
- The numbers reconcile to the underlying `bills` and `payment_sessions` tables.

### 2.7 Backup and restore

**Acceptance:**
- `node bin/backup.cjs` produces a SQL file that, when restored into a fresh PostgreSQL via `psql`, recreates the full database with row counts and money totals preserved.
- The operator can perform a restore drill on a separate machine, run the verification SQL in `docs/BACKUP_RESTORE.md` §5, and get 0 rows on the invariant check.

### 2.8 Multi-store

**Acceptance:**
- A merchant can have multiple stores under one merchant id.
- A user can have memberships in one or more stores, with one role per store.
- A user attempting to read or write across stores they are not a member of gets a 403.

## 3. Non-functional acceptance

| Area | Criterion | Status |
|---|---|---|
| Money | No float arithmetic; integer minor units only | met (enforced in `packages/money`, tests) |
| Tenancy | Every read/write is merchant+store scoped | met (`bin/audit-tenancy.cjs` reports 0 issues) |
| Idempotency | Replaying a state-changing request with the same `Idempotency-Key` returns the original response | met (verified in smoke test) |
| Audit | Every mutating controller writes an `audit_log` row | met (cross-cutting Audit class) |
| CI | `api-build-test` and `web-build` both green on every push to the protected branch | met |
| Backups | Operator can take and restore a full backup with documented verification | met (`bin/backup.cjs`, `bin/restore.cjs`, `docs/BACKUP_RESTORE.md`) |
| Self-hosted | No required third-party SaaS for core flows | met (the simulator is local; AI is local Ollama by default) |
| Honest payments | No fake "Payment verified" badge for unverified transactions | met (state machine forbids client-driven `VERIFIED`) |

## 4. What is explicitly out of scope (v1)

The product spec deliberately does **not** include:

- **Independent UPI / card / netbanking settlement.** See `docs/SELF_HOSTED_PAYMENTS_AND_REGULATORY_GATES.md`. The product records payment evidence; it does not clear or settle.
- **Android native client.** The web SPA is functional. The Android client is a major separate workstream and the highest-priority P0 after rate limiting.
- **Statement CSV importer + reconciliation UI.** Roadmap; schema planned; not in v1.
- **Multi-tender / split-tender on bills.** Single tender per bill in v1.
- **Receipt printers** (Bluetooth / USB / network). Roadmap.
- **Multi-currency** in the UI. The schema and money package are currency-aware (each bill and ledger entry has a `currency`), but the UI only ships INR.
- **Real-time multi-device sync.** The api is server-of-record; the v1 client is single-device.
- **Customer credit limits and reminder messages.** Roadmap.
- **Pharmacy batch / expiry tracking.** Roadmap.

## 5. UX bar

- Every screen has a loading state, an empty state, an error state and an offline state where applicable.
- All destructive actions require a confirmation step.
- Money is displayed in the operator's locale (default `en-IN`); the underlying value is always the integer minor string.
- Status badges are honest: a payment that is `PENDING_EXTERNAL` is shown as "Awaiting verification", never as "Payment received".
- Touch targets are at least 44px on phone widths.

## 6. Pilot acceptance gates

A pilot deployment is considered complete when:

- The first-time setup (2.1) works on the pilot's hardware.
- The first-sale journey (2.3) is completed end-to-end by a non-technical user.
- The Khata journey (2.4) is verified by a real customer.
- The end-of-day report (2.6) reconciles to the underlying records.
- A backup-restore drill (2.7) has been performed and the verification SQL returns 0 rows on the invariant check.
- All 17 unit/integration tests pass in CI.
- No P0 issue from `docs/REPOSITORY_AUDIT.md` §5 is open.

## 7. Open questions for the next milestone

- Should the rate-limit thresholds (per-IP and per-account) be configurable from the web UI, or only via `.env`?
- For the Android client: Kotlin + Jetpack Compose + Room, or KMM (shared business logic with the existing TS)? The TS packages are organized to be portable; a Kotlin port of the money and validation logic would be a non-trivial but bounded effort.
- For statement import: do we ship a single CSV profile (HDFC, ICICI, SBI) and grow from there, or do we ship a generic profile + a few mappings and let the operator define new ones in the UI?

These are decisions to make before kicking off phase-2 work, not in scope for the current production-readiness push.
