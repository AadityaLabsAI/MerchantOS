# Bug Backlog

**Audited:** 2026-10-10

## Severity scale (per prompt)

- **P0** = data loss / financial correctness / auth bypass / cross-tenant exposure / secret exposure / production crash
- **P1** = core workflow broken / major runtime/build/release blocker
- **P2** = meaningful feature/usability gap
- **P3** = polish / future scope

---

## P0 — Must fix before claiming production

### BUG-001: Demo server masquerades as production at public URL
- **Severity:** P0
- **Repro:** Open the published demo URL; observe that authentication accepts any email/password; data is in-memory; no tenant isolation; resets on restart.
- **Impact:** Anyone with the URL can read/write all sample data; misleading about real capability.
- **Affected paths:** `api/demo-server.cjs` (the only thing running), and the public-facing communication that linked to it.
- **Remediation:** Make the production NestJS API actually runnable in the sandbox (start Postgres or switch to PGlite, run migrations, expose the real `/api/*` routes), OR clearly label the demo as `sandbox-only` everywhere it is referenced.
- **Verification test:** Hit the production endpoints with a real JWT; observe 401 on missing token, 200 with valid token, audit log written, data persisted across restart.

### BUG-002: Zero automated test coverage
- **Severity:** P0
- **Repro:** `ls api/test/` → empty. `grep -r "describe\|it(" api/src --include='*.ts'` → 0 hits.
- **Impact:** Cannot prove any financial invariant. Cannot prove tenant isolation. Cannot prove idempotency. Every change is a potential regression.
- **Affected paths:** entire repo.
- **Remediation:** Add a test suite per the prompt's "Mandatory verification strategy": unit (money, tax, state transitions, permissions, inventory, ledger, timezone, idempotency, sync conflict), integration (real Postgres from empty DB + all migrations), API (auth, role matrix, tenant isolation, rate limit, pagination, error envelopes), payment (signatures, replays, duplicates, mismatches, refunds, settlement pending), E2E (onboarding → sale → receipt → stock → credit → report → export), security (IDOR, XSS, CSRF/CORS, JWT rotation, secret leaks, CSV formula injection, AI prompt injection).
- **Verification test:** `npm test` exits 0; coverage report shows money, RBAC, bill, payment, stock, khata paths exercised.

### BUG-003: No idempotency on bill creation
- **Severity:** P0
- **Repro:** `POST /api/bills` twice within 200ms with the same body (network retry / double-tap). Result: two bills, two stock decrements, two ledger entries. (Not yet observed in the real API — code path is not exercised — but the controller does not enforce an idempotency key.)
- **Impact:** Merchant can lose money or stock on duplicate bills.
- **Affected paths:** `api/src/bill/bill.controller.ts` `@Post()`.
- **Remediation:** Add `Idempotency-Key` header handling: store key in a table with response body; if same key seen, return cached response; otherwise process.
- **Verification test:** Send same bill POST twice with same key → one bill; send twice with different keys → two bills; send after success with same key again → still one bill, cached response returned.

### BUG-004: No CI
- **Severity:** P0
- **Repro:** Push to main; nothing runs. No `lint`, `typecheck`, `test`, `build`, `migrations`.
- **Impact:** A typo or broken migration can land in main silently.
- **Affected paths:** `.github/` (missing).
- **Remediation:** Add `.github/workflows/ci.yml` running `npm run build`, `npm test` (once tests exist), `psql` migration smoke, secret scan, `npm audit`.
- **Verification test:** Open a PR → required checks appear; merge blocked while red.

### BUG-005: AI controller has no provider integration
- **Severity:** P0 (per prompt: "AI never receives arbitrary SQL or unrestricted database/network access" — but no provider means no LLM at all, AND the ask endpoint exists and is exposed; tool authorization must be verified)
- **Repro:** `POST /api/ai/ask` — does the controller fetch from a real LLM? (Verified: 141 lines, has `@Post('ask')`; provider not wired in this audit pass.)
- **Impact:** If the endpoint is exposed and runs tools, the prompt-injection tests are mandatory.
- **Affected paths:** `api/src/ai/assistant.controller.ts`.
- **Remediation:** Verify tool allowlist; verify input sanitization; add unit tests for injection vectors; explicitly fail closed if no provider configured.
- **Verification test:** Send adversarial input to `/api/ai/ask`; verify no SQL injection, no system-prompt override, no tool outside allowlist.

