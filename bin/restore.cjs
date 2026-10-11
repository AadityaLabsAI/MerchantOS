#!/usr/bin/env node
/**
 * MerchantOS — restore script.
 *
 * Usage: node bin/restore.cjs <dump-file> [--schema-only]
 *
 * Reads DATABASE_URL from env. Pipes the dump into psql.
 *   --schema-only  apply migrations only (alias for skipping data; manual)
 *
 * The dump must be one written by backup.cjs (or any text-format COPY dump).
 * This script does NOT apply migrations — run bin/dev/apply-migrations.cjs
 * first to create the schema, then this script to load data.
 */
const { execFileSync } = require('node:child_process');
const { existsSync } = require('node:fs');
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

const args = process.argv.slice(2);
const dump = args[0];
if (!dump) { console.error('usage: node bin/restore.cjs <dump-file>'); process.exit(1); }
if (!existsSync(dump)) { console.error('dump file not found:', dump); process.exit(1); }

try { execFileSync('psql', ['--version'], { stdio: 'ignore' }); }
catch { console.error('psql not found in PATH'); process.exit(1); }

console.log('restoring', dump, 'into', url.replace(/:[^:@]*@/, ':***@'));
try {
  execFileSync('psql', [url, '-v', 'ON_ERROR_STOP=1', '-f', dump], { stdio: 'inherit' });
} catch (e) {
  console.error('restore failed — see psql output above');
  process.exit(2);
}

console.log('restore complete');
process.exit(0);
