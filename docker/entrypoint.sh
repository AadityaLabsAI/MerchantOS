#!/bin/sh
set -e

cd /app

# Wait for Postgres to be ready
echo "[entrypoint] waiting for postgres at $DATABASE_URL ..."
i=0
until node -e "require('pg').Client({connectionString: process.env.DATABASE_URL}).connect().then(c=>c.end()).catch(e=>process.exit(1))" 2>/dev/null; do
  i=$((i+1))
  if [ $i -gt 60 ]; then
    echo "[entrypoint] postgres not reachable after 60s, giving up"
    exit 1
  fi
  sleep 1
done
echo "[entrypoint] postgres ready"

# Run migrations idempotently
echo "[entrypoint] running migrations ..."
./bin/migrate || { echo "[entrypoint] migration failed"; exit 1; }

# Seed catalog data (idempotent)
echo "[entrypoint] seeding catalog ..."
./bin/seed || { echo "[entrypoint] seed failed"; exit 1; }

# Create default user if SEED_USER_EMAIL and SEED_USER_PASSWORD are set
if [ -n "$SEED_USER_EMAIL" ] && [ -n "$SEED_USER_PASSWORD" ] && [ -n "$SEED_STORE_ID" ]; then
  echo "[entrypoint] ensuring default user $SEED_USER_EMAIL ..."
  node bin/create-user.js "$SEED_USER_EMAIL" "$SEED_USER_PASSWORD" "${SEED_USER_ROLE:-OWNER}" "$SEED_STORE_ID" ||     echo "[entrypoint] user creation skipped (likely already exists)"
fi

echo "[entrypoint] starting API on :$PORT ..."
cd /app/api
exec node dist/main.js
