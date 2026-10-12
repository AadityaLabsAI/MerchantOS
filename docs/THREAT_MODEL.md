# MerchantOS — Threat Model

This document is a STRIDE-style threat model for the MerchantOS application.
It is intended to be read alongside `docs/SECURITY.md` (the controls) and
`docs/ARCHITECTURE.md` (the system shape).

## 1. Assets

| Asset | Where it lives | Sensitivity |
|---|---|---|
| Customer PII (name, phone, address, ledger) | `customers`, `customer_ledger_entries` | High (PII) |
| Sales transactions (bills, payments) | `bills`, `bill_items`, `payment_sessions`, `payments` | High (financial) |
| Inventory / stock counts | `products`, `stock_movements` | Medium (business value) |
| Auth credentials (password hashes, refresh tokens) | `users`, `refresh_tokens` | Critical |
| JWT signing secret | `JWT_SECRET` env var on host | Critical |
| Webhook signing secret | `PAYMENT_WEBHOOK_SECRET` env var on host | Critical |
| AI conversation history | `ai_conversations`, `ai_messages` | Medium |
| Audit log | `audit_log` | High (forensic) |
| Backups | `backups/merchantos-*.sql` | Critical (full DB plaintext) |

## 2. Adversaries

| # | Adversary | Capability | Goal |
|---|---|---|---|
| A1 | Unauthenticated attacker on the internet | Network access only | Steal data, deface UI, mine crypto |
| A2 | Authenticated low-privilege user (`STAFF`/`CASHIER`) | Legit login, can call API | Escalate to MANAGER/OWNER, see other stores, leak customer data |
| A3 | Authenticated user of merchant X | Legit login on merchant X | Read or modify data of merchant Y |
| A4 | Malicious merchant X OWNER | Full admin on merchant X | Steal merchant X's customers, prevent service to merchant X |
| A5 | Compromised backup file | File system or cloud access | Restore the DB to a hostile environment |
| A6 | Insider with DB access (DBA, sysadmin) | Shell on the DB host | Read all data, modify all data |
| A7 | Network attacker (MITM) | Position between client and server | Steal tokens, inject requests |
| A8 | Compromised dependency (npm package) | Code execution at install | Steal secrets, exfiltrate data |

## 3. Trust boundaries

```
Browser / mobile client  ───[public internet]───  Reverse proxy (TLS)
                                                       │
                                                       ▼
                                                 API process
                                                       │
                                              ┌────────┴────────┐
                                              ▼                 ▼
                                         PostgreSQL       AI (Ollama, optional)
                                              │
                                              ▼
                                         Backup volume
```

Crossings:
1. Client → reverse proxy (TLS): C1
2. Reverse proxy → API (loopback or LAN): C2
3. API → PostgreSQL (loopback or LAN): C3
4. API → Ollama (loopback, optional): C4
5. Operator → API server (SSH): C5
6. API → backup volume (filesystem): C6

## 4. STRIDE per asset

### S — Spoofing

- **S1: Forged JWT** — Mitigated: HS256 with server-side `JWT_SECRET`; constant
  payload structure; `typ` claim enforces access/refresh discrimination.
  Residual: if `JWT_SECRET` leaks (env dump, log exposure), attacker mints valid
  tokens. Operator responsibility to keep the env out of logs/backups.
- **S2: Forged webhook** — Mitigated: HMAC-SHA256 over `timestamp + body`,
  signed with `PAYMENT_WEBHOOK_SECRET`. 5-minute timestamp window prevents
  replay. The `/api/dev/simulate-success` endpoint is gated on
  `NODE_ENV !== 'production'` AND `ENABLE_PAYMENT_SIMULATOR=true`.
- **S3: Impersonation of one user by another** — Mitigated: the `sub` claim
  is taken from the JWT (not the body); password reset requires the current
  password (or OWNER override).

### T — Tampering

- **T1: SQL injection** — Mitigated: every query uses parameterized statements
  via the `pg` driver; Zod validates input shape at the controller boundary.
  Test: `api/test/security.test.ts` covers injection probes in free-text fields.
- **T2: Bill amount tampering** — Mitigated: `Money` class is the only path
  to set `subtotalMinor/taxMinor/totalMinor`; values are recomputed from line
  items server-side and verified at insert.
- **T3: Idempotency-Key spoofing to deny service** — Mitigated: keys are
  scoped to `(merchant_id, key)`, so a different merchant's keys cannot
  collide.
- **T4: Stock count tampering** — Mitigated: stock movements are
  append-only; current stock is `SUM(quantity_signed)` from movements; any
  attempt to UPDATE the products.stock column is rejected by a trigger.

### R — Repudiation