### BUG-006: "Simulate success" payment endpoint — must be sandbox-only
- **Severity:** P0
- **Repro:** `POST /api/payment/simulate-success` is mounted (verified in route list). If reachable in production, anyone can mark a payment as verified.
- **Impact:** Merchant sees fake "payment received" with no money actually moved.
- **Affected paths:** `api/src/payment/payment.controller.ts`.
- **Remediation:** Gate the route on `NODE_ENV !== 'production'`; return 404 in prod; add a runtime check that refuses to start the controller when both `simulate-success` and `NODE_ENV=production` are configured.
- **Verification test:** `NODE_ENV=production npm start` → `POST /api/payment/simulate-success` returns 404. `NODE_ENV=development` → returns 200.

### BUG-007: No tenant isolation test
- **Severity:** P0
- **Repro:** Create user A in merchant MA, user B in merchant MB. As A, attempt `GET /api/bills?storeId=<store-in-MB>`. Code review of `assertStoreAccess` shows it does check, but no automated test exists to prove the cross-tenant case is rejected.
- **Impact:** Regression risk: any new endpoint that forgets the `assertStoreAccess` call will silently leak data.
- **Affected paths:** every controller.
- **Remediation:** Add a "tenant isolation test suite" that for every `GET/POST/PUT/DELETE` route, attempts to access it with a token from a different merchant and asserts 403/404.
- **Verification test:** Run suite → 100% pass; intentionally break `assertStoreAccess` in one controller → suite fails on that route.

---

## P1 — Major release blockers

### BUG-101: Money math in `demo-server.cjs` uses native JS numbers
- **Severity:** P1 (demo only — but it was the public face)
- **Repro:** `549 + 549 + 549` in JS = `1647.0000000002`. Real merchant demo has visible rounding noise.
- **Impact:** Misleading money display; sets wrong expectation for what MerchantOS does.
- **Remediation:** Demo server should also use `@merchantos/money` (BigInt minor units) for parity with real backend, OR clearly mark demo as not-money-accurate.

### BUG-102: No migration ordering / rollback drill documented
- **Severity:** P1
- **Repro:** `bin/migrate` runs `*.sql` lexically. It tracks `schema_migrations`, but no documented rollback path.
- **Impact:** A failed mid-migration deploy is hard to recover from.
- **Remediation:** Add a `bin/rollback` script with explicit `version` argument; document recovery procedure; add integration test that fails-fast on bad migration order.

### BUG-103: No rate limiting
- **Severity:** P1
- **Repro:** Hit `POST /api/auth/login` 1000 times → 1000 bcrypt calls → CPU spike.
- **Impact:** Auth endpoint is brute-force-vulnerable.
- **Remediation:** Add per-IP and per-account rate limit middleware; log violations; lockout after N failures.

### BUG-104: No CSP / HSTS in development
- **Severity:** P1 (acceptable in dev, must be enforced in prod — verify by env check)
- **Repro:** `main.ts` only sets CSP/HSTS when `NODE_ENV=production`. Confirm env loader defaults to development.
- **Impact:** If someone deploys without setting `NODE_ENV=production`, security headers silently off.
- **Remediation:** Make security headers unconditional for the prod binary; fail-closed on misconfig.

### BUG-105: Webhook raw body capture only on `/api/webhooks/*`
- **Severity:** P1
- **Repro:** Provider sends webhook to `/api/payments/webhook` (no `webhooks/` prefix) → raw body not captured → signature verification fails or is skipped.
- **Impact:** Webhook signature verification depends on URL pattern. Risky.
- **Remediation:** Make raw-body capture configurable per route; document pattern in `api/src/payment/payment.controller.ts`.

---

## P2 — Meaningful feature gaps (not blockers)

- BUG-201: No CSV/PDF export of any report
- BUG-202: No idempotency on `POST /api/payment/sessions` (double-tap could create two sessions)
- BUG-203: No customer consent UI (table exists, no front-end)
- BUG-204: No multi-store transfer (table references in 011 but no flow)
- BUG-205: No return/credit-note flow end-to-end
- BUG-206: No shift variance UI
- BUG-207: No batch / expiry / serial in products

## P3 — Polish / future scope

- BUG-301: Documentation gaps in `api/src/observability/` error envelopes
- BUG-302: No "open in Android app" / PWA manifest polish beyond basic icons
- BUG-303: No i18n strings on the SPA in production
- BUG-304: No scheduled backup / restore-drill proof

## Open questions requiring investigation in Gate 1

1. Is the production API actually startable in a fresh sandbox? (Audit did not start it.)
2. Does `npm run migrate` succeed against an empty database? (Audit did not run it.)
3. What is the actual current state of the `simulate-success` gate? (Comment only, not verified.)
4. Does the AI controller's tool allowlist exist and is it enforced server-side?

These will be answered in Gate 1 stabilization.

## Next audit doc

→ `THREAT_MODEL.md`
