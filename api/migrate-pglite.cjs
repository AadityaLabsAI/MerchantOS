// Run all MerchantOS migrations against PGlite (sandbox).
require('./pglite-shim.cjs');
const { PGlite } = require('@electric-sql/pglite');
const fs = require('node:fs');
const path = require('node:path');

async function main() {
  const dir = path.resolve(__dirname, '..', 'database', 'migrations');
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.sql')).sort();
  console.log('[migrate] found ' + files.length + ' migration files');
  const db = new PGlite();
  // Wait for the WASM to be ready
  await db.waitReady;
  for (const f of files) {
    const sql = fs.readFileSync(path.join(dir, f), 'utf-8');
    console.log('[migrate] applying ' + f + ' (' + sql.length + ' bytes)');
    try {
      await db.exec(sql);
    } catch (e) {
      console.error('[migrate] FAILED on ' + f + ': ' + e.message);
      // Continue — some migrations may have IF NOT EXISTS
    }
  }
  // Seed
  const seed = fs.readFileSync(path.resolve(__dirname, '..', 'database', 'seed.sql'), 'utf-8');
  if (seed) {
    try {
      await db.exec(seed);
      console.log('[migrate] seed applied');
    } catch (e) {
      console.error('[migrate] seed failed: ' + e.message);
    }
  }
  // Dump the in-memory DB to disk so the API process can pick it up
  const dataDir = '/tmp/pglite-data';
  fs.mkdirSync(dataDir, { recursive: true });
  await db.dumpDataDir(dataDir);
  console.log('[migrate] dumped to ' + dataDir);
  // Also dump to the api directory so it can be loaded
  await db.close();
  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
