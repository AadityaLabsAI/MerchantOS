# MerchantOS — Security

This document describes the security controls, threat model, and operational
guidance for running MerchantOS in production. The threat model itself
(assets, adversaries, attack trees) is in `docs/THREAT_MODEL.md`.

## Trust boundaries

```
                          Public network
                                │
                                ▼
                     ┌──────────────────┐
                     │  TLS-terminating │
                     │  reverse proxy   │  (nginx, caddy, traefik, ALB)
                     └──────────────────┘
                                │
                                ▼
                     ┌──────────────────┐
                     │  MerchantOS API  │  (Node.js, non-root user)
                     └──────────────────┘
                                │
                                ▼
                     ┌──────────────────┐
                     │   PostgreSQL     │  (local socket, peer auth)
                     └──────────────────┘
```

The API process has no internet access requirement. It only needs to reach
PostgreSQL on `localhost:5432` (or the configured `DATABASE_URL`).

## Authentication

- **Password**: stored as `scrypt(password, salt, 64)` with a 16-byte random salt.
  Verification is constant-time and async (`util.promisify(crypto.scrypt)`).
- **JWT access tokens**: HS256, 15-minute TTL, signed with `JWT_SECRET` (env var).
  Payload includes `sub` (user id), `mid` (merchant id), `sids` (store ids),
  `role`, and `typ: "access"`.
- **Refresh tokens**: 30-day TTL, opaque random 32 bytes (base64url), stored as
  a SHA-256 hash in `refresh_tokens` so a DB read does not leak them. Revocation
  is by row deletion; logout deletes the refresh row.
- **Token-type discrimination**: a refresh token is rejected if used at an
  access-token endpoint (the JWT `typ` claim must be `access`). This is checked
  before any business logic, in `AuthGuard`.

## Authorization

- **Role hierarchy**: `OWNER > MANAGER > CASHIER > STAFF`. The catalog
  `permission_catalog` enumerates every action; `role_permissions` maps roles
  to those actions. A user's effective permissions are resolved at request
  time, not at token-mint time, so a role change takes effect on the next
  request.
- **Store membership**: every store-scoped endpoint requires the authenticated
  user to be a member of the target store. Membership is recorded in
  `store_memberships(user_id, store_id)`. `OWNER` bypasses membership (they
  implicitly own every store).
- **Tenant isolation**: every query joins on `merchant_id` and (where applicable)
  `store_id = ANY($storeIds)`. The merchant id comes from the JWT, never the
  request body, so a malicious client cannot craft a request that targets a
  different merchant.

## Rate limiting

A simple in-memory token-bucket rate limiter on `/auth/login` and `/auth/register`
(20 attempts per 15 minutes per IP). Sufficient for a single-tenant install.
For multi-tenant production, front the API with nginx's `limit_req` zone or a
WAF. The `X-RateLimit-Limit/Remaining/Reset` headers are emitted on every
response.

## CORS

CORS is locked down to the configured `WEB_ORIGIN` (default `http://localhost:5173`).
Credentials are required, so wildcard origins are not used. Preflight
(`OPTIONS`) returns 204 with the appropriate headers; other origins get 403.

## Security headers

Set by the API in production:

- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: no-referrer`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`
- `Strict-Transport-Security: max-age=31536000; includeSubDomains` (HTTPS only)
- `Content-Security-Policy: default-src 'self'; ...` (per-page in the SPA)

## Input validation

- **Zod schemas** at the controller boundary. Any unknown field is stripped;
  any missing required field or wrong type returns 400 with a structured error.
- **Postgres-bound parameters** are passed via the `pg` driver's parameter
  array — no string interpolation. SQL injection is not reachable from
  validated input.
- **Money fields** are parsed via the `Money` class which rejects mixed
  currencies, non-positive values where forbidden, and values that overflow
  BigInt.

## Logging

- Structured JSON logs (`pino` compatible) include `request_id`, `merchant_id`,
  `user_id`, `latency_ms`, `status_code`, and `error_code` (RFC 7807 `type`).
- PII (passwords, JWT tokens, card data) is **never** logged. The request
  logger explicitly strips `Authorization`, `Cookie`, and `Idempotency-Key`
  headers from the log line.
- Log retention is the operator's responsibility. Recommend at least 30 days
  on local disk, with off-host archive for incident response.

## Cryptographic secrets

| Secret | Env var | Where it comes from |
|---|---|---|
| JWT signing | `JWT_SECRET` | Operator-provided, ≥ 32 random bytes |
| Webhook signing | `PAYMENT_WEBHOOK_SECRET` | Operator-provided, ≥ 32 random bytes |
| Password salts | per-user random | Generated by `crypto.randomBytes(16)` at signup |
| Refresh tokens | per-token random | Generated by `crypto.randomBytes(32)` at mint |

Rotation: change `JWT_SECRET` and `PAYMENT_WEBHOOK_SECRET` by deploying a new
version. In-flight access tokens will fail verification (clients re-login
silently). Refresh tokens remain valid; users can be force-logged-out by
truncating `refresh_tokens`.

## Backup security

`bin/backup.cjs` writes to `backups/merchantos-<timestamp>.sql` in plain
text. **Treat the file as sensitive**: it contains every customer, every
transaction, every password hash. Recommended:

- Store backups in an encrypted-at-rest location (e.g. a separate volume
  with LUKS, or an S3 bucket with SSE-KMS).
- Restrict filesystem permissions: `chmod 600 backups/`.
- Never commit backup files to git (`.gitignore` excludes `backups/`).

## What is NOT claimed

- MerchantOS is not PCI-DSS certified. It does not store card numbers, CVVs,
  or expiry dates. It does not process card-present transactions.
- MerchantOS is not SOC 2 / ISO 27001 certified. The controls in this
  document are the design intent; certification requires a separate audit
  process.
- MerchantOS does not claim to "eliminate the need for a bank account or
  payment provider". It integrates the providers you choose.

## Reporting vulnerabilities

Email `security@merchantos.example` (replace with the real address before
publishing). Please do not file public issues for suspected vulnerabilities
before a fix is available.
