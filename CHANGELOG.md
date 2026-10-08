# Changelog

## 1.2.2 — 2026-10-08

**First-class UI** — full single-page app served from `/`, polished pay page at `/pay/:token`.

- New `LandingController` returns a premium dark-themed SPA at `/` (login, dashboard, POS, products, customers, khata ledger, bills, suppliers, payments, expenses, reports, shifts)
- `PayPageController` now returns HTML for browser visits, JSON for API clients
- Includes 4 sample products, 1 sample customer, live pay session

## 1.2.1 — 2026-10-08
- Added basic landing page with API console

## 1.2.0 — 2026-10-07 — Final Hardening Pass
- Rate limiting, webhook state hardening, stock race fix, AI cross-user isolation

## 1.1.0 — Hardened Production Release

## 1.0.0 — initial build
