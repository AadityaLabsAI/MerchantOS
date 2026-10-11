# MerchantOS

**Self-hosted, open-source POS, billing, payments, and khata system.**

Zero third-party APIs. Zero SaaS. Runs on a single Linux box with PostgreSQL.

## Security posture (1.1.0+)

- Store membership enforcement on every controller (OWNER bypasses, others must be a member).
- JWT access/refresh token type discrimination (a refresh token cannot be used as access).
- Refresh token revocation table; logout endpoint.
- Public registration is first-user-only (must be OWNER); subsequent users via `bin/create-user.js`.
- PG error code detection (23505/23503/23502) — no string-substring matching.
- Security headers (`X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, HSTS in production).
- Async scrypt password hashing (no event-loop blocking).
- Graceful shutdown: SIGTERM drains in-flight requests, closes the DB pool.
- DB pool tuning: 5s connect timeout, 15s statement timeout, 30-min connection recycle.

## Stack (all open-source, no paid services)

| Layer | Technology | Notes |
|---|---|---|
| Runtime | Node.js 20 | Built-in `crypto.scrypt`, `fetch`, no extra deps |
| HTTP framework | NestJS 10 + Fastify | |
| Database | PostgreSQL 15 | ULID text keys for portability |
| Validation | Zod | Type-safe schemas |
| AI (optional) | Ollama (local LLM) | Disabled by default; no external calls |
| QR codes | `qrcode` (pure-JS) | Generates locally |
| Password hashing | `node:crypto.scrypt` (async) | No bcrypt/argon2 dep needed |
| Webhook signatures | HMAC-SHA256 | `node:crypto` only |

No HTTP calls to: Razorpay, Cashfree, Stripe, OpenAI, Anthropic, Google, Twilio,
Firebase, AWS, Cloudflare, or any other third party.

## Quick start (Docker)

```bash
cp .env.production.example .env
# Edit .env: set POSTGRES_PASSWORD, JWT_*, WEBHOOK_HMAC_SECRET, SEED_USER_PASSWORD
# (secrets must be >= 32 chars; use `openssl rand -base64 48` to generate)
docker compose up -d --build
docker compose logs -f api
```

The API will be at `http://localhost:4000`. Default login:
- email: `SEED_USER_EMAIL` (default `owner@merchantos.local`)
- password: `SEED_USER_PASSWORD` (from your `.env`)

## Quick start (bare metal)

Prerequisites: Node.js 20+, PostgreSQL 15+, postgresql-client (psql).

```bash
# 1. Start postgres
sudo apt install -y postgresql postgresql-contrib
sudo pg_ctlcluster 15 main start
sudo -u postgres psql -c "CREATE DATABASE merchantos;"

# 2. Configure
cp .env.example .env
# Edit .env: set DATABASE_URL, JWT_*, WEBHOOK_HMAC_SECRET (>= 32 chars each)

# 3. Build
for p in packages/shared-types packages/money packages/crypto packages/validation packages/payments packages/qr packages/sync; do
  (cd "$p" && npm install --no-audit --no-fund && npm run build)
done
(cd api && npm install --no-audit --no-fund && npm run build)

# 4. Migrate + seed + create user
./bin/migrate
./bin/seed
node bin/create-user.js you@example.com yourpassword OWNER 01H0000000000000000000001

# 5. Run
(cd api && node dist/main.js)
```

## Verify

```bash
curl http://localhost:4000/healthz
# {"status":"ok","db":true,"time":"..."}

curl -X POST http://localhost:4000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"owner@merchantos.local","password":"yourpassword"}'
# Returns accessToken, refreshToken, user with permissions
```

## API surface

All endpoints return JSON. All errors follow `{ "error": { "code": "...", "message": "...", "fields"?: {...} } }`.

### Auth
- `POST /auth/login`            — body: `{email, password, storeId?}` → access + refresh tokens
- `POST /auth/refresh`          — body: `{refreshToken}` → new access token
- `POST /auth/logout`           — body: `{refreshToken}` → revoke (idempotent)
- `POST /auth/register`         — first-user-of-merchant only; must be OWNER
- `GET  /auth/me`               — protected: returns current user context

### Health
- `GET /healthz`                — public, no auth

### Catalog
- `GET    /api/products?storeId=…`  + `?q=…`
- `GET    /api/products/:id`
- `POST   /api/products`             — `inventory:edit`
- `POST   /api/products/:id/adjust-stock` — `{delta, reason}`

### Customers / Khata
- `GET  /api/customers?storeId=…`
- `GET  /api/customers/:id`
- `POST /api/customers` — `customers:create`
- `POST /api/customers/:id/ledger` — `khata:adjust` (signed amounts: positive CREDIT, negative DEBIT/PAYMENT)
- `GET  /api/customers/:id/ledger`

### Bills
- `GET  /api/bills?storeId=…`
- `GET  /api/bills/:id`
- `POST /api/bills` — `billing:create` (per-product tax applied automatically)
- `POST /api/bills/:id/cancel` — returns stock + reverses ledger

### Payments (in-house provider)
- `POST /api/payments/sessions` — `billing:create` — body: `{amount, deviceId?, billId?, customerId?, description?, ttlSeconds?}`
- `GET  /pay/:token` — public, returns `{amount, description, expiresAt, state}`
- `POST /api/webhooks/payments` — public, signed (HMAC-SHA256, headers: `x-merchantos-signature`, `x-merchantos-timestamp`)

### Expenses
- `GET  /api/expenses?storeId=…`
- `POST /api/expenses` — `expenses:create`

### Suppliers / Purchases
- `GET  /api/suppliers?storeId=…`
- `POST /api/suppliers` — `suppliers:create`
- `POST /api/suppliers/:supplierId/purchases` — `purchases:create`

### Shifts
- `GET  /api/shifts/current?storeId=…`
- `POST /api/shifts/open` — `shifts:manage`
- `POST /api/shifts/:shiftId/close`
- `POST /api/shifts/:shiftId/entries`

### Reports
- `GET /api/reports/today?storeId=…`
- `GET /api/reports/top-products?storeId=…&days=30` (max 365)
- `GET /api/reports/outstanding-khata?storeId=…`

### AI (local Ollama, optional)
- `POST /api/assistant/ask` — `{storeId, conversationId?, message}`
- `GET  /api/assistant/conversations`
- `GET  /api/assistant/conversations/:id/messages`

If `AI_ENABLED=false` the assistant endpoints return 503. If Ollama is
not running they return a connection error — no fallback to any third party.

## Architecture

```
packages/
  shared-types/   ← role + permission matrix, domain enums
  money/          ← bigint money arithmetic, no float
  crypto/         ← ULID, HMAC, scrypt, random tokens
  validation/     ← Zod schemas shared by API
  payments/       ← state machine (CREATED → … → VERIFIED → REFUNDED)
  qr/             ← local QR generation
  sync/           ← device sync protocol (for offline POS)
api/
  src/
    main.ts                  ← Fastify + Nest bootstrap, security headers, graceful shutdown
    app.module.ts            ← module wiring
    config/config.ts         ← env validation (zod, 32-char secret minimum)
    db/db.ts                 ← pg pool + withTx, statement timeout, connection recycling
    auth/                    ← login / refresh / logout / register / me
    auth/auth.guard.ts       ← JWT verification + type check (@Public opt-out)
    auth/jwt-helper.ts       ← access/refresh token sign/verify
    rbac/                    ← @Permissions + PermissionsGuard
    rbac/store-access.ts     ← assertStoreAccess (in-mem cached)
    observability/           ← request logger + error filter
    product/                 ← /api/products
    customer/                ← /api/customers + /ledger
    bill/                    ← /api/bills
    expense/                 ← /api/expenses
    supplier/                ← /api/suppliers + /purchases
    shift/                   ← /api/shifts
    payment/                 ← /api/payments/* + /pay + /api/webhooks
    reports/                 ← /api/reports
    ai/                      ← /api/assistant
    audit/                   ← append-only audit log
database/
  migrations/                ← 9 numbered .sql files
  seed/                      ← catalog seed
bin/
  migrate                    ← runs migrations idempotently
  seed                       ← seeds merchants/stores/products
  create-user.js             ← creates/updates a user
```

## Roles & permissions

`OWNER` (28 perms) — everything
`MANAGER` (19 perms) — no staff/settings
`CASHIER` (8 perms) — billing, customers, shifts
`ACCOUNTANT` (10 perms) — read + expenses + purchases
`STAFF` (4 perms) — read-only

## Production checklist

- [ ] Set strong secrets in `.env` (POSTGRES_PASSWORD, JWT_*, WEBHOOK_HMAC_SECRET, SEED_USER_PASSWORD) — min 32 chars
- [ ] `JWT_ACCESS_SECRET` ≠ `JWT_REFRESH_SECRET`
- [ ] `POSTGRES_PASSWORD` ≠ default
- [ ] Run behind HTTPS (caddy, nginx, or a CDN) — the API itself is HTTP
- [ ] Restrict port 5432 to localhost only
- [ ] Set `NODE_ENV=production` (disables dev simulator, masks error messages)
- [ ] Configure backups: `docker compose exec postgres pg_dump -U postgres merchantos > backup.sql`
- [ ] (Optional) Mount a cron to run `./bin/migrate` daily
- [ ] (Optional) Set up Ollama on the host and enable `AI_ENABLED=true`

## Documentation

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — system shape and request lifecycle
- [docs/DATA_MODEL.md](docs/DATA_MODEL.md) — every table, every column
- [docs/API.md](docs/API.md) — full HTTP API reference
- [docs/SECURITY.md](docs/SECURITY.md) — security controls and operational guidance
- [docs/THREAT_MODEL.md](docs/THREAT_MODEL.md) — STRIDE threat model
- [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) — step-by-step production deploy
- [docs/TESTING.md](docs/TESTING.md) — how to run and extend the test suite
- [docs/ROADMAP.md](docs/ROADMAP.md) — what's next and what is out of scope
- [docs/MONETIZATION.md](docs/MONETIZATION.md) — license, funding, what is and isn't free
- [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md) — how to contribute a change
- [docs/SELF_HOSTED_PAYMENTS_AND_REGULATORY_GATES.md](docs/SELF_HOSTED_PAYMENTS_AND_REGULATORY_GATES.md) — payment boundary and the regulatory reality
- [docs/BACKUP_RESTORE.md](docs/BACKUP_RESTORE.md) — backup format, restore procedure, restore drill
- [docs/DATA_IMPORT_EXPORT.md](docs/DATA_IMPORT_EXPORT.md) — two-phase import (preview + commit), CSV format, rollback
- [docs/PRIVACY.md](docs/PRIVACY.md) — self-hosted-first privacy policy
- [docs/CODE_OF_CONDUCT.md](docs/CODE_OF_CONDUCT.md) — Contributor Covenant v2.1
- [docs/PRODUCT_SPEC.md](docs/PRODUCT_SPEC.md) — user journeys and acceptance criteria
- [docs/REPOSITORY_AUDIT.md](docs/REPOSITORY_AUDIT.md) — what actually exists in the code, and the gaps
- [SECURITY.md](SECURITY.md) — security disclosure policy (private advisory, not public issue)
- [NOTICE](NOTICE) — third-party licenses and trademarks

## License

MIT. Use commercially. Modify. Ship.
