
const { Client } = require('pg');
const { readFileSync, readdirSync } = require('node:fs');
const { join, resolve } = require('node:path');

const REPO_ROOT = '/home/user/repo';
const MIGRATIONS_DIR = join(REPO_ROOT, 'database', 'migrations');

(async () => {
  const client = new Client({ connectionString: 'postgres://merchantos:merchantos@127.0.0.1:5432/merchantos' });
  await client.connect();
  // bootstrap
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now(),
      description text
    );
  `);
  const files = readdirSync(MIGRATIONS_DIR).filter(f => f.endsWith('.sql')).sort();
  for (const f of files) {
    const sql = readFileSync(join(MIGRATIONS_DIR, f), 'utf-8');
    try {
      await client.query(sql);
      console.log('[apply] ' + f);
    } catch (e) {
      const msg = String(e.message || '');
      if (/already exists|duplicate/i.test(msg)) {
        console.log('[skip]  ' + f + ' (already applied)');
      } else {
        console.error('[FAIL]  ' + f + ': ' + msg);
        throw e;
      }
    }
  }
  const r = await client.query('SELECT count(*) as n FROM schema_migrations');
  console.log('[done] schema_migrations rows: ' + r.rows[0].n);
  const t = await client.query(`SELECT count(*) as n FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'`);
  console.log('[done] public tables: ' + t.rows[0].n);
  await client.end();
})().catch(e => { console.error(e); process.exit(1); });
