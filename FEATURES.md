# ✨ MerchantOS — What It Does For You

> **One merchant. One operating system. One business ledger. Merchant-controlled infrastructure.**

MerchantOS is a complete, self-hosted business operating system built for the way Indian shops actually run — phone in one hand, kirana register in the other, UPI QR on the counter, and a credit customer reminding you about last week's atta. It replaces five separate apps (POS, inventory, Khata, expenses, reports) with one coherent system that **you own and control**.

> 🛡️ **Your data never leaves your server.** No cloud account. No subscription. No third-party SDKs reading your sales.

---

## 🎯 Who It's For

| Business | What you get |
|---|---|
| 🏪 **Kirana / general store** | Barcode-scan POS, stock counts, UPI QR payments, daily sales report |
| 👕 **Garment / footwear / electronics** | Variant tracking, batch sales, returns with stock reversal |
| 🍞 **Bakery / restaurant / takeaway** | Fast phone-based checkout, shift management, expense tracking |
| 💊 **Pharmacy** | Inventory tracking (batch/expiry: roadmap) |
| 🏭 **Wholesaler / distributor** | Supplier ledger, purchase orders, bulk pricing |
| ✂️ **Salon / service** | Customer profiles, package tracking, staff shifts |
| 🏢 **Multi-branch** | One merchant account, many stores, role-based access per store |

---

## 🚀 Get Going In 90 Seconds

```bash
git clone https://github.com/AadityaLabsAI/MerchantOS.git
cd MerchantOS
node bin/boot.cjs
```

That's it. PostgreSQL, API, and the web app are all up. Open `http://localhost:3000` in a browser. Log in with the seed OWNER and start billing.

> 📦 No Docker required. No `npm` wrestling. No `.env` puzzles. The boot script does it all.

---

## 💼 The Five Things You'll Use Every Day

### 1. 🧾 **POS & Billing**

Ring up a sale in **under five seconds**, even on a low-end Android phone.

- **Barcode scan or search** — type a name, scan a barcode, or pick from a tile grid
- **Multiple items per bill** — add as many lines as you need
- **Server-computed totals** — the API recomputes subtotal, tax and total from your line items, so a flaky network can't corrupt your money
- **Auto tax** — bill-level tax, product-level tax, or both; the system picks the right one (the famous "tax bug" that hits every POS in India is fixed)
- **Stock atomically decremented** — no overselling, even with two cashiers on the same product
- **Receipt as PDF** — `GET /api/bills/:id/receipt` returns a clean printable PDF
- **Idempotency keys** — tap "Pay" twice on a flaky network? You get one bill, not two
- **Reverse any sale** — `POST /api/bills/:id/void` undoes the bill, restocks the items, and reverses the Khata entry if it was a credit sale. The original record stays in the audit log forever.

> 💡 **Why it matters:** every other POS in the market lets a customer double-pay if you tap twice. MerchantOS does not.

### 2. 👥 **Khata / Udhaar (Customer Credit Ledger)**

This is the one feature that turns a POS into a *business* tool.

- **Customer profiles** with optional phone, address, email, notes
- **Append-only ledger** — every credit, payment, return, and adjustment is a separate, traceable entry
- **The balance is always derivable** — the displayed `balance_minor` is `SUM(ledger entries)`. It cannot drift, no matter what.
- **Four entry types:**
  - `CREDIT` — customer bought on credit, balance goes **up** (they owe you more)
  - `PAYMENT` — customer paid you back, balance goes **down**
  - `RETURN` — customer returned goods, balance goes **down**
  - `ADJUSTMENT` — manual fix with explicit sign
- **Customer statement** at `GET /api/customers/:id/ledger` — every entry, reverse chronological
- **Aging report** — who owes you the most, who hasn't paid in 90 days, who is your best customer

> 💡 **Why it matters:** in India, *most* shop sales are credit. A POS that doesn't do Khata is a toy.

### 3. 📦 **Inventory & Stock**

Know what you have, what you're running out of, and what to reorder — without a separate inventory app.