- **R1: User denies creating a bill** — Mitigated: every state change writes
  to `audit_log` with `actor_id, action, entity_type, entity_id, ip, ua,
  request_id, payload_digest, created_at`. The audit row is append-only
  (no UPDATE or DELETE grants on the role used by the API).
- **R2: Operator denies a config change** — Out of scope: deployment is the
  operator's responsibility. Recommend git-ops + signed commits.

### I — Information disclosure

- **I1: Cross-tenant data leak** — Mitigated: every query is gated by
  `WHERE merchant_id = $X` derived from the JWT. See `docs/SECURITY.md` for
  the enforcement point.
- **I2: PII in error responses** — Mitigated: the global error filter
  returns a sanitized shape; stack traces and SQL fragments are never
  included in the response (only the `code`, `message`, and `requestId`).
- **I3: PII in logs** — Mitigated: the request logger strips `Authorization`,
  `Cookie`, and `Idempotency-Key` headers. Body fields marked `@LogExclude`
  in the Zod schema are not serialized.
- **I4: Backup leak** — Operator responsibility: store backups encrypted at
  rest, restrict filesystem permissions, never commit to git.

### D — Denial of service

- **D1: Auth brute force** — Mitigated: per-IP rate limit on
  `/auth/login` and `/auth/register` (20/15min). Account lockout is a future
  enhancement.
- **D2: API flooding** — Mitigated: `pg` pool has a statement timeout
  (15s) and connection timeout (5s). Helmet adds standard security headers.
  For production, put a rate-limiter in the reverse proxy.
- **D3: Expensive report query** — Mitigated: the report endpoints use
  indexed columns and a `LIMIT` cap (10,000 rows). Long reports are
  recommended to be exported asynchronously (future enhancement).
- **D4: Disk exhaustion via audit_log** — Operator responsibility: set
  up log rotation / archival.

### E — Elevation of privilege

- **E1: STAFF/CASHIER writes to OWNER-only endpoint** — Mitigated: each
  controller method has a `@Roles(OWNER, MANAGER)` decorator (or similar);
  the global AuthGuard checks it. Permissions are read from the database at
  request time, not from the JWT.
- **E2: SQL injection → command execution** — Mitigated: parameterized
  queries only. No `eval`, `Function`, or template-literal SQL anywhere in
  the codebase. `npm audit` runs in CI to catch known vulnerable deps.
- **E3: Refresh-token replay after theft** — Mitigated: refresh tokens
  are stored as a hash; the plaintext is only returned once at mint.
  Logout deletes the row, so a stolen plaintext cannot be exchanged for
  a new access token.

## 5. Attack trees (selected)

### A1 → I1 (cross-tenant data leak)
- A1 authenticates as user U of merchant X.
- Crafts request: `GET /api/bills?storeId=<store-of-Y>`.
- Goal: receive bills of merchant Y.
- **Defense**: AuthGuard sets `storeIds` from the user's memberships. The
  controller query is `WHERE store_id = ANY($storeIds) AND merchant_id = $X`.
  Store-of-Y is not in `storeIds`, the row does not match, response is 200
  with `[]`. **Verified by `api/test/multi-tenant.test.ts`**.

### A2 → E1 (low-priv user escalates)
- A2 authenticates as CASHIER.
- Crafts request: `POST /api/products` (OWNER-only).
- Goal: create a product without permission.
- **Defense**: `ProductsController.create` is decorated with
  `@Roles('OWNER', 'MANAGER')`. AuthGuard checks the user's role against
  the allowed set; on miss, returns 403. **Verified by
  `api/test/authorization.test.ts`**.

### A3 → T1 (SQL injection)
- A3 sends `POST /api/customers` with `name: "X', '0001-01-01'); DROP TABLE
  customers; --"`.
- **Defense**: Zod schema treats `name` as a string; the `pg` driver passes
  the value as a parameter. The string is inserted as a customer name
  literally. **Verified by `api/test/security.test.ts`**.

## 6. Out-of-scope

- Physical security of the host.
- Security of the user's browser.
- Security of any third-party payment provider (their threat model is theirs).
- Compliance certifications (PCI, SOC 2, ISO 27001) — not in scope of this code
  base; operators must pursue separately.

## 7. Residual risks (operator must accept)

- A compromised operator shell can read all data. Mitigations: restrict
  SSH to a bastion, use a hardware key for operator auth, audit shell
  access.
- A compromised `JWT_SECRET` allows token minting. Mitigations: deploy via
  a secrets manager (Vault, AWS Secrets Manager), rotate quarterly.
- Database backups in plaintext. Mitigations: encrypt the volume, restrict
  read access, expire old backups.
