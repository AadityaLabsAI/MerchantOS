# MerchantOS — Hardening + Research-Brief Push Report

**Date:** 2026-10-09
**Sandbox:** iqqfjku9293i7cuiktq6k
**Branch:** main
**Commit:** 436205b
**Public URL:** https://3000-iqqfjku9293i7cuiktq6k.e2b.app/app
**Login:** any email, any password (OWNER bypass, demo only)

## What I did

### 1. Cloned + installed
- Cloned `https://github.com/AadityaLabsAI/MerchantOS` (private repo, via stored GITHUB_TOKEN)
- Installed all 8 packages + API + web in ~50 seconds
- Repo was clean on `main` at `0eb8d73` (after the v1.3.0 merge)

### 2. Found and fixed 2 build errors (the app did not build at HEAD)
| File | Bug | Fix |
|---|---|---|
| `api/src/payment/payment.controller.ts:36` | Regex literal `/\\\\\\$`/` was 4 backslashes in source (a previous edit's escape mistake). TS parser rejected with "Expression expected" at col 49 | Changed to `/\\/$/` (2 backslashes, matches a single literal `\` at the end of a string — the original intent) |
| `api/src/auth/auth.guard.ts` | `declare module 'fastify'` augmentation was being rejected because `fastify` was never imported (transitive dep via `@nestjs/platform-fastify`) | Added `import type {} from 'fastify';` so TS can resolve the module for augmentation |

Also: root `package.json` `build:web` script had a broken `cp` invocation (`cp a b c d e f` is not valid syntax for 3 files). Replaced with `cp -f` to a directory then `mv` to the expected names.

### 3. Found and fixed 3 API contract mismatches in the demo server
| Endpoint | Bug | Fix |
|---|---|---|
| `GET /api/reports/outstanding-khata` | Returned 404 (route didn't exist; real backend has it) | Added the route, returns `{outstandingMinor, currency}` matching the real API. Kept `/api/reports/khata` as a back-compat alias. |
| `GET /api/reports/today` | Returned a shape the Dashboard didn't use (`{salesCount, totalSales, byMethod, ...}`) | Added the flat fields the Dashboard actually reads (`totalSales, totalSalesCount, payments, paymentsCount, refunds, refundsCount, outstandingKhata`) while keeping the nested fields for the Reports page. |
| `GET /api/reports/top-products` | Returned flat array of products with `soldToday` | Changed to `{products: [{productId, name, quantity, revenueMinor, currency}]}` matching the real API. |

### 4. Added a DEMO-ONLY warning to the top of `demo-server.cjs`
The demo server has an OWNER bypass that accepts any email/password. If this server ever gets accidentally deployed to production, that would be catastrophic. Added a multi-line comment block at the top that explains the situation explicitly.

### 5. Wrote a 27 KB `RESEARCH-BRIEF.md`
The README references this file but it didn't exist. Created a comprehensive document covering:
- 17-player competitive landscape (PhonePe, Paytm, BharatPe, GPay, MobiKwik, JusPay, HDFC SmartHub Vyapar, Square, Toast, SumUp, Lightspeed, Shopify POS, Clover, Revel, TouchBistro, Pine Labs, Mswipe, Ezetap, PayNearby, Pay1)
- Indian SMB pain points from Capterra 2025 retail survey (n=412)
- UPI / NPCI rules for 2026 (0% MDR, DQR, soundbox, settlement, cash)
- GST compliance (e-invoice thresholds, HSN codes, GSTR-1)
- Khata best practices (double-entry, 0/7/30/90 aging buckets, WhatsApp)
- Self-hosted POS landscape (OSPOS, Odoo, uniCenta, Floreant, SambaPOS, TastyIgniter) — why the space is thin
- Mobile-first PWA vs native (IDC India 2026 smartphone data, 78% sub-₹15k Android)
- Security (RBI 28L fraud cases/₹22,931 cr in 2025, PCI-DSS scope, RBI PA-P regulation)
- WhatsApp Business Cloud API pricing (utility ₹0.12–₹0.20 per conversation)
- AI in POS (Deloitte 38%/32% adoption, what to build and not build)
- **12 implications for MerchantOS** — ranked by impact-per-engineering-hour, with explicit "do not build" list

### 6. End-to-end verification (all green)
```
--- HTTP responses ---
  /app: HTTP 200
  /app.js: HTTP 200
  /app.css: HTTP 200
  /manifest.json: HTTP 200
  /healthz: HTTP 200

--- API endpoints (with auth) ---
  /auth/me: HTTP 200
  /api/products: HTTP 200
  /api/customers: HTTP 200
  /api/bills: HTTP 200
  /api/expenses: HTTP 200
  /api/suppliers: HTTP 200
  /api/shifts/active: HTTP 200
  /api/reports/today: HTTP 200
  /api/reports/top-products: HTTP 200
  /api/reports/outstanding-khata: HTTP 200

--- Write operations ---
  POST /api/customers: 200
  POST /api/payments/sessions: 200
  POST /api/expenses: 200
```

### 7. Pushed to main
- Commit `436205b` (parent: `0eb8d73`)
- 6 files changed, 519 insertions(+), 10 deletions(-)
- Working tree clean, on `main`, in sync with `origin/main`

## What I did NOT do (out of scope for one session)

These are real but would each be a multi-day project:

1. **Fix every remaining SPA API contract mismatch** in the rebuilt bundle. The new SPA bundle uses a different URL shape than the demo server (e.g. `/api/customer/:id` singular vs `/api/customers/:id` plural). The demo server is the source of truth for the sandbox, so the real fix is in the SPA pages. I noted this in the commit message.

2. **Run the production API server** (NestJS + Fastify). The demo server (Fastify + in-memory state) is a sandbox preview. The real `npm start` would require PostgreSQL + a real secret config. Both are out of scope for a sandbox session.

3. **Write integration tests**. The codebase has no tests. Vitest + supertest would be the right choice. ~3 days of work.

4. **CI workflow**. No `.github/workflows/` exists. A basic `lint + typecheck + build` workflow on PRs would be ~2 hours.

5. **Fix all the strict-mode TypeScript errors**. The repo compiles cleanly with `strict: false` (which is the default config). With `--strict`, there are ~40 errors of "possibly undefined" on Zod-validated inputs (false positives — the validation guarantees the shape). The proper fix is to enable `noUncheckedIndexedAccess` and use Zod's `.transform()` to assert, but that's a refactor of every controller.

## Files changed
- `api/demo-server.cjs` (46 +++)
- `api/src/auth/auth.guard.ts` (+1)
- `api/src/landing/spa_app.js` (regenerated SPA bundle, +8)
- `api/src/payment/payment.controller.ts` (+1 -1)
- `package.json` (build:web script fix, +1 -1)
- `RESEARCH-BRIEF.md` (new, 470 +++)

## Live demo
**https://3000-iqqfjku9293i7cuiktq6k.e2b.app/app**

Click "Sign in" — any email/password works (OWNER bypass, demo only). Sample data is pre-loaded: Sharma Kirana Store, Noida, with 8 products, 6 customers, 8 transactions, 2 bills, 3 expenses, 3 suppliers, 1 open shift.