- **Products with SKU, barcode, category, price, tax rate, opening stock**
- **Stock movements** — every sale, return, purchase, damage and adjustment creates a movement. No silent balance changes, ever.
- **Low-stock threshold** per product; the report tells you what's below it
- **Days-of-cover** — how long will your current stock last at the recent sales rate
- **Barcode lookup** — `GET /api/products?barcode=...` for sub-100ms scanner hits
- **Soft delete** — archive a product without losing its sales history
- **Concurrent-safe** — two cashiers ring up the last unit of milk? One wins cleanly, the other gets a 409 `INSUFFICIENT_STOCK` with a clear message

### 4. 💰 **Shifts, Cash & Expenses**

Open the day with a counted cash drawer. Close it with a counted cash drawer. The system tells you exactly what happened in between.

- **Open a shift** with your opening cash count
- **Close a shift** with your closing cash count — the system reports the variance: expected vs. actual, with a reason field
- **Expenses** — rent, utilities, salary, inventory, marketing, travel, misc — categorized and timestamped
- **Cashbook** automatically derived from the shift's sales, expenses, and payouts
- **Multi-cashier** — every bill, expense and shift is tagged to the user who created it

> 💡 **Why it matters:** "where did the cash go?" is the oldest question in retail. A clean shift close answers it in one screen.

### 5. 📊 **Reports That Match The Books**

The reports aren't pretty dashboards with fake numbers. They are derived from the underlying records, and you can drill down to each one.

- **Sales summary** — total, count, average ticket, by day
- **Inventory report** — current stock, last movement date, days of cover
- **Customer balances** — every customer with their running balance
- **Expense report** — by category, by date range
- **Tax report** — total tax collected per period (the number your CA needs)
- **Audit log** — every state-changing action, who did it, when, from which device

Every report respects your **store filter** and your **date range**, and the totals reconcile to the underlying tables.

---

## 🔐 Security & Trust

This is not a "trust us" cloud platform. The system is auditable.

| Concern | How MerchantOS handles it |
|---|---|
| **Where is my data?** | On the server you installed it on. In PostgreSQL. That's it. |
| **Can the MerchantOS authors see my data?** | No. There is no telemetry, no analytics, no remote crash dump, no phone-home. |
| **What about passwords?** | Hashed with `scrypt` (Node built-in, no extra deps). Never stored in plaintext, never logged. |
| **What about API tokens?** | JWT access tokens (HS256, 15 min) + opaque refresh tokens (30 day, single-use rotation). |
| **What if my refresh token leaks?** | `POST /auth/logout` revokes it server-side. The next use returns 401. |
| **What if someone tries to brute-force login?** | Per-IP rate limit (30/min) + per-email rate limit (10/min) via `packages/security/src`. |
| **What if someone tries to read another store's data?** | Every query is scoped by `merchant_id` + `store_id`. Cross-tenant access returns 403. Verified by `bin/audit-tenancy.cjs`. |
| **What if I lose my server?** | `bin/backup.cjs` produces a portable SQL file. `psql < backup.sql` restores everything on a fresh PostgreSQL. The verification SQL in `docs/BACKUP_RESTORE.md` confirms the restore. |
| **What if a payment webhook is replayed?** | HMAC-SHA256 signature with 5-minute timestamp window. Replay is rejected. |
| **Are secrets in source code?** | No. `.env` files are gitignored. `JWT_*` and `WEBHOOK_HMAC_SECRET` are required to be ≥ 32 chars. |

---

## 🏗️ For The Operators (Self-Hosting)

You can install, run, and own this system without ever talking to anyone.

### What You Need

- A Linux box (Ubuntu 22.04+, Debian 12+, or any other modern Linux)
- Node.js 20+ (22 recommended)
- PostgreSQL 15+
- About 10 minutes

### How You Install It

The simplest path:

```bash
git clone https://github.com/AadityaLabsAI/MerchantOS.git
cd MerchantOS
node bin/boot.cjs
```

The script will:
1. Install PostgreSQL (if not already present)
2. Create the `merchantos` database and user
3. Install all npm dependencies for the api and the 8 workspace packages
4. Build packages and the api
5. Apply all 14 migrations (idempotent)
6. Seed sample products
7. Create the OWNER user
8. Write a `.env.development` file with safe defaults
9. Start the api on port 3000

### How You Back It Up

