# MerchantOS — Data Import / Export

**Status:** v1.0
**Scope:** products, customers, suppliers, stock movements, customer ledger entries, expense categories.

---

## 1. Export

### 1.1 API export

The api exposes JSON exports under `/api/admin/export/*` (requires the `OWNER` role and the `exports:read` permission, which is granted to OWNER by default).

```bash
TOKEN=$(curl -s -X POST http://localhost:4000/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"you@merchantos.local\",\"password\":\"${SEED_USER_PASSWORD}\"}" \
  | jq -r .accessToken)

curl -fsS -H "Authorization: Bearer $TOKEN" \
  "http://localhost:4000/api/admin/export/products?storeId=01H0000000000000000000001&format=json" \
  > products.json
```

Supported query parameters: `format=json|csv`, `storeId` (required for store-scoped data), `from` and `to` for date ranges (ISO-8601).

### 1.2 Authorization and audit

Every export:

1. Requires the `exports:read` permission (and a valid `storeId` that the actor has membership in).
2. Creates an `audit_log` row with `action='export'`, `target_type=<entity>`, `actor_user_id`, `merchant_id` and `metadata={rowCount, format}`.
3. Does **not** export `password_hash`, `refresh_token_jti`, or `api_key_hash`. These are explicitly stripped at the repository layer.

### 1.3 CSV format

Header row + one row per record. Dates are ISO-8601 strings, money is integer minor units as a quoted string, currency is the 3-letter code. The export tool emits the exact format the importer accepts (round-trip stable).

```csv
id,store_id,sku,barcode,name,category,price_minor,cost_minor,currency,tax_bps,stock_count,is_active,created_at
01H...,01H...,RICE-5KG,,Tata Salt 5kg,STAPLES,22500,18000,INR,0,42,true,2026-09-01T10:00:00Z
```

## 2. Import

### 2.1 API import (preview + commit)

The api exposes `/api/admin/import/<entity>` with two phases:

**Phase 1 — preview (dry run, no writes):**

```bash
curl -fsS -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: text/csv" \
  --data-binary @products.csv \
  "http://localhost:4000/api/admin/import/products?storeId=01H...&dryRun=true"
```

Response (HTTP 200):

```json
{
  "importId": "01H...",
  "rowsTotal": 1000,
  "rowsValid": 987,
  "rowsInvalid": 13,
  "duplicates": 0,
  "errors": [
    {"row": 42, "field": "price_minor", "message": "must be a non-negative integer string"},
    {"row": 99, "field": "sku", "message": "duplicate in batch (also at row 88)"},
    ...
  ]
}
```

No database writes happen in this phase. The preview is the operator's chance to clean the source file.

**Phase 2 — commit (actual import):**

```bash
curl -fsS -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: text/csv" \
  --data-binary @products.csv \
  "http://localhost:4000/api/admin/import/products?storeId=01H...&importId=01H..."
```

The `importId` from phase 1 must be passed back. This is what prevents a re-imported copy of the same file from creating duplicate rows.

### 2.2 Duplicate detection

A row is a duplicate if:

- It has the same `(store_id, sku)` as an existing row (products), or
- It has the same `(store_id, phone)` as an existing row where phone is non-null (customers), or
- It has the same `(store_id, name)` as an existing row (suppliers), or
- It has the same `idempotency_key` (for any entity that supports it).

The importer flags duplicates in preview and refuses to insert them in commit unless the operator passes `?onDuplicate=skip|error|replace`. The default is `error` (safe).

### 2.3 Transactional and rollback

A commit runs inside a single PostgreSQL transaction. If any row in the batch fails a constraint check, the entire batch rolls back and the operator sees a `422 Unprocessable Entity` with the row that caused the failure. Partial commits are not supported; this is intentional, so a half-imported batch never leaves the database in an inconsistent state.

### 2.4 Compensation for a failed batch

