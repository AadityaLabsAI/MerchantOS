# MerchantOS — Testing

## Quick start

```bash
cd api
npm test                       # runs the Node test runner
```

The default suite is **15 tests, 100% pass**, in ~6 seconds. It exercises:
- All 12 migrations apply cleanly to a fresh database
- Foundation tables exist (merchants, stores, users, products, bills)
- `bills.idempotency_key` column exists after migration 012
- `withTx` rollback on error
- Money: addition across 549-rupee items stays exact
- Money: subtraction refuses mismatched currencies
- Money: accumulation across 1000 items has no drift
- Money: `equals` is currency- AND value-sensitive
- Money: `toJSON` serializes minor as a string (preserves BigInt precision)
- Money: multiplication by quantity preserves BigInt (no JS number overflow)
- Money: ZERO constant, isZero(), isPositive(), toMajor()
- Idempotency bug-fix regression: bills table has the `idempotency_key` column

## Layout

```
api/test/
├── foundation.test.ts         Migrations + foundation tables
├── money.test.ts              Money class — precision invariants
├── idempotency-bug.test.ts    Regression: idempotency column exists
└── security.test.ts           (future) SQL-injection probes
```

## Conventions

- Use the **Node test runner** (`node --test`). No Jest, no Mocha — one less
  dep, same `describe/it` shape.
- Each test creates and tears down its own data. Tests do not depend on
  prior test order. Tests do not run against a shared database.
- Money values are always constructed via the `Money` class. Never use raw
  numbers, never use floating point, never use `parseInt` for a money
  field. (`api/src/money/Money.ts` enforces this at the type level too.)
- All `query(...)` calls in tests go through the API code path — no direct
  SQL unless the test is explicitly about a SQL feature.

## Database for tests

`bin/dev/apply-migrations.cjs` is invoked by the test bootstrap. It uses
`DATABASE_URL` from the environment. Recommended:

```bash
# Local
export DATABASE_URL=postgresql://merchantos:merchantos@127.0.0.1:5432/merchantos_test

# CI (see .github/workflows/ci.yml)
# A fresh postgres:15 service container is provisioned per run.
```

If you want to run tests against a *production-shaped* schema (with all
triggers, constraints, and seed data) rather than a clean schema, run
`bin/seed.cjs` first; tests still work because they only insert rows.

## Smoke test (against a running API)

```bash
# Start the API
cd api && npm run build && node dist/main.js &

# Wait for /healthz
until curl -fsS http://127.0.0.1:3000/healthz; do sleep 1; done

# Login
TOKEN=$(curl -s -X POST -H 'Content-Type: application/json' \
  -d '{"email":"owner@merchantos.local","password":"OwnerPass123!"}' \
  http://127.0.0.1:3000/auth/login | jq -r .accessToken)

# Create a bill
curl -s -X POST http://127.0.0.1:3000/api/bills \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -H "Idempotency-Key: $(uuidgen)" \
  -d '{"storeId":"...","lines":[{"productId":"...","quantity":1}],"taxBps":1800,"currency":"INR"}'
```

## End-to-end idempotency

`bin/dev/test-idempotency.sh` posts the same bill twice with the same
`Idempotency-Key`. Expected: same bill id returned, only 1 row in
`bills`, only 1 row in `idempotency_keys`.

## CI

`.github/workflows/ci.yml` runs:
- `npm ci` (api)
- `npm run build` (api)
- `npm test` (api)
- Apply migrations
- Start API, hit `/healthz`
- `npm ci` + `npm run build` (web)

on every push to `main`, `feat/**`, `docs/**`, and
`phase-1-production-stabilization`, and on every pull request.

## What is NOT tested (yet)

- Web UI (Playwright/Cypress) — not yet in CI
- Concurrency stress (1000 parallel bills) — exercised manually, not
  automated
- Performance benchmarks (response time p99) — ad-hoc, not in CI
- Penetration testing — recommend a third-party audit before public
  production