```bash
# A portable SQL file
DATABASE_URL="postgresql://..." node bin/backup.cjs > backup.sql

# Compressed + encrypted
DATABASE_URL="..." node bin/backup.cjs | gzip | gpg --symmetric --cipher-algo AES256 > backup.sql.gz.gpg
```

The backup is a complete, self-contained SQL replay. It does not depend on the original DB's roles, schema settings, or extensions. You can `psql < backup.sql` into a fresh PostgreSQL and you're back in business.

### How You Restore It

```bash
psql -d merchantos < backup.sql
node bin/dev/apply-migrations.cjs   # idempotent
```

### How You Verify The Restore

```sql
-- 1. Row counts make sense
SELECT (SELECT count(*) FROM bills) AS bills,
       (SELECT count(*) FROM customer_ledger_entries) AS ledger_entries;

-- 2. The customer balance invariant
SELECT c.id, c.balance_minor::bigint,
       coalesce(sum(e.amount_minor::bigint), 0) AS ledger_sum
FROM customers c LEFT JOIN customer_ledger_entries e ON e.customer_id = c.id
GROUP BY c.id, c.balance_minor
HAVING c.balance_minor::bigint <> coalesce(sum(e.amount_minor::bigint), 0);
-- (no rows = the invariant holds. Any row is a critical data bug.)
```

Full restore drill, retention policy, and off-host copy guidance: see `docs/BACKUP_RESTORE.md`.

### How You Run It In Production

The `Dockerfile` and `docker-compose.yml` give you a one-line production deploy:

```bash
cp .env.production.example .env
# Set the secrets:
#   POSTGRES_PASSWORD
#   JWT_ACCESS_SECRET       (≥ 32 chars)
#   JWT_REFRESH_SECRET      (≥ 32 chars, must differ from access)
#   WEBHOOK_HMAC_SECRET     (≥ 32 chars)
#   SEED_USER_PASSWORD
docker compose up -d --build
```

Run it behind a reverse proxy (Caddy / Traefik / Nginx) for TLS. The api speaks plain HTTP; TLS termination is the operator's job (and should be, because the operator owns the certificate).

---

## 🤖 Optional: Local AI Assistant (No Cloud, No Tracking)

A built-in assistant that knows your catalog, your customers and your sales — and answers in plain Hinglish. Runs entirely on your own machine. Nothing leaves your server.

**Sample questions it can answer:**

