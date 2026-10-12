#!/bin/sh
# railway-entrypoint.sh — one-click Railway entrypoint.
#
# This script is the entrypoint for the Railway template. Unlike the
# docker-compose entrypoint (which fails closed if secrets are missing),
# this one:
#
#   1. Auto-generates JWT_ACCESS_SECRET, JWT_REFRESH_SECRET and
#      WEBHOOK_HMAC_SECRET if they are not set in the environment.
#   2. Persists them to /app/.secrets so deploy restarts reuse them.
#   3. Auto-generates SEED_USER_PASSWORD if it is not set, and prints it
#      once to the deploy log so the user can log in.
#   4. Waits for PostgreSQL (Railway's DATABASE_URL) to become reachable.
#   5. Runs migrations and seeds the demo catalog.
#   6. Creates the bootstrap OWNER user from SEED_USER_EMAIL +
#      SEED_USER_PASSWORD + SEED_STORE_ID.
#   7. Starts the API on $PORT (Railway injects this).
#
# Production safety: if any of the secrets ARE set, we validate them the
# same way the compose entrypoint does (32 chars, not "changeme").

set -eu

cd /app

SECRETS_FILE="/app/.secrets"
touch "$SECRETS_FILE"
chmod 600 "$SECRETS_FILE"

# Load any previously-generated secrets (for restart persistence).
. "$SECRETS_FILE" 2>/dev/null || true

gen() {
  # 48 base64url chars = 36 random bytes. Always >= 32 chars.
  node -e 'process.stdout.write(require("crypto").randomBytes(36).toString("base64url"))'
}

ensure_secret() {
  name="$1"
  eval "val=\${$name:-}"
  case "$val" in
    ""|change-me*|changeme*)
      new="$(gen)"
      echo "$name=$new" >> "$SECRETS_FILE"
      export "$name=$new"
      echo "[railway-entrypoint] generated $name (48 chars, persisted to /app/.secrets)"
      ;;
    *)
      # Validate
      if [ "${#val}" -lt 32 ]; then
        echo "[railway-entrypoint] $name is set but is < 32 chars — refusing to boot" >&2
        exit 1
      fi
      export "$name=$val"
      ;;
  esac
}

for n in JWT_ACCESS_SECRET JWT_REFRESH_SECRET WEBHOOK_HMAC_SECRET; do
  ensure_secret "$n"
done

# Refresh secret must differ from access. Auto-fix if both are unset and
# happen to collide by regenerating refresh.
if [ "${JWT_ACCESS_SECRET:-}" = "${JWT_REFRESH_SECRET:-}" ]; then
  new="$(gen)"
  sed -i "s|^JWT_REFRESH_SECRET=.*|JWT_REFRESH_SECRET=$new|" "$SECRETS_FILE"
  export JWT_REFRESH_SECRET="$new"
  echo "[railway-entrypoint] regenerated JWT_REFRESH_SECRET because it matched JWT_ACCESS_SECRET"
fi

# SEED_USER_PASSWORD: auto-generate if missing. The log line tells the
# user what password to use on first login. (Compose sets this manually;
# Railway one-click users get a generated one.)
if [ -z "${SEED_USER_PASSWORD:-}" ]; then
  SEED_USER_PASSWORD="$(gen)"
  echo "SEED_USER_PASSWORD=$SEED_USER_PASSWORD" >> "$SECRETS_FILE"
  export SEED_USER_PASSWORD
  echo ""
  echo "================================================================"
  echo "  MerchantOS ONE-CLICK FIRST RUN"
  echo "  Login email:    ${SEED_USER_EMAIL:-owner@merchantos.local}"
  echo "  Login password: $SEED_USER_PASSWORD"
  echo "  (Password persisted to /app/.secrets inside the container;"
  echo "   it is also printed here once. Change it after first login.)"
  echo "================================================================"
  echo ""
fi

case "$SEED_USER_PASSWORD" in
  change-me*|changeme*) echo "[railway-entrypoint] SEED_USER_PASSWORD is a placeholder" >&2; exit 1 ;;
esac
if [ "${#SEED_USER_PASSWORD}" -lt 16 ]; then
  echo "[railway-entrypoint] SEED_USER_PASSWORD must be >= 16 chars" >&2
  exit 1
fi

# Default SEED_USER_EMAIL if missing
: "${SEED_USER_EMAIL:=owner@merchantos.local}"
export SEED_USER_EMAIL

# Wait for PostgreSQL (up to 90s — Railway sometimes takes a while to
# wire up the private network between services).
echo "[railway-entrypoint] waiting for postgres..."
i=0
until node -e '
  const { Client } = require("pg");
  const c = new Client({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 2000 });
  c.connect().then(() => c.end()).catch(() => process.exit(1));
' 2>/dev/null; do
  i=$((i + 1))
  if [ "$i" -gt 90 ]; then
    echo "[railway-entrypoint] postgres not reachable after 90s" >&2
    exit 1
  fi
  sleep 1
done
echo "[railway-entrypoint] postgres ready"

# Find the default store id so we can attach the OWNER to it. The seed
# script creates a known store; we look up its id from the database.
SEED_STORE_ID="$(node -e '
  const { Client } = require("pg");
  const c = new Client({ connectionString: process.env.DATABASE_URL });
  c.connect()
    .then(() => c.query("select id from stores order by created_at asc limit 1"))
    .then(r => { process.stdout.write(r.rows[0] ? r.rows[0].id : ""); return c.end(); })
    .catch(() => process.exit(0));
')"
if [ -z "$SEED_STORE_ID" ]; then
  echo "[railway-entrypoint] no store found after seed; this should not happen"
  exit 1
fi
export SEED_STORE_ID
echo "[railway-entrypoint] seed store: $SEED_STORE_ID"

echo "[railway-entrypoint] running migrations..."
./bin/migrate

echo "[railway-entrypoint] seeding demo catalog (idempotent)..."
./bin/seed

echo "[railway-entrypoint] ensuring bootstrap user exists..."
node bin/create-user.js "$SEED_USER_EMAIL" "$SEED_USER_PASSWORD" "${SEED_USER_ROLE:-OWNER}" "$SEED_STORE_ID"

echo "[railway-entrypoint] starting API on :${PORT:-4000}..."
cd /app/api
exec node dist/main.js
