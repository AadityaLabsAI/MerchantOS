#!/usr/bin/env node
/**
 * MerchantOS — backup script (pure-Node, version-agnostic).
 *
 * Strategy:
 *   1. Connect via pg client (no external pg_dump needed)
 *   2. Wrap dump in a single transaction
 *   3. For each table in public schema, emit COPY FROM stdin with tab-separated rows
 *   4. session_replication_role = replica defers FK checks during restore
 *
 * Output is plain text, version-agnostic, and can be restored with:
 *   psql $DATABASE_URL < backup.sql
 *
 * Usage: node bin/backup.cjs [output-file]
 */
const { Client } = require('pg');
const { existsSync, mkdirSync, createWriteStream, statSync } = require('node:fs');
const { join } = require('node:path');

for (const f of ['.env.production', '.env.development', '.env.test']) {
  const path = join(process.cwd(), f);
  if (existsSync(path)) {
    for (const line of require('node:fs').readFileSync(path, 'utf8').split('\n')) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
    }
  }
}

const url = process.env.DATABASE_URL;
if (!url) { console.error('DATABASE_URL not set'); process.exit(1); }

const outDir = join(process.cwd(), 'backups');
if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

const ts = new Date().toISOString().replace(/[:.]/g, '-');
const out = process.argv[2] || join(outDir, 'merchantos-' + ts + '.sql');

const escapeTabRow = (row) => row.map(v => {
  if (v === null || v === undefined) return '\\N';
  if (v instanceof Date) return v.toISOString();
  if (Buffer.isBuffer(v)) return '\\x' + v.toString('hex');
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v).replace(/[\\\t\n\r]/g, c => '\\' + c);
}).join('\t');

(async () => {
  const client = new Client({ connectionString: url });
  await client.connect();

  const r = await client.query(
    "SELECT tablename FROM pg_tables WHERE schemaname='public' " +
    "AND tablename NOT IN ('_migrations', '_migrations_lock') ORDER BY tablename"
  );
  const tables = r.rows.map(row => row.tablename);
  console.log('found', tables.length, 'tables');

  const outFh = createWriteStream(out);
  await new Promise((resolve, reject) => {
    outFh.on('error', reject);
    outFh.write('-- MerchantOS backup ' + new Date().toISOString() + '\n');
    outFh.write('-- Source: ' + url.replace(/:[^:@]*@/, ':***@') + '\n');
    outFh.write('-- Tables (' + tables.length + '): ' + tables.join(', ') + '\n');
    outFh.write('-- Restore with: psql $DATABASE_URL < this.sql\n\n');
    outFh.write('SET session_replication_role = replica;\n\n');
    resolve();
  });

  await client.query('BEGIN');
  let totalRows = 0;
  for (const t of tables) {
    const c = await client.query('SELECT count(*)::int AS n FROM "' + t + '"');
    const n = c.rows[0].n;
    totalRows += n;
    outFh.write('-- ' + t + ' (' + n + ' rows)\n');
    outFh.write('COPY "' + t + '" FROM stdin;\n');
    if (n > 0) {
      const curName = 'c_' + t.replace(/[^a-z0-9]/gi, '_');
      await client.query('DECLARE ' + curName + ' NO SCROLL CURSOR FOR SELECT * FROM "' + t + '"');
      const BATCH = 1000;
      while (true) {
        const f = await client.query('FETCH ' + BATCH + ' FROM ' + curName);
        if (f.rows.length === 0) break;
        for (const row of f.rows) {
          outFh.write(escapeTabRow(Object.values(row)) + '\n');
        }
        if (f.rows.length < BATCH) break;
      }
      await client.query('CLOSE ' + curName);
    }
    outFh.write('\\.\n\n');
    process.stdout.write('  ' + t.padEnd(28) + ' ' + n + ' rows\n');
  }
  await client.query('COMMIT');

  outFh.write('SET session_replication_role = origin;\n');
  outFh.write('-- backup end, total rows: ' + totalRows + '\n');
  outFh.end();
  await new Promise(resolve => outFh.on('close', resolve));
  await client.end();

  const size = statSync(out).size;
  console.log('\nbackup complete: ' + out);
  console.log('  ' + tables.length + ' tables, ' + totalRows + ' rows, ' + (size / 1024).toFixed(1) + ' KiB');
  process.exit(0);
})().catch(err => { console.error(err.message || err); process.exit(2); });
