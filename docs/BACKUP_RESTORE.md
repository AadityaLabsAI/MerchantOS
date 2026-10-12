# MerchantOS — Backup and Restore

**Status:** v1.0
**Scope:** all PostgreSQL data + uploads/ directory.
**Tooling:** `bin/backup.cjs`, `bin/restore.cjs`, `bin/dev/apply-migrations.cjs`.

---

## 1. What is backed up

| Category | Where | Format | Required for restore |
|---|---|---|---|
| PostgreSQL data | `bin/backup.cjs` | psql-restore compatible SQL (CREATE TABLE + COPY) | yes |
| File uploads (receipts, attachments) | `uploads/` (operator-managed) | whatever the operator stored | recommended |
| `.env.development` / `.env.production` | repo root (NOT in git) | shell | yes — required to bring the api back up |

**Currently 29 base tables** across 14 migrations. `bin/backup.cjs` walks the `public` schema, dumps every table, and emits a header that the restore script can replay. The script is pure-Node (no `pg_dump` binary required) and is portable across PostgreSQL 14/15/16.

## 2. Backup format

```
-- MerchantOS backup
-- generated_at: 2026-10-11T12:34:56Z
-- schema_version: <migration-name>
-- tables: 29
SET client_encoding TO 'UTF8';
...
CREATE TABLE merchants (
  id text PRIMARY KEY,
  ...
);
INSERT INTO merchants VALUES (...);
...
COPY products FROM stdin;
01H...\tmerchant-001\t...\t1234\n
...
```

A backup file is **a complete, self-contained SQL replay**. It does not depend on the original DB's roles, schema settings or extensions.

## 3. How to take a backup

```bash
# From the repository root:
DATABASE_URL="postgresql://USER:PASS@HOST:PORT/DB" node bin/backup.cjs > backups/merchantos-$(date +%Y%m%dT%H%M%SZ).sql
```

A compressed alternative for cron jobs:

```bash
DATABASE_URL="..." node bin/backup.cjs | gzip > backups/merchantos-$(date +%Y%m%dT%H%M%SZ).sql.gz
```

Exit codes:
- `0` — success
- `1` — could not connect, or one of the tables failed to dump
- `2` — argument error

## 4. How to restore

**This is destructive.** It drops and recreates the target database's `public` schema.

```bash
# 1. Stop the api so it cannot write while you restore.
docker compose stop api         # if using docker compose
# or
sudo systemctl stop merchantos-api  # if using systemd

# 2. Restore the SQL into the target database.
psql -v ON_ERROR_STOP=1 -d merchantos < backups/merchantos-20261011T123456Z.sql

# 3. Run the migration runner to bring the schema_version metadata in line.
node bin/dev/apply-migrations.cjs
# (It is idempotent; the already-applied migrations will no-op.)

# 4. Start the api.
docker compose start api
```

## 5. Verification (mandatory after every restore)

A restored database is only as good as your verification. Run these checks before declaring the restore complete:

```sql
-- Row count sanity
SELECT
  (SELECT count(*) FROM merchants)        AS merchants,
  (SELECT count(*) FROM stores)          AS stores,
  (SELECT count(*) FROM users)           AS users,
  (SELECT count(*) FROM products)        AS products,
  (SELECT count(*) FROM bills)           AS bills,
  (SELECT count(*) FROM customer_ledger_entries) AS ledger_entries,
  (SELECT count(*) FROM audit_log)       AS audit_log_rows;

-- Money invariant: customer balance = sum of ledger entries per customer
SELECT c.id, c.balance_minor::bigint, coalesce(sum(e.amount_minor::bigint), 0) AS ledger_sum
FROM customers c
LEFT JOIN customer_ledger_entries e ON e.customer_id = c.id
GROUP BY c.id, c.balance_minor
HAVING c.balance_minor::bigint <> coalesce(sum(e.amount_minor::bigint), 0);

-- (No rows = invariant holds. Any row is a critical data bug.)
```

Also do a smoke test: log in, open one bill, open the daily report. The numbers should match the pre-restore state.

## 6. Where to store backups

A backup on the same disk as the database is not a backup — disk failure loses both. At minimum:

