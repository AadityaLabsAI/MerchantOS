# MerchantOS — Architecture

## One-sentence summary

A modular monolith (one Node.js process) for merchant operations: API + Web + worker
in one binary, one PostgreSQL database, one React SPA. Designed to be self-hosted on a
single Linux box with no third-party services required.

## Top-level layout

```
merchantos/
├── api/                Backend (NestJS 10 + Fastify)
│   ├── src/
│   │   ├── auth/             JWT auth (HS256), refresh tokens, AuthGuard
│   │   ├── billing/          Bills, bill items, money math (Money class)
│   │   ├── catalog/          Products, stock, suppliers, purchases
│   │   ├── customer/         Customers, khata, ledger entries
│   │   ├── payment/          Payment sessions, webhooks, signature verify
│   │   ├── shift/            Shifts, shift entries
│   │   ├── audit/            Audit log (append-only)
│   │   ├── middleware/       Idempotency interceptor, request logger
│   │   ├── observability/    Global error filter, health checks
│   │   ├── config/           Zod-validated env loader
│   │   └── db/               pg pool, query helpers, transactions
│   ├── test/                 Node test runner (.test.ts)
│   ├── dist/                 Build output (gitignored)
│   └── package.json
├── web/                React 19 SPA (TanStack Router, Tailwind)
│   ├── src/
│   │   ├── pages/            Routes: Dashboard, Billing, Customers, etc.
│   │   ├── components/       UI primitives
│   │   ├── lib/              api.ts, pdf.ts, whatsapp.ts, i18n
│   │   └── ...
│   ├── build.mjs             esbuild bundle
│   └── package.json
├── database/migrations/ Pure-SQL migrations, applied in order
│   ├── 001_foundation.sql
│   ├── ...
│   └── 012_idempotency.sql
├── bin/                Operational scripts
│   ├── backup.cjs            Logical backup (psql-restore compatible)
│   ├── restore.cjs           Restore from backup
│   ├── create-user.js        Add a new user (idempotent)
│   └── dev/                  Dev-only helpers
└── docs/               You are here
```

## Why a modular monolith (not microservices)?

- One merchant, one database, one process to operate. Deployment is one systemd unit.
- Domain boundaries live in code (one NestJS module per bounded context), not in network calls.
- No distributed transactions, no service discovery, no fan-out tracing.
- The shape leaves room to extract a worker process later if a workload needs isolation
  (e.g. payment webhook ingestion, scheduled reconciliation) without rewriting the API.

## Request lifecycle

```
HTTP request
  └─> Fastify adapter
        └─> NestJS pipeline
              ├─> CORS / Helmet (security headers)
              ├─> Global error filter (RFC 7807 shape, request_id attached)
              ├─> AuthGuard
              │     ├─> @Public() metadata check (bypass login/register)
              │     ├─> JWT verify (HS256, ACCESS token type)
              │     ├─> Tenant scope from JWT (merchant_id, store_ids)
              │     ├─> Idempotency-Key replay check (returns cached body)
              │     └─> req.auth = { merchantId, userId, role, storeIds }
              ├─> RequestLogger (structured JSON, request_id, latency)
              └─> Controller
                    └─> Zod parse (validation, 400 on failure)
                          └─> Service
                                └─> withTx (BEGIN; ...; COMMIT; ROLLBACK on throw)
                                      └─> query(sql, params) via pg pool
                                            └─> 4xx/5xx/201 JSON response
```

## Money: BigInt minor units

All monetary values are stored as `text` columns in **minor units** (paise for INR, cents
for USD). The API serializes BigInt as a decimal string to preserve precision through
JSON. See `api/src/money/Money.ts` and the unit tests in `api/test/money.test.ts`.

Why:
- IEEE 754 doubles lose precision at the integer boundaries where money lives.
- JavaScript `Number` is safe to ~2^53 = ~9 quadrillion — enough for any merchant
  transaction, but borderline for "sum of all sales ever" type queries.
- A `text` column + BigInt in Node is the most portable, version-agnostic representation.

## Idempotency

Every state-changing endpoint accepts an optional `Idempotency-Key: <uuid>` header.
On the first call, the response body is stored in `idempotency_keys` keyed by
`(merchant_id, key)`. On retry with the same key and same body, the cached response
is replayed without re-running the handler. This makes client retries safe: no duplicate
bills, no double stock decrements.

## Multi-tenancy

Every row has `merchant_id` (and most have `store_id`). Every query in a controller
includes `WHERE merchant_id = $X AND store_id = ANY($Y)`. The tenant scope comes from
the JWT, not from the request body — clients cannot access data for a store they are
not a member of. See `docs/THREAT_MODEL.md` for the threat model and `docs/SECURITY.md`
for the controls.

## Database access pattern

- Single `pg` pool (max 20 connections, idle 5s, statement timeout 15s)
- All money/state-changing code runs inside `withTx` which begins a transaction,
  calls the supplied function, commits on success, rolls back on throw
- Prepared statements (parameterized) only — no string interpolation
- Migrations are pure SQL files, applied in lexical order, tracked in
  `schema_migrations(version text PRIMARY KEY, applied_at timestamptz, description)`

## AI / Ollama (optional)

If `ENABLE_OLLAMA=true`, the API exposes a `/api/ai/chat` endpoint that forwards
prompts to a local Ollama instance. The default is OFF. No request ever leaves the
local network. See `docs/SECURITY.md` for what the AI is allowed to do.

## What is NOT in the architecture

- No Redis / Memcached (Postgres does the job)
- No message queue (webhook ingest is synchronous within a request)
- No object storage (receipts are generated as PDF buffers, not stored)
- No Kubernetes (one process, one VM)
- No third-party payment processor (self-hosted simulator for dev/test, real provider
  integration is a per-deployment choice — see `docs/PAYMENTS.md`)

## Versioning

`api/package.json#version` and `web/package.json#version` are kept in sync. The
`CHANGELOG.md` tracks user-visible changes.
