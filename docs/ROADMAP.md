# MerchantOS — Roadmap

The roadmap is **not a commitment**. It reflects what the maintainers think
is the right next step, given the current state of the codebase and the
target users. Dates are deliberately omitted.

## v1.4 — Production hardening (in progress)

- ✅ Idempotency keys for retry-safe writes
- ✅ Backed-up and restorable (pure-Node scripts, no pg_dump needed)
- ✅ CI on GitHub Actions (api build + tests + smoke; web build)
- ⏳ Playwright UI tests for the SPA (next)
- ⏳ Account lockout after N failed logins
- ⏳ Per-user API tokens (long-lived, scoped, revocable) for integrations

## v1.5 — Operator experience

- One-shot `bootstrap.cjs` that creates a systemd unit, applies migrations,
  and starts the API. Currently this is documented in `docs/DEPLOYMENT.md`
  but is still a 10-step manual process.
- A `/api/admin/diagnostics` endpoint (OWNER-only) that prints
  - DB connection count
  - Last backup timestamp
  - Disk usage of `backups/`
  - API uptime, p50/p99 latency over the last hour
- Daily backup verification (restore the most recent backup to a
  scratch DB and compare row counts).

## v1.6 — Multi-store reporting

- A consolidated view across stores (roll-up of sales, stock transfers)
- Per-store user permissions (a CASHIER of store A can not see store B
  even within the same merchant — already enforced; this is for UX)

## v1.7 — Async jobs

- Receipt delivery (SMS / WhatsApp / email) via a job queue, with retry
  and DLQ
- Scheduled reconciliation (compare local ledger against payment provider
  reports)
- Bulk export jobs (CSV/Excel of bills, customers, products)

The current code paths run these synchronously; for production scale they
need a queue. Likely technology: pg-boss (Postgres-backed, no new infra).

## v1.8 — Native Android client

The web SPA is mobile-friendly, but a native Android client would offer
- Offline-first operation (SQLite local store, sync when online)
- Receipt printer integration via Bluetooth
- Barcode scanner with the device camera
- Tally/GST report export as PDF

This is a substantial effort. The current `web/` is the canonical
implementation; the Android client will wrap the same API and reuse the
same data model.

## v1.9 — Internationalization

- Multi-currency per merchant (already supported per-row, but reporting
  needs a base-currency conversion)
- Date/time formatting per store timezone (the `stores.timezone` column
  is in place; reports just need to use it consistently)
- UI strings for Hindi, Tamil, Telugu, Marathi, Bengali

## v2.0 — Public marketplace

- A "store" can publish a public catalog at `<merchant>.merchantos.example`
- Customers can browse, place orders, and pay (Razorpay / Cashfree /
  Stripe / self-hosted — operator choice)
- Orders are written to a new `online_orders` table and reconciled with
  `bills` on pickup/fulfillment

## Out of scope (and why)

- **Bank/UPI replacement** — MerchantOS does not, and will not, hold bank
  credentials or bypass regulated payment infrastructure. It integrates
  with payment providers through their documented APIs.
- **Tax filing** — India GST, EU VAT, US sales tax are all jurisdiction-
  specific and require certification. MerchantOS will produce the source
  data; the operator is responsible for filing.
- **Accounting (Tally/Zoho/QuickBooks) integration** — already supported
  via CSV/JSON export. A real-time integration would require
  partner-specific work.
- **AI-powered everything** — the AI integration is intentionally a
  small, local-LLM feature, not the product. The product is a merchant
  operating system.

## How to propose changes

Open an issue on GitHub with the `proposal` label. Include the user
problem, the proposed change, and a sketch of the migration path for
existing data. Major changes (schema, auth, public API) require an ADR
(architecture decision record) in `docs/adr/`.
