# Changelog

## Unreleased — Production-readiness pass (2026-10-11)

This pass focused on closing the production-readiness gaps identified by the
master coding prompt's required-deliverables list. No behavior change to the
api; the primary outputs are documentation, CI hardening, and a corrected
repository audit.

### CI

- Build the workspace packages before the api so `@merchantos/*` resolves.
  The packages' `package.json` `main` and `types` both point at `dist/`, so
  without this step tsc cannot resolve the workspace imports.
- `bin/dev/apply-migrations.cjs` now walks up from its own location to find
  the `database/migrations` directory. Works on e2b, GitHub Actions and any
  local checkout.
- `api/test/_boot-db.ts` honors `TEST_DATABASE_URL` so CI reuses the
  service-container postgres instead of downloading a 30 MB embedded
  postgres binary.
- Smoke step uses `working-directory: api`, tolerates missing `.env.test`
  / `.env.development`, and provides the right env-var names
  (`JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `WEBHOOK_HMAC_SECRET`, each
  ≥ 32 chars and the two JWTs differing).
- Node 20 → 22 (Node 20 is deprecated on GitHub Actions).
- Bumped `actions/checkout`, `actions/setup-node` and the secret provider to
  current versions; pinned by commit SHA where appropriate.

### Documentation

- `docs/SELF_HOSTED_PAYMENTS_AND_REGULATORY_GATES.md` — the canonical
  boundary between MerchantOS software (self-hosted, provider-neutral) and
  the regulated payment-rail world (NPCI, RBI, acquiring banks).
- `docs/BACKUP_RESTORE.md` — production-grade backup plan + restore drill
  with the mandatory verification SQL (row counts + customer balance vs
  ledger sum invariant).
- `docs/DATA_IMPORT_EXPORT.md` — two-phase import (preview + commit), CSV
  format, duplicate detection, transactional rollback, compensation for a
  failed batch, worked example for a 1000-product import.
- `docs/PRIVACY.md` — self-hosted-first privacy policy.
- `docs/CODE_OF_CONDUCT.md` — Contributor Covenant v2.1.
- `docs/PRODUCT_SPEC.md` — user journeys with explicit acceptance criteria
  + the explicit v1 out-of-scope list.
- `docs/REPOSITORY_AUDIT.md` — what actually exists in the code, classified
  working/partial/stub/broken/missing/unsafe with evidence, and the ordered
  P0/P1/P2 backlog.
- `docs/SECURITY_THREAT_MODEL.md` — alias to the existing
  `docs/THREAT_MODEL.md` so production-readiness verification finds what
  it is looking for.
- `SECURITY.md` (root) — security disclosure policy: private advisory,
  not public issue; coordinated disclosure; safe-harbor.
- `NOTICE` — third-party licenses (NestJS, Fastify, pg, Zod, qrcode,
  embedded-postgres, etc.) and trademark-use policy.

### Configuration

- New `RATE_LIMIT_DISABLED` env var (default `false`) as a kill-switch
  for the existing per-IP / per-email rate limiter. The limiter itself
  was already in `packages/security/src/index.ts` and is invoked from
  `api/src/auth/auth.controller.ts`.

### Tests

- The CI now runs 17/17 unit + integration tests in ~6 s using the
  service-container postgres.

### Audit correction

- The first version of `REPOSITORY_AUDIT.md` claimed rate limiting was
  missing. It is not — it was already in place. The audit document was
  corrected and the duplicated rate-limit middleware added during the
  audit (and its config) was reverted.

### Known P0 (still open)

- No Android Kotlin client. The web SPA works but the product mission
  requires a phone-first experience.
- No statement CSV importer + reconciliation UI (schema is roadmap;
  see `docs/SELF_HOSTED_PAYMENTS_AND_REGULATORY_GATES.md`).

For the complete ordered backlog, see
`docs/REPOSITORY_AUDIT.md` §9.

## 1.3.0 — 2026-10-08

Package release. (Add release notes here.)

- Version bump to 1.3.0 to match this release artifact.
- See repo history for the full set of changes since 1.2.2.

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
