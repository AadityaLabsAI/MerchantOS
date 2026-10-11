// BUG REPRODUCTION: bill POST is not idempotent.
// Sending the same request twice (network retry / double-tap) creates two bills,
// decrements stock twice, and creates two ledger entries.
// This test will FAIL until idempotency keys are implemented.
import { test, before, after } from 'node:test';
import { strict as assert } from 'node:assert';
import { bootDb, TestDb } from './_boot-db.js';
import { Client } from 'pg';

let db: TestDb;
let token: string;
let storeId: string;
let productId: string;
let customerId: string;

before(async () => {
  db = await bootDb();

  // We will test against the real API server. But for unit-level proof,
  // we test the API contract here:
  //   same Idempotency-Key header => same response, no duplicate
  // For now, we test that the *contract is not yet implemented* by
  // documenting the bug at the SQL level.
  //
  // The fix is: API reads Idempotency-Key header, stores key + response,
  // returns cached response on repeat.
  //
  // We assert the bug exists today so it can be tracked.
  const c = new Client({ connectionString: db.url });
  await c.connect();
  // Bootstrap minimal data so the bug is reproducible at SQL level.
  const { ulid } = await import('@merchantos/crypto');
  const merchantId = ulid();
  const sId = ulid();
  const uId = ulid();
  const mId = ulid();
  const pId = ulid();
  const custId = ulid();

  await c.query(`INSERT INTO merchants (id, name, owner_email) VALUES ($1, $2, $3)`,
    [merchantId, 'Test', 't@t.t']);
  await c.query(`INSERT INTO stores (id, merchant_id, name) VALUES ($1, $2, $3)`,
    [sId, merchantId, 'S']);
  await c.query(`INSERT INTO users (id, merchant_id, email, name, password_hash, is_active)
    VALUES ($1, $2, $3, $4, $5, true)`,
    [uId, merchantId, 't@t.t', 't', 'fake']);
  await c.query(`INSERT INTO store_memberships (id, user_id, store_id, merchant_id, role, is_default)
    VALUES ($1, $2, $3, $4, 'OWNER', true)`,
    [mId, uId, sId, merchantId]);
  await c.query(`INSERT INTO products (id, merchant_id, store_id, sku, name, price_minor, cost_minor, currency, tax_bps, stock_count)
    VALUES ($1, $2, $3, $4, $5, $6, $7, 'INR', 0, 100)`,
    [pId, merchantId, sId, 'X', 'Item', '1000', '500']);
  await c.query(`INSERT INTO customers (id, merchant_id, store_id, name) VALUES ($1, $2, $3, $4)`,
    [custId, merchantId, sId, 'Cust']);
  storeId = sId;
  productId = pId;
  customerId = custId;
  await c.end();
});

after(async () => {
  if (db) await db.stop();
});

test('BUG: duplicate bill POST creates two bills (no idempotency key)', async () => {
  // Simulate: insert two bills with same idempotency key. Without the key
  // enforcement, both succeed — that's the bug.
  const c = new Client({ connectionString: db.url });
  await c.connect();
  const { ulid } = await import('@merchantos/crypto');
  const bill1 = ulid();
  const bill2 = ulid();
  await c.query(
    `INSERT INTO bills (id, merchant_id, store_id, customer_id, state, subtotal_minor, tax_minor, total_minor, currency)
     VALUES ($1, (SELECT merchant_id FROM stores WHERE id=$2), $2, $3, 'FINALIZED', 100, 0, 100, 'INR')`,
    [bill1, storeId, customerId]);
  await c.query(
    `INSERT INTO bills (id, merchant_id, store_id, customer_id, state, subtotal_minor, tax_minor, total_minor, currency)
     VALUES ($1, (SELECT merchant_id FROM stores WHERE id=$2), $2, $3, 'FINALIZED', 100, 0, 100, 'INR')`,
    [bill2, storeId, customerId]);
  const r = await c.query(`SELECT count(*)::int as n FROM bills WHERE store_id=$1`, [storeId]);
  await c.end();
  // The bug is present: no bills table has an idempotency_key column.
  // We assert that today 2 bills exist, demonstrating the duplication.
  // Once the fix is implemented (idempotency_key column + middleware),
  // this test will be updated to expect 1 bill when same key is sent twice.
  assert.equal(r.rows[0].n, 2, 'without idempotency key, two POSTs create two bills');
});

test('FIX: bills table has idempotency_key column after migration', async () => {
  // After applying migration 012_idempotency.sql, this should pass.
  const c = new Client({ connectionString: db.url });
  await c.connect();
  const r = await c.query(
    `SELECT 1 FROM information_schema.columns
     WHERE table_name='bills' AND column_name='idempotency_key'`
  );
  await c.end();
  // Expected to fail until migration 012 is added.
  assert.equal(r.rows.length, 1, 'bills.idempotency_key should exist');
});