If a batch fails (e.g. a constraint you didn't anticipate, or a 500 from the database), the transaction has already rolled back. There is nothing to "undo" — but you should:

1. Re-run with `dryRun=true` to see the new error.
2. Fix the offending row(s) in the source CSV.
3. Re-run the dry run, then commit.

If you actually want to reverse a successful batch (say, you imported 1000 products and the prices are wrong), the cleanest path is:

```sql
BEGIN;
DELETE FROM products WHERE created_at > '2026-10-11T12:00:00Z' AND store_id = '01H...';
COMMIT;
```

The `audit_log` will show who did the delete, when, and what was rolled back.

## 3. Worked example: importing 1000 products

Scenario: a new store, you have a 1000-row product CSV exported from a competitor.

1. **Inspect the CSV.** Make sure the header matches the documented columns. Strip any extra columns the importer doesn't recognize.

2. **Stage the file** on the server: `scp products.csv merchant@server:/srv/merchantos/import/products.csv`

3. **Dry run** as the OWNER:

   ```bash
   curl -fsS -H "Authorization: Bearer $TOKEN" \
     -H "Content-Type: text/csv" \
     --data-binary @/srv/merchantos/import/products.csv \
     "http://localhost:4000/api/admin/import/products?storeId=01H...&dryRun=true" \
     > preview.json
   ```

4. **Inspect `preview.json`**. If `rowsInvalid > 0` or `duplicates > 0`, fix the CSV and re-run the dry run.

5. **Commit**:

   ```bash
   curl -fsS -X POST -H "Authorization: Bearer $TOKEN" \
     -H "Content-Type: text/csv" \
     --data-binary @/srv/merchantos/import/products.csv \
     "http://localhost:4000/api/admin/import/products?storeId=01H...&importId=$(jq -r .importId preview.json)"
   ```

6. **Verify** in the UI: products list should show all 1000 rows. Stock counts and prices should be as in the CSV.

7. **Check `audit_log`**:

   ```sql
   SELECT id, action, target_type, actor_user_id, created_at, metadata
   FROM audit_log
   WHERE action = 'import' AND target_type = 'product'
   ORDER BY created_at DESC LIMIT 1;
   ```

8. **Move the CSV out of the import directory** so it is not re-imported by accident. Either delete it (if you have a backup) or move it to an `archive/` subdirectory with a timestamped name.

## 4. What to do for a failed import

| Failure | What to do |
|---|---|
| `dryRun=true` returns `rowsInvalid > 0` | Fix the source CSV. Re-run dry run. Do not commit. |
| `dryRun=true` returns `duplicates > 0` | Decide: skip (`?onDuplicate=skip`), error (`?onDuplicate=error`, default), or replace (`?onDuplicate=replace`). If you choose replace, take a backup first. |
| `commit` returns 422 | The transaction was rolled back. Re-run the dry run to find the offending row. Fix the CSV. |
| `commit` returns 500 | Database error (e.g. lost connection). Re-run the dry run. The transaction is already rolled back. |
| `commit` returns 200 but you notice a problem afterwards | See the DELETE example in §2.4 to roll back. Or restore the latest backup if the bad import was the only thing you did. |

## 5. Authorization matrix

| Action | OWNER | MANAGER | CASHIER | STAFF |
|---|---|---|---|---|
| Export products/customers/bills | yes | yes | view-only | no |
| Import products | yes | yes | no | no |
| Import customers | yes | yes | yes | no |
| Import bills (historical) | yes | yes | no | no |
| Export audit log | yes | no | no | no |

## 6. What is **not** exported

The exporter never includes:

- `users.password_hash`
- `refresh_tokens.jti`, `expires_at`, `revoked_at`
- `devices.api_key_hash`
- `payment_sessions.payment_token` (only the masked reference is shown)
- `webhook_signatures` and webhook raw bodies

The exporter also never includes tables that are pure infrastructure: `schema_migrations`, `notification_events` (operational, not business data).

## 7. Future work

- XLSX import (XLSX is harder to validate than CSV; defer until there is user demand).
- Streaming import for > 100k rows (current implementation reads the whole CSV into memory; rows beyond ~50k should use the upcoming `import_async` endpoint with a job ID).
- Schema-version-tagged exports: the CSV file would carry a `schema_version` header that the importer validates.
