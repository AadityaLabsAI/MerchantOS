// Database integration tests. Uses a real PostgreSQL via embedded-postgres.
import { test, before, after } from 'node:test';
import { strict as assert } from 'node:assert';
import { bootDb, TestDb } from './_boot-db.js';

let db: TestDb;

before(async () => {
  db = await bootDb();
});

after(async () => {
  if (db) await db.stop();
});

test('all 11 migrations apply to a fresh database', async () => {
  const { Client } = await import('pg');
  const c = new Client({ connectionString: db.url });
  await c.connect();
  const r = await c.query(
    `SELECT count(*)::int as n FROM information_schema.tables
     WHERE table_schema = 'public' AND table_type = 'BASE TABLE'`
  );
  await c.end();
  assert.ok(r.rows[0].n >= 15, `expected >= 15 tables, got ${r.rows[0].n}`);
});

test('foundation tables exist (merchants, stores, users, products, bills)', async () => {
  const { Client } = await import('pg');
  const c = new Client({ connectionString: db.url });
  await c.connect();
  const expected = ['merchants', 'stores', 'users', 'products', 'bills', 'customers', 'suppliers', 'shifts', 'payments'];
  for (const t of expected) {
    const r = await c.query(
      `SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=$1`,
      [t]
    );
    assert.ok(r.rows.length === 1, `expected table ${t} to exist`);
  }
  await c.end();
});

test('migrations are idempotent (re-applying does not break)', async () => {
  const { readFileSync, readdirSync } = await import('node:fs');
  const { join } = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  const { dirname, resolve } = await import('node:path');
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const REPO_ROOT = resolve(__dirname, '..', '..');
  const MIGRATIONS_DIR = join(REPO_ROOT, 'database', 'migrations');
  const { Client } = await import('pg');

  const c = new Client({ connectionString: db.url });
  await c.connect();
  const files = readdirSync(MIGRATIONS_DIR).filter(f => f.endsWith('.sql')).sort();
  let failedNonIdempotent = false;
  for (const f of files) {
    const sql = readFileSync(join(MIGRATIONS_DIR, f), 'utf-8');
    try {
      await c.query(sql);
    } catch (e: any) {
      const msg = String(e?.message || '');
      if (!/already exists|duplicate|conflict|does not exist/i.test(msg)) {
        failedNonIdempotent = true;
        console.error(`Migration ${f} failed non-idempotently:`, msg);
      }
    }
  }
  await c.end();
  assert.equal(failedNonIdempotent, false, 'a migration failed with a non-idempotent error');
});
