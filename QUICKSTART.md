# Quickstart

## Option A — Docker (one command)

```bash
cp .env.production.example .env
# Edit .env: set POSTGRES_PASSWORD, JWT_*, WEBHOOK_HMAC_SECRET, SEED_USER_PASSWORD
docker compose up -d --build
docker compose logs -f api
```

Then hit `http://localhost:4000/healthz` — should return `{"status":"ok","db":true}`.

Login at `POST http://localhost:4000/auth/login` with the email + password you set in `.env`.

## Option B — Bare metal

Prereqs: Node.js 20+, PostgreSQL 15+, postgresql-client (psql).

```bash
# 1. Start postgres
sudo apt install -y postgresql postgresql-contrib
sudo pg_ctlcluster 15 main start
sudo -u postgres psql -c "CREATE DATABASE merchantos;"

# 2. Configure
cp .env.example .env
# Edit .env: DATABASE_URL, JWT_ACCESS_SECRET, JWT_REFRESH_SECRET, WEBHOOK_HMAC_SECRET

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
  -d '{"email":"owner@aaditya.test","password":"merchantos"}'
# Returns accessToken, refreshToken, user with 28 permissions
```