- *"Aaj kitna bika?"* (How much did we sell today?)
- *"Ramesh ka kitna baaki hai?"* (How much does Ramesh still owe us?)
- *"Basmati rice kitna bacha hai?"* (How much basmati rice is left?)
- *"Kal ke expenses dikhao"* (Show yesterday's expenses)
- *"Draft bill banao: 2 kg sugar, 1 litre oil"* (Make a draft bill: 2 kg sugar, 1 litre oil)

**How it works:**

- Powered by [Ollama](https://ollama.com) running locally on your server. Default model: `llama3.1:8b-instruct-q5_K_M`. Swap it for any other model you prefer.
- All conversations are stored in your own database, with your own `merchant_id` and `store_id` scoping. An AI message from store A cannot be read by a user in store B.
- AI mutations are **drafts only**. The assistant can prepare a bill, but the cashier must confirm it in the UI before it becomes a FINALIZED bill.
- AI is **off by default**. Set `AI_ENABLED=true` in `.env` to turn it on.
- If Ollama is down, the AI endpoints return a clear "AI is not configured" message. The rest of the system keeps working.

> 💡 **Why it matters:** the AI features are genuinely useful, not gimmicky. They help a busy shopkeeper ask a question in their own language and get an answer in 2 seconds.

---

## 🔌 API For Integrations

The entire system is exposed as a versioned, documented HTTP API. Every screen in the web app is just a consumer of the same API your integration will use.

- **Open standards** — REST + JSON, RFC 7807 error envelope, Bearer auth
- **Stable contracts** — versioning baked in; new endpoints are additive
- **Cursor pagination** — `?limit=` + `?offset=` on every list
- **Idempotency keys** — every state-changing POST accepts `Idempotency-Key` so retries are safe
- **Webhooks** — outbound events for the things you care about (bill paid, shift closed, low stock)
- **Webhook signature verification** — HMAC-SHA256, 5-minute window, replay protection
- **Full HTTP reference** in `docs/API.md` with example bodies for every endpoint

```bash
# Login
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"owner@merchantos.local\",\"password\":\"OwnerPass123!\"}"

# Create a bill
curl -X POST http://localhost:3000/api/bills \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: $(uuidgen)" \
  -d "{\"storeId\":\"01H...\",\"lines\":[{\"productId\":\"01H...\",\"quantity\":2}],\"taxBps\":1800}"
```

---

## 📱 The Honest State Of Mobile

Today:
- The web app is fully functional on a phone browser. It works, it's responsive, you can run your shop from a 6" screen.

Coming soon (the highest-priority P0 after this release):
- A native Kotlin Android app built with Jetpack Compose, Room and WorkManager
- Offline-first: the cashier can keep ringing up sales when the network drops; sales queue locally and sync when connectivity returns
- Barcode scanning via the camera
- Local TTS for the Soundbox feature (Hindi / English / Hinglish, fallback if a voice is missing)
- Background sync with conflict resolution

See `docs/ROADMAP.md` and `docs/PRODUCT_SPEC.md` for the full plan.

---

## 🧪 Verifiable Quality

The CI is not a marketing checkbox. It is a contract.

```
✓ 17/17 unit + integration tests pass in ~6 s
✓ 14/14 migrations apply cleanly to a fresh PostgreSQL
✓ Build clean (no TypeScript errors, no warnings on the new code)
✓ Smoke test against a running api: 15+ assertions, 0 fails
✓ Multi-stage Docker build with tini + healthcheck
```

The CI YAML is in `.github/workflows/ci.yml`. Every push triggers it. Every PR must pass it. The verification commands are the same ones in `bin/smoke-test.cjs` — you can run them on your own server too.

---

## 🤝 For Developers Who Want To Contribute

The codebase is structured to be readable and modular:

- `api/src/` — NestJS modules: `auth/`, `bill/`, `customer/`, `product/`, `payment/`, `shift/`, `expense/`, `supplier/`, `reports/`, `ai/`, `audit/`, `landing/`
- `packages/` — 8 workspace libraries: `crypto/`, `money/`, `payments/`, `qr/`, `security/`, `shared-types/`, `sync/`, `validation/`
- `database/migrations/` — 14 numbered SQL files
- `bin/` — operational scripts (migrate, seed, backup, restore, boot, smoke-test, audit-tenancy)
- `docs/` — 16 markdown documents covering architecture, API, security, deployment, backup, data import/export, product spec, threat model, repository audit, payments, privacy, contribution, code of conduct

If you want to add a new module:

```bash
git checkout -b feat/my-feature
mkdir -p api/src/myfeature
# write the controller, service, tests
(cd api && npm test)
node bin/smoke-test.cjs
git commit -m "feat(myfeature): ..."
git push origin feat/my-feature
# open a PR
```

We respond to PRs in under a week. Issues under a week. Security disclosures under 3 business days.

---

## 📜 License

MIT. Use commercially. Modify. Ship. No attribution required, but appreciated.

The third-party components are listed in `NOTICE` with their licenses.

---

## 🌟 The One-Line Pitch

> A production-grade POS, Khata, inventory, shifts, expenses and reports system that you install on your own server, that talks to your bank the way you tell it to, that you can back up and restore in one command, and that doesn't phone home.

---

## 📚 Where To Go Next

- **Try it:** `node bin/boot.cjs` → `http://localhost:3000`
- **Deploy it:** `docs/DEPLOYMENT.md`
- **Back it up:** `docs/BACKUP_RESTORE.md`
- **Extend it:** `docs/API.md` + `docs/ARCHITECTURE.md`
- **Audit it:** `docs/REPOSITORY_AUDIT.md` (what's in the code, what's not)
- **Secure it:** `docs/SECURITY.md` + `docs/THREAT_MODEL.md` + `SECURITY.md`
- **Understand the payment boundary:** `docs/SELF_HOSTED_PAYMENTS_AND_REGULATORY_GATES.md`
- **Contribute:** `CONTRIBUTING.md` + `CODE_OF_CONDUCT.md`

*Built by independent developers. Owned by the operator. No third party required.*
