// Test fixture: spins up a real PostgreSQL via embedded-postgres.
// Mirrors the production bin/migrate script: creates schema_migrations first,
// then applies all *.sql files in lexical order.
import EmbeddedPostgres from 'embedded-postgres';
import { readFileSync, readdirSync, mkdtempSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { Client } from 'pg';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..', '..');
const MIGRATIONS_DIR = join(REPO_ROOT, 'database', 'migrations');

export interface TestDb {
  url: string;
  pg: EmbeddedPostgres;
  database: string;
  dataDir: string;
  port: number;
  stop: () => Promise<void>;
}

let _testCounter = 0;

function pickPort(): number {
  return 55000 + Math.floor(Math.random() * 999);
}

export async function bootDb(): Promise<TestDb> {
  _testCounter += 1;
  const id = `${process.pid}_${Date.now()}_${_testCounter}`;
  const dataDir = mkdtempSync(join(tmpdir(), `mos_test_${id}_`));
  const port = pickPort();
  const database = 'merchantos_test';
  const user = 'postgres';
  const password = 'postgres';

  const pg = new EmbeddedPostgres({
    databaseDir: dataDir,
    user, password, port, persistent: false,
  });

  await pg.initialise();
  await pg.start();
  await pg.createDatabase(database);

  const url = `postgres://${user}:${password}@127.0.0.1:${port}/${database}`;
  const client = new Client({ connectionString: url });
  await client.connect();

  // Bootstrap migrations table, exactly as bin/migrate does.
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
    } catch (e: any) {
      const msg = String(e?.message || '');
      // Idempotent migrations may fail on re-run; tolerate.
      if (!/already exists|duplicate/i.test(msg)) {
        console.error(`[bootDb] migration ${f} failed:`, msg);
        throw e;
      }
    }
  }
  await client.end();

  let stopped = false;
  return {
    url, pg, database, dataDir, port,
    stop: async () => {
      if (stopped) return;
      stopped = true;
      try { await pg.stop(); } catch { /* best-effort */ }
      try { rmSync(dataDir, { recursive: true, force: true }); } catch { /* best-effort */ }
    },
  };
}
