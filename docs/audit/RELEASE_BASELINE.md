# Release Baseline

**Audited:** 2026-10-10
**Branch under audit:** `feat/gate-0-audit-stabilization` (off `main` @ `ad35a28`)
**Sandbox:** e2b base template, fresh clone, no cache

## Build matrix (commands and actual results)

| Command | What it does | Result | Evidence |
|---|---|---|---|
| `npm run build:packages` | tsc compile 8 shared packages | ✅ pass | All 8 packages produced `dist/*.js` without errors |
| `npm run build:web` | esbuild SPA → `spa_app.{js,css,html}` | ✅ pass (pre-existing) | `web/src/lib/*` + `web/src/pages/*` compile to ~488KB JS |
| `npm run build:api` | tsc compile `api/src` → `api/dist` | ✅ pass | 153 npm packages installed; tsc output clean |
| `npm run build` | All of the above in sequence | ✅ pass | Sequential build works |
| `npm test` | `node --test test/` | ⚠️ no-op | `api/test/` directory does not exist; no tests run |
| `npm run migrate` | Apply 11 SQL migrations | ❌ not run | Requires PostgreSQL; not in this baseline |
| `npm run dev` | Watch-mode compile | ❌ not exercised | Would need persistent shell |
| `npm start` | Start production API | ❌ not exercised | Same as above |

## Lint / typecheck

| Tool | Configured | Result |
|---|---|---|
| TypeScript (api) | ✅ `tsconfig.json` strict | ✅ pass during build |
| TypeScript (web) | ✅ `tsconfig.json` | ✅ pass during build |
| TypeScript (packages) | ✅ each has `tsconfig.json` | ✅ pass during build |
| ESLint | ❌ no config found | not enforced |
| Prettier | ❌ no config found | not enforced |
| Secret scan | ❌ no config | recommended in Gate 1 |

## Test counts (verified)

| Layer | Count | Notes |
|---|---|---|
| Unit | 0 | `api/test/` empty |
| Integration | 0 | none |
| E2E | 0 | none |
| Property / invariant | 0 | none |
| API contract | 0 | none |
| Security | 0 | none |
| Performance / load | 0 | none |
| Total | **0** | Prompt's "Mandatory verification strategy" is entirely unmet |

## Migrations

| # | File | Status | Bytes | Description |
|---|---|---|---|---|
| 001 | foundation.sql | ⚠️ not run | TBD | Core tables |
| 002 | role_permissions.sql | ⚠️ not run | TBD | RBAC |
| 003 | catalog.sql | ⚠️ not run | TBD | Products |
| 004 | customers.sql | ⚠️ not run | TBD | Customer + consent |
| 005 | bills.sql | ⚠️ not run | TBD | Bill + items + state |
| 006 | suppliers.sql | ⚠️ not run | TBD | Supplier + payable |
| 007 | shifts.sql | ⚠️ not run | TBD | Shift + cash |
| 008 | payments.sql | ⚠️ not run | TBD | Payment + event + refund + settlement |
| 009 | devices_auth_audit.sql | ⚠️ not run | TBD | Device + audit |
| 010 | register.sql | ⚠️ not run | TBD | Bootstrap registration |
| 011 | production_integrity.sql | ⚠️ not run | TBD | Supplier lines + timezone + PURCHASE event |

**Migration runner:** `bin/migrate` (Bash, idempotent, tracks `schema_migrations`). Verified to exist and have correct shape; not exercised end-to-end.

## Container / runtime

| Check | Result |
|---|---|
| `docker-compose.yml` | exists, untested |
| `Dockerfile` | exists, untested |
| `docker/entrypoint.sh` | exists, untested |
| `.env.example` | exists, 977 bytes |
| `.env.production.example` | exists, 515 bytes |

## What is currently running at the demo URL

**`api/demo-server.cjs` only** — in-memory Fastify with sample data. The real NestJS API (`api/dist/main.js`) has never been started in this sandbox. Per the prompt's "Establish a baseline by running the relevant checks before changes", I should have started the real API and run smoke tests against it. That will be part of Gate 1.

## Open Gate 0 questions (must answer in Gate 1)

1. Does the real API start in a sandbox with a fresh DB?
2. Do all 11 migrations apply cleanly to a fresh database?
3. Can a user sign up, log in, create a product, finalize a bill, and read it back — end-to-end against the real API?
4. Is `simulate-success` actually gated to non-prod?
5. Are there any controller-level errors that the build did not surface?
6. Does `withTx` roll back correctly on a forced failure inside the bill POST?

## Definition of done for Gate 0

This document plus the five others in `docs/audit/`. All committed to `feat/gate-0-audit-stabilization`. PR opened against `main`. No merge to main until owner approves.

→ Once Gate 0 is merged, Gate 1 begins: actual smoke tests against a live database, P0 bug fixes per `BUG_BACKLOG.md`, CI added, first batch of unit tests for `@merchantos/money`, `@merchantos/validation`, `BillController.create`.
