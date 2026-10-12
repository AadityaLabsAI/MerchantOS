# MerchantOS — Deployment

This document covers deploying MerchantOS to a single Linux host with PostgreSQL.
The architecture is a modular monolith; one Node.js process serves both the API
and the SPA assets.

## 0. Pre-flight checklist

- [ ] Linux host with systemd (Ubuntu 22.04+, Debian 12+, RHEL 9+)
- [ ] PostgreSQL 15+ running locally (or reachable via `DATABASE_URL`)
- [ ] Node.js 20.x installed
- [ ] A reverse proxy (nginx, caddy, traefik, or a cloud LB) terminating TLS
- [ ] A DNS A/AAAA record pointing at the host
- [ ] `JWT_SECRET` (≥ 32 random bytes) and `PAYMENT_WEBHOOK_SECRET` ready
- [ ] Backups configured (see step 6)

## 1. Provision the host

```bash
# 1.1 Create a non-root user
sudo useradd --system --shell /bin/bash --home /var/lib/merchantos merchantos
sudo mkdir -p /var/lib/merchantos
sudo chown merchantos:merchantos /var/lib/merchantos

# 1.2 Install PostgreSQL (Debian/Ubuntu example)
sudo apt-get update
sudo apt-get install -y postgresql postgresql-client

# 1.3 Create the database and role
sudo -u postgres psql <<'SQL'
CREATE USER merchantos WITH PASSWORD 'CHANGE_ME_STRONG_PASSWORD';
CREATE DATABASE merchantos OWNER merchantos;
\c merchantos
GRANT ALL ON SCHEMA public TO merchantos;
SQL
```

## 2. Install the application

```bash
# 2.1 Clone
sudo -u merchantos git clone https://github.com/AadityaLabsAI/MerchantOS.git \
  /var/lib/merchantos/app
cd /var/lib/merchantos/app

# 2.2 Install dependencies (production-only)
sudo -u merchantos npm ci --omit=dev

# 2.3 Build the API and the SPA
sudo -u merchantos npm run build
cd web && sudo -u merchantos npm ci --omit=dev && sudo -u merchantos npm run build && cd ..
```

## 3. Configure

```bash
sudo -u merchantos cp api/.env.example api/.env.production
sudo chmod 600 api/.env.production
sudo -u merchantos $EDITOR api/.env.production
```

Required variables:

```ini
NODE_ENV=production
PORT=3000
DATABASE_URL=postgresql://merchantos:CHANGE_ME_STRONG_PASSWORD@127.0.0.1:5432/merchantos
JWT_SECRET=<32+ random bytes>
PAYMENT_WEBHOOK_SECRET=<32+ random bytes>
API_BASE_URL=https://merchant.example.com
WEB_ORIGIN=https://merchant.example.com
ENABLE_PAYMENT_SIMULATOR=false
ENABLE_OLLAMA=false
```

Generate secrets:
```bash
node -e 'console.log(require("crypto").randomBytes(32).toString("base64url"))'
```

## 4. Apply migrations and create the first user

```bash
cd /var/lib/merchantos/app/api
# 4.1 Apply all migrations
DATABASE_URL=... node bin/dev/apply-migrations.cjs
# Expected output: 12 [apply] lines, then [done] public tables: 29

# 4.2 Create the first OWNER user
node bin/create-user.js owner@merchant.example.com 'StrongPassword!' 'Owner Name'
# Expected: created user <id> with role OWNER
```

## 5. Run as a systemd service

`/etc/systemd/system/merchantos.service`:

```ini
[Unit]
Description=MerchantOS
After=network.target postgresql.service
Wants=postgresql.service

[Service]
Type=simple
User=merchantos
Group=merchantos
WorkingDirectory=/var/lib/merchantos/app/api
EnvironmentFile=/var/lib/merchantos/app/api/.env.production
ExecStart=/usr/bin/node dist/main.js
Restart=on-failure
RestartSec=5
# Hardening
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/var/lib/merchantos/app/api/backups
# Resource limits
LimitNOFILE=65536
MemoryMax=512M
# Graceful shutdown
KillSignal=SIGTERM
TimeoutStopSec=20

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now merchantos
sudo systemctl status merchantos
```

