# MerchantOS on Railway — One-Click Deploy

This document describes the **one-click Railway deploy** of MerchantOS.
The whole stack (PostgreSQL + API + web SPA) is provisioned as a single
Railway project. Click the button, set one variable, and you are live.

---

## 1. One-Click Deploy

Click the button in the README or visit the marketplace listing:

[![Deploy on Railway](https://railway.com/button.svg)](https://railway.com/deploy/merchantos?referralCode=)

When prompted, Railway will ask for **one** variable (the rest are auto-generated on first boot):

| Variable | Required? | Description |
|---|---|---|
| `SEED_USER_EMAIL` | optional | Email of the bootstrap OWNER. Default: `owner@merchantos.local` |
| `SEED_USER_PASSWORD` | optional | Password of the bootstrap OWNER. **If you leave it empty, a 48-character password is auto-generated and printed to the deploy log once.** You will not see it again unless you read it from `/app/.secrets` in the container. |

Hit **Deploy**. ~3 minutes later you have a live MerchantOS at a `*.up.railway.app` URL.

---

## 2. What you get

After the first deploy finishes, the Railway project contains:

| Service | Image / Source | Purpose |
|---|---|---|
| `Postgres` | `postgres:15-alpine` (Railway one-click add) | Primary data store |
| `MerchantOS` | Dockerfile.railway (this repo) | API + embedded web SPA |

Networking: Railway wires the two with **private networking** over `RAILWAY_PRIVATE_DOMAIN`. The api service is the only one with a **public domain** (`RAILWAY_PUBLIC_DOMAIN`).

Migrations, demo-catalog seed, and OWNER-user creation happen **inside the container on every boot** via `docker/railway-entrypoint.sh`. The script is idempotent.

---

## 3. What happens on first boot (read the deploy log)

The first time the container starts, you will see something like this in the build/deploy log:

```
[railway-entrypoint] generated JWT_ACCESS_SECRET (48 chars, persisted to /app/.secrets)
[railway-entrypoint] generated JWT_REFRESH_SECRET (48 chars, persisted to /app/.secrets)
[railway-entrypoint] generated WEBHOOK_HMAC_SECRET (48 chars, persisted to /app/.secrets)

================================================================
  MerchantOS ONE-CLICK FIRST RUN
  Login email:    owner@merchantos.local
  Login password: aB3kZ-t9wPqLm2V...        (48 chars, base64url)
  (Password persisted to /app/.secrets inside the container;
   it is also printed here once. Change it after first login.)
================================================================

[railway-entrypoint] waiting for postgres...
[railway-entrypoint] postgres ready
[railway-entrypoint] seed store: 01HXXXXXXXXXXXXXXXXXXXXXX
[railway-entrypoint] running migrations...      (12 [apply] lines)
[railway-entrypoint] seeding demo catalog (idempotent)...
[railway-entrypoint] ensuring bootstrap user exists...
[railway-entrypoint] starting API on :4000...
```

Copy the **login email** and **login password** from that log. Use them at `https://<your-app>.up.railway.app`.

> The auto-generated password is **also** written to `/app/.secrets` inside the container, so it persists across restarts and redeploys as long as the container's writable layer is preserved (Railway default: yes).

> **Change the OWNER password** from the in-app account settings as soon as you log in. There is no email-recovery path on a self-hosted instance.

---

## 4. Environment variables (the complete list)

The Railway template pre-fills defaults for these. You can override any of them from the Railway dashboard → MerchantOS service → Variables.

### Required (auto-set by Railway when you add the Postgres service)

| Variable | Source | Notes |
|---|---|---|
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` | The api's `pg` pool reads this directly. |
| `PORT` | Railway | Railway injects a public port. The api listens on it. |

### Optional (the user can override the auto-generated values)

| Variable | Default | Purpose |
|---|---|---|
| `NODE_ENV` | `production` | Do not change unless you know what you are doing. |
| `JWT_ACCESS_SECRET` | auto-generated 48 chars | Min 32 chars. A leaked access token allows the holder to act as the user for 15 min. |
| `JWT_REFRESH_SECRET` | auto-generated 48 chars | Min 32 chars. Must differ from `JWT_ACCESS_SECRET`. A leaked refresh token allows the holder to obtain new access tokens for 30 days. |
| `WEBHOOK_HMAC_SECRET` | auto-generated 48 chars | Min 32 chars. Used to verify inbound payment-provider webhooks. |
| `SEED_USER_EMAIL` | `owner@merchantos.local` | Bootstrap OWNER email. |
| `SEED_USER_PASSWORD` | auto-generated 48 chars | Bootstrap OWNER password. Persisted to `/app/.secrets`. |
| `SEED_USER_ROLE` | `OWNER` | Bootstrap role. |
| `API_BASE_URL` | `${{RAILWAY_PUBLIC_DOMAIN}}` | Where the API believes it lives. Used in QR-code links. |
| `WEB_BASE_URL` | `${{RAILWAY_PUBLIC_DOMAIN}}` | Used in email/SMS links (not used yet; placeholder). |
| `CORS_ORIGINS` | empty | Comma-separated list of allowed CORS origins. Empty = allow none cross-origin (the SPA is same-origin anyway). |
| `TRUSTED_PROXIES` | empty | Comma-separated exact IPs/CIDRs that may set `X-Forwarded-For`. Railway's edge IPs are already trusted via the `TRUSTED_PROXIES` env injected by Railway's platform; you do not need to set this unless you put another proxy in front. |
| `AI_ENABLED` | `false` | Set to `true` to enable the Ollama-powered assistant. You must also run an Ollama service reachable at `OLLAMA_BASE_URL`. The free Railway plan cannot run Ollama (too memory-hungry); the Hobby plan and above can. |
| `OLLAMA_BASE_URL` | `http://127.0.0.1:11434` | Where to reach Ollama. |
| `OLLAMA_MODEL` | `llama3.1:8b-instruct-q5_K_M` | Which model to use. |
| `RATE_LIMIT_DISABLED` | `false` | Set to `true` only in tests. Production should leave it `false`. |

---

## 5. The "true" one-click flow (zero variables to set)

If you just want to try MerchantOS, click Deploy, leave the variables page empty, and hit Deploy. The entrypoint will:

1. Wait for Postgres.
2. Generate three 48-char secrets and one 48-char seed-user password.
3. Print the seed-user password to the deploy log **once**.
4. Run migrations, seed the demo catalog, create the OWNER user.
5. Start the API.

To read the password later: Railway dashboard → MerchantOS service → **Shell** tab → `cat /app/.secrets`.

---

## 6. The "production" flow (bring your own secrets)

For a real production deploy, override the auto-generated values:

```bash
# Generate 4 strong secrets (run on your laptop)
node -e 'for(let i=0;i<4;i++) console.log(require("crypto").randomBytes(48).toString("base64url"))'
```

In Railway → MerchantOS service → Variables, set:

- `JWT_ACCESS_SECRET` = first value
- `JWT_REFRESH_SECRET` = second value (must differ from the first)
- `WEBHOOK_HMAC_SECRET` = third value
- `SEED_USER_PASSWORD` = fourth value (this is the only one you need to remember)

The auto-generation only fires when these are empty. The first time you set them, the entrypoint will validate they are 32+ chars and reject "changeme" placeholders.

---

## 7. Verify

Once the deploy is green, hit `/healthz`:

```bash
curl -fsS https://<your-app>.up.railway.app/healthz
# {"status":"ok","db":true,"time":"..."}
```

Then log in to the web UI at `https://<your-app>.up.railway.app` with the OWNER email and the password (from the deploy log, or the one you set).

To create more users after the first one, use `bin/create-user.js` over Railway Shell:

```bash
# Railway dashboard → MerchantOS → Shell tab
node bin/create-user.js manager@yourdomain.com 'TheirPassword' 'MANAGER' 01HXXXXXXXXXXXXXXXXXXXXXX
```

(The store id is the same one the seed created; you can find it with
`node -e 'const{Client}=require("pg");const c=new Client({connectionString:process.env.DATABASE_URL});c.connect().then(()=>c.query("select id,name from stores")).then(r=>{console.log(r.rows);return c.end()})'`.)

---

## 8. Persistent volume for backups (recommended for production)

The Postgres service is durable on Railway (its data lives on Railway's managed volume). But the app container's `/app/.secrets` and `/app/backups` are **not** persistent across container restarts unless you mount a volume.

To set up a backups volume:

1. Railway → MerchantOS service → **Settings** → **Volumes** → **New Volume**.
2. Mount path: `/app/backups`.
3. Set up a scheduled task (Railway → **Cron**) to run daily:
   ```
   0 2 * * * node /app/bin/backup.cjs /app/backups/merchantos-$(date -u +%Y%m%dT%H%M%SZ).sql
   ```
4. Periodically `scp` the files from the volume (or use `railway run cat /app/backups/...` via the CLI).

See `docs/BACKUP_RESTORE.md` for the full backup/restore/verify procedure.

---

## 9. Custom domain

Railway → MerchantOS service → **Settings** → **Domains** → **Custom Domain**:
add `merchant.yourdomain.com`. Then add a CNAME record at your DNS provider:

```
merchant.yourdomain.com  CNAME  <your-app>.up.railway.app
```

Railway provisions a Let's Encrypt certificate automatically.

Once the custom domain is live, update:
- `API_BASE_URL=https://merchant.yourdomain.com`
- `WEB_BASE_URL=https://merchant.yourdomain.com`

Then redeploy so QR-code links etc. point at the new domain.

---

## 10. Costs

Railway's pricing is pay-per-GB-second of usage. A small merchant instance (Postgres 1 GB + api 1 GB + 50 GB egress/mo) lands in the **$5–10/mo** range on the Hobby plan. See <https://railway.com/pricing>.

---

## 11. Local development with the same Dockerfile

You can reproduce the Railway flow on a laptop with Docker:

```bash
# 1. Clone
git clone -b feat/railway-one-click-deploy https://github.com/AadityaLabsAI/MerchantOS.git
cd MerchantOS

# 2. Build the Railway image
docker build -f Dockerfile.railway -t merchantos:dev .

# 3. Run with a local Postgres
docker run -d --name mos-postgres -e POSTGRES_PASSWORD=devpass -e POSTGRES_DB=merchantos postgres:15-alpine
docker run -d --name mos-app --link mos-postgres -p 4000:4000 \
  -e DATABASE_URL=postgresql://postgres:devpass@mos-postgres:5432/merchantos \
  merchantos:dev

# 4. Watch the log for the auto-generated password
docker logs -f mos-app

# 5. Open http://localhost:4000
```

The same auto-generation flow runs locally, so you can test the production-like boot path before deploying.

---

## 12. Troubleshooting

### "railway-entrypoint: postgres not reachable after 90s"

Railway's private networking between services can take up to 90 seconds on the first boot. If it exceeds that, check:

- Railway → Postgres service → **Variables** → `DATABASE_URL` is set and the api service can reference it as `${{Postgres.DATABASE_URL}}`.
- The Postgres service is in the same environment (production) as the api.

### "Invalid environment configuration: JWT_ACCESS_SECRET must be >= 32 chars"

You set a value shorter than 32 chars. Either clear the variable (auto-generation takes over) or set a longer one.

### "MongoServerSelectionError" / "ECONNREFUSED 127.0.0.1:5432"

The api is trying to reach Postgres on localhost (the default in `bin/migrate`) instead of the Railway private network. Make sure `DATABASE_URL` is set in the api service's Variables, not just in the Postgres service.

### "Railpack could not determine how to build"

Railway ignored `railway.toml` and tried to auto-detect the build. This happens if the file is malformed or if the project was created before `railway.toml` was added. Fix:

1. Verify `railway.toml` is at the **repository root** and is valid TOML.
2. Redeploy. If the issue persists, in the dashboard: **Service → Settings → Config File → set to `/railway.toml`**.

### I lost the auto-generated password

Railway → MerchantOS service → **Shell** → `cat /app/.secrets`. If the container was redeployed with a fresh filesystem (not a restart but a true rebuild), the secrets are gone. You then need to either:

- Set `SEED_USER_PASSWORD` in Variables (and let the other three auto-regenerate), or
- Reset the OWNER's password via `node bin/create-user.js` from the Shell (this script does NOT reset an existing user; you have to delete the row first or use a different email).

### "Port 4000 is in use"

Railway sets `PORT`. The api reads it. The Dockerfile.railway also sets `ENV PORT=4000` as a fallback. There is no port conflict on Railway's side; the `4000` is just the in-container port. The public port is whatever Railway gives you.

---

## 13. Future-proof: migrate to Infrastructure as Code

Railway is replacing `railway.toml` / `railway.json` (Config as Code, deprecated, hard cutoff **2026-12-01**) with **Infrastructure as Code** at `.railway/railway.ts`. The new model lets you declare the **whole project** (services, databases, volumes, variables) in a single TypeScript file checked into the repo.

The IaC equivalent of the one-click template is:

```typescript
// .railway/railway.ts
import { service, postgres, env, secrets } from "@railway/core";

const db = postgres({ name: "merchantos-db" });

const api = service("merchantos", {
  source: { repo: "https://github.com/AadityaLabsAI/MerchantOS" },
  dockerfile: "Dockerfile.railway",
  variables: {
    DATABASE_URL: db.DATABASE_URL,
    NODE_ENV: "production",
    SEED_USER_EMAIL: "owner@merchantos.local",
    // JWT_ACCESS_SECRET, JWT_REFRESH_SECRET, WEBHOOK_HMAC_SECRET
    // and SEED_USER_PASSWORD are auto-generated on first boot.
  },
  healthcheck: "/healthz",
  port: 4000,
});
```

When Railway hard-cuts the old Config as Code, the one-click button will keep working because the deploy button points at this repo; the project's IaC file is what changes. For now, both work; pick whichever your Railway project was created with.

---

## 14. Files added in this branch

- `railway.toml` — single-service config-as-code
- `railway.json` — JSON mirror of `railway.toml`
- `Dockerfile.railway` — same multi-stage build, with the auto-secret entrypoint
- `docker/railway-entrypoint.sh` — auto-generates missing secrets, waits for Postgres, runs migrations, seeds, creates OWNER, starts the API
- `nixpacks.toml` — disables Railpack/Nixpacks auto-detection
- `Procfile` — explicit start command for any Railpack-style fallback
- `docs/DEPLOY_RAILWAY.md` — this document

The original `Dockerfile` and `docker/entrypoint.sh` (the fail-closed ones for `docker compose`) are untouched.