- **Copy off-host** — `scp`, `rsync`, `rclone` to another machine or object storage.
- **Encrypt at rest** — `gpg --symmetric --cipher-algo AES256 < backup.sql > backup.sql.gpg`. Store the passphrase in your password manager, not next to the backup.
- **Test the restore quarterly.** A backup you have never restored is a backup you do not have.

A reasonable setup for a small merchant server:

- Daily local backup, retained 7 days, written to a separate partition.
- Weekly off-host copy (rsync to a NAS or a Hetzner storage box), retained 4 weeks.
- Monthly off-host copy, retained 12 months.

## 7. Rotation policy

| Tier | Frequency | Retention | Location |
|---|---|---|---|
| Daily | 02:00 local | 7 days | `/var/backups/merchantos/daily/` |
| Weekly | Sunday 03:00 | 4 weeks | rsync to NAS or storage box |
| Monthly | First of month | 12 months | encrypted, off-host |

## 8. Monitoring

- Alert if no backup file has been written in > 26 hours.
- Alert if the latest backup file is < 1 KB (a one-line "no tables" file is a failed dump).
- Alert if `/var/backups/merchantos/` is > 80% full.

A 5-line bash check (extend for your monitoring stack):

```bash
LATEST=$(ls -t /var/backups/merchantos/daily/ | head -1)
[ -z "$LATEST" ] && echo "ALERT: no backup" && exit 1
[ $(stat -c %Y /var/backups/merchantos/daily/$LATEST) -lt $(date -d '26 hours ago' +%s) ] && echo "ALERT: backup stale"
[ $(stat -c %s /var/backups/merchantos/daily/$LATEST) -lt 1024 ] && echo "ALERT: backup too small"
```

## 9. Disaster recovery targets

- **RPO (Recovery Point Objective):** 24 hours. Daily backup. To reduce RPO, run the backup more often (e.g. every 6 hours) and use continuous WAL archiving.
- **RTO (Recovery Time Objective):** 1 hour on the same hardware class. Includes downloading a backup, restoring into a fresh PostgreSQL instance, running migrations, and starting the api.

## 10. Partial restore (single table)

If a single table is corrupted (e.g. a bad import) and you need to restore just that table from a backup:

```bash
# 1. Dump only that table from the backup file.
grep -A 100000 "^COPY products " backups/merchantos-20261011T123456Z.sql \
  | head -n -1 > /tmp/products_only.sql
# 2. In the running database, TRUNCATE the table and replay the COPY block.
psql -d merchantos -c "TRUNCATE products CASCADE;"
psql -d merchantos < /tmp/products_only.sql
```

**Warning:** partial restore can break foreign-key references. Prefer a full restore to a scratch database, then `INSERT ... SELECT` the rows you need.

## 11. Restore drill (run this on a separate machine at least once)

```bash
# 1. On a separate machine with PostgreSQL 15:
sudo apt install -y postgresql
sudo pg_ctlcluster 15 main start
sudo -u postgres createdb merchantos_drill

# 2. Restore the latest backup into it.
psql -d merchantos_drill < backups/merchantos-LATEST.sql

# 3. Run the verification queries from §5.
# 4. Boot a temporary api instance pointing at merchantos_drill.
DATABASE_URL=postgresql://postgres@localhost/merchantos_drill \
JWT_ACCESS_SECRET=$(openssl rand -base64 48) \
JWT_REFRESH_SECRET=$(openssl rand -base64 48) \
WEBHOOK_HMAC_SECRET=$(openssl rand -base64 48) \
node api/dist/main.js &
# 5. curl -fsS http://127.0.0.1:4000/healthz → expect 200.
# 6. Log in as the seed OWNER user, open one bill, open the daily report.
# 7. Tear down. If anything was wrong, fix it before the next production backup.
```

## 12. Operational checklist

- [ ] `bin/backup.cjs` is wired into cron / systemd timer.
- [ ] Off-host copy is configured and tested.
- [ ] Backups are encrypted.
- [ ] A restore drill has been run in the last 90 days.
- [ ] The restore verification SQL above has been run end-to-end and produced 0 rows on the invariant check.
- [ ] Monitoring alerts on backup freshness and size.
- [ ] `.env.production` is backed up separately and securely (it is required to boot the api).
- [ ] Document-specific files (uploads/) are included in the backup.

If any item is unchecked, the backup story is incomplete. Do not call the deployment production-ready until all items are green.
