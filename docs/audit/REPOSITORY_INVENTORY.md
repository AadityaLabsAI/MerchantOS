# Repository Inventory

**Audited:** 2026-10-10
**Branch:** `feat/gate-0-audit-stabilization`
**Latest main commit:** `ad35a28` — "fix: Dashboard crash from API contract mismatch + add ErrorBoundary"

## Repository layout

```
MerchantOS/
├── api/                        # Backend (NestJS + Fastify + PostgreSQL)
│   ├── src/                    # TypeScript modular monolith (23 controllers)
│   │   ├── main.ts             # Real production entry point (JWT, RBAC, CSP, CORS)
│   │   ├── app.module.ts       # NestJS module wiring
│   │   ├── auth/               # JWT, login, signup
│   │   ├── rbac/               # Role-based access, store access, membership cache
│   │   ├── audit/              # Audit logging service
│   │   ├── observability/      # Request logger, global error filter
│   │   ├── db/                 # PostgreSQL pool
│   │   ├── config/             # Env loader
│   │   ├── health/             # Health endpoint
│   │   ├── landing/            # SPA host + spa_app.js/css/html
│   │   ├── bill/               # POS bills
│   │   ├── payment/            # Payment + reconciliation
│   │   ├── product/            # Catalog
│   │   ├── customer/           # CRM
│   │   ├── supplier/           # Purchasing
│   │   ├── expense/            # Expenses
│   │   ├── shift/              # Shifts
│   │   ├── reports/            # Reports
│   │   └── ai/                 # AI assistant controller
│   ├── demo-server.cjs         # !! DEMO ONLY !! In-memory mock, no auth required
│   ├── migrate-pglite.cjs      # PGlite migration shim (for sandbox demo)
│   ├── pglite-shim.cjs         # PGlite SQL shim
│   ├── check-css.sh
│   └── package.json            # "test": "node --test test/" — but test/ is empty
├── web/                        # Frontend (TypeScript SPA)
│   ├── src/                    # TSX components, hooks, lib
│   ├── build.mjs               # esbuild pipeline
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   └── package.json
├── packages/                   # 8 shared workspace packages
│   ├── money/                  # Integer minor units, currency, rounding
│   ├── payments/               # Provider adapter contracts
│   ├── qr/                     # UPI QR code generation
│   ├── crypto/                 # Encryption helpers
│   ├── sync/                   # Offline sync engine
│   ├── validation/             # zod schemas
│   ├── security/               # Headers, auth utilities
│   └── shared-types/           # TS types shared across packages
├── database/migrations/        # 11 SQL migration files (idempotent runner in bin/migrate)
├── docker/                     # Docker entrypoint
├── bin/
│   ├── migrate                 # SQL migration runner (tracks schema_migrations)
│   ├── seed                    # Demo data seeder
│   └── create-user.js          # Bootstrap user creation
├── api/src/landing/            # Built SPA assets (spa_app.js, spa_app.css, spa_index.html)
├── docker-compose.yml
├── Dockerfile
├── .env.example
├── .env.production.example
├── README.md
├── PLAN.md                     # Earlier product plan
├── RESEARCH-BRIEF.md
├── REPORT-2026-10-09-hardening.md
└── REPORT-merchantos-1.3.0-push.md
```

## Build commands (verified working)

| Command                  | Status   | Notes                                                |
|--------------------------|----------|------------------------------------------------------|
| `npm run build:packages` | ✅ passes | All 8 packages compile clean via tsc                |
| `npm run build:web`      | ✅ passes | esbuild produces spa_app.js (502KB), spa_app.css, spa_index.html |
| `npm run build:api`      | ✅ passes | tsc compiles api/src → api/dist                     |
| `npm run build`          | ✅ passes | All of the above in sequence                        |
| `npm test`               | ❌ no tests | `api/test/` is empty; command exists but no files   |
| `npm run migrate`        | ⚠️ not run | Requires PostgreSQL; not exercised in this audit    |
| `npm run start`          | ⚠️ not run | Real API not started; demo-server.cjs was used      |

## Two parallel backends (critical finding)

The repo ships **two backend entry points** but only one is production-grade:

| Backend | File | Purpose | Status |
|---|---|---|---|
| **Real** | `api/dist/main.js` (from `api/src/main.ts`) | NestJS + Fastify + PostgreSQL + JWT + RBAC + CSP + CORS + observability | Builds clean, never started in the live demo |
| **Demo** | `api/demo-server.cjs` | In-memory Fastify with sample data, accepts ANY email/password | **What was running at the public demo URL** |

The demo server has a clear header comment:
> "!! DEMO / PREVIEW ONLY !! This server intentionally accepts ANY email/password... NEVER use this server in production. Run the real NestJS API (npm start) for real deployments."

**Implication:** every URL I shared with the user before this audit was running the demo server. The data was reset on every restart. The auth was a stub. **The user (and any visitor) was operating in a sandboxed preview, not MerchantOS proper.** This must be made explicit in any user-facing communication.

## Test coverage (verified)

| Layer | Tests | Evidence |
|---|---|---|
| Unit | 0 | `api/test/` is empty |
| Integration | 0 | No `*.test.ts` files outside node_modules |
| E2E | 0 | None found |
| Property/Invariant | 0 | None found |
| API contract | 0 | None found |

**Severity:** P0 (per prompt's "tests reproducing each bug" requirement).

## Dependency hygiene

- 8 packages, all TypeScript, all build clean
- `api/` has 153 npm dependencies (NestJS, Fastify, pg, zod, nanoid, etc.)
- No `package-lock.json` corruption observed
- No known CVEs flagged in this audit (would require `npm audit` which is offline-restricted)

## Out of scope for this inventory

- Native Android client (none exists; per prompt, Gate 5 work)
- Real payment provider integration (none configured; per prompt, Gate 4)
- AI provider integration (controller exists, no provider wired)
- Native printer drivers (none)
- E-invoicing / GST filing integration (none)

## Next audit doc

→ `ARCHITECTURE_AS_IS.md`