## 6. Configure backups

```bash
# 6.1 Create a dedicated backups directory
sudo -u merchantos mkdir -p /var/lib/merchantos/app/api/backups
sudo chmod 700 /var/lib/merchantos/app/api/backups

# 6.2 Install a daily cron
sudo tee /etc/cron.d/merchantos-backup <<'CRON'
SHELL=/bin/bash
PATH=/usr/bin:/bin
0 2 * * * merchantos cd /var/lib/merchantos/app && node bin/backup.cjs /var/lib/merchantos/backups/$(date +\%Y\%m\%d).sql
CRON

# 6.3 Verify the backup file
ls -lh /var/lib/merchantos/backups/
```

**Backup retention**: keep at least 30 days of local backups, plus an
encrypted off-host copy (e.g. rclone to an S3 bucket with SSE-KMS). The
backup file is plaintext SQL — treat it as sensitive.

## 7. Front it with nginx (TLS + reverse proxy)

```nginx
server {
  listen 80;
  server_name merchant.example.com;
  return 301 https://$host$request_uri;
}

server {
  listen 443 ssl http2;
  server_name merchant.example.com;

  ssl_certificate     /etc/letsencrypt/live/merchant.example.com/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/merchant.example.com/privkey.pem;

  # Rate limit (basic DoS protection)
  limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
  limit_req zone=api burst=20 nodelay;

  # Security headers
  add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
  add_header X-Content-Type-Options "nosniff" always;
  add_header X-Frame-Options "DENY" always;
  add_header Referrer-Policy "no-referrer" always;

  # Proxy to the API
  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_read_timeout 30s;
    proxy_send_timeout 30s;
  }
}
```

```bash
sudo nginx -t && sudo systemctl reload nginx
```

## 8. Verify

```bash
# 8.1 Health check
curl -fsS https://merchant.example.com/healthz
# Expected: {"status":"ok",...}

# 8.2 Login as the OWNER
curl -fsS -X POST https://merchant.example.com/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"owner@merchant.example.com","password":"StrongPassword!"}'
# Expected: {"accessToken":"...","refreshToken":"...","user":{...}}

# 8.3 Create a product (with the access token)
ACCESS=$(curl -s -X POST ... | jq -r .accessToken)
curl -fsS -X POST https://merchant.example.com/api/products \
  -H "Authorization: Bearer $ACCESS" \
  -H 'Content-Type: application/json' \
  -d '{"name":"Test Product","sku":"TEST-001","priceMinor":"1000","currency":"INR"}'
```

## 9. Update

```bash
# Stop, pull, install, build, migrate, restart
sudo systemctl stop merchantos
cd /var/lib/merchantos/app
sudo -u merchantos git pull
sudo -u merchantos npm ci --omit=dev
cd web && sudo -u merchantos npm ci --omit=dev && sudo -u merchantos npm run build && cd ..
cd api
sudo -u merchantos npm ci --omit=dev
sudo -u merchantos npm run build
DATABASE_URL=... node bin/dev/apply-migrations.cjs
sudo systemctl start merchantos
sudo systemctl status merchantos
```

## 10. Disaster recovery

```bash
# 10.1 Install on a fresh host (steps 1-5 above)
# 10.2 Stop the API
sudo systemctl stop merchantos
# 10.3 Drop and re-create the database
sudo -u postgres psql -c 'DROP DATABASE merchantos;'
sudo -u postgres psql -c 'CREATE DATABASE merchantos OWNER merchantos;'
# 10.4 Apply migrations
cd /var/lib/merchantos/app/api
DATABASE_URL=... node bin/dev/apply-migrations.cjs
# 10.5 Restore data
node ../bin/restore.cjs /var/lib/merchantos/backups/20261011.sql
# 10.6 Restart
sudo systemctl start merchantos
```

## 11. Observability

- Logs: `journalctl -u merchantos -f`
- Health: `GET /healthz` returns 200 with `{"status":"ok",...}`
- DB: monitor connection count, replication lag (if applicable), disk usage
- Process: monitor RSS (MemoryMax=512M in the unit file is a guardrail)
