#!/bin/sh
set -eu

cd /app

# Fail closed on placeholders: the compose file must receive real, generated secrets.
case "${POSTGRES_PASSWORD:-}" in
  ""|postgres|change-me*|changeme*) echo "[entrypoint] POSTGRES_PASSWORD must be generated, not a placeholder" >&2; exit 1 ;;
esac
for name in JWT_ACCESS_SECRET JWT_REFRESH_SECRET WEBHOOK_HMAC_SECRET; do
  eval "value=\${$name:-}"
  case "$value" in
    ""|change-me*|changeme*) echo "[entrypoint] $name must be generated, not a placeholder" >&2; exit 1 ;;
  esac
  if [ "${#value}" -lt 32 ]; then echo "[entrypoint] $name must be at least 32 characters" >&2; exit 1; fi
done
case "${SEED_USER_PASSWORD:-}" in
  ""|change-me*|changeme*) echo "[entrypoint] SEED_USER_PASSWORD must be generated, not a placeholder" >&2; exit 1 ;;
esac
if [ "${#SEED_USER_PASSWORD}" -lt 16 ]; then echo "[entrypoint] SEED_USER_PASSWORD must be at least 16 characters" >&2; exit 1; fi

# Wait for PostgreSQL using the pg Client constructor (new is required).
echo "[entrypoint] waiting for postgres..."
i=0
until node -e 'const { Client }=require("pg"); const c=new Client({connectionString:process.env.DATABASE_URL, connectionTimeoutMillis:2000}); c.connect().then(()=>c.end()).catch(()=>process.exit(1))' 2>/dev/null; do
  i=$((i+1))
  if [ "$i" -gt 60 ]; then
    echo "[entrypoint] postgres not reachable after 60s, giving up" >&2
    exit 1
  fi
  sleep 1
done
echo "[entrypoint] postgres ready"

echo "[entrypoint] running migrations..."
./bin/migrate

echo "[entrypoint] seeding demo catalog..."
./bin/seed

if [ -n "${SEED_USER_EMAIL:-}" ] && [ -n "${SEED_USER_PASSWORD:-}" ] && [ -n "${SEED_STORE_ID:-}" ]; then
  echo "[entrypoint] ensuring bootstrap user exists..."
  # create-user.js must never overwrite an existing user's password at restart.
  node bin/create-user.js "$SEED_USER_EMAIL" "$SEED_USER_PASSWORD" "${SEED_USER_ROLE:-OWNER}" "$SEED_STORE_ID"
fi

echo "[entrypoint] starting API on :${PORT:-4000}..."
cd /app/api
exec node dist/main.js
