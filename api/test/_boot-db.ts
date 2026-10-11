// Test fixture for the API integration tests.
// Spins up a real PostgreSQL on a random port. By default it uses
// embedded-postgres (downloads a real postgres binary, ~30MB, takes ~15s
// to initialise on a cold runner). If TEST_DATABASE_URL is set in the
// environment, that URL is used directly and embedded-postgres is not
// invoked. This lets CI reuse its already-running service container
// and skip the binary download.
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
  pg: EmbeddedPostgres | null;
  database: string;
  dataDir: string | null;
  port: number;
  stop: () => Promise<void>;
}

let _testCounter = 0;

function pickPort(): number {
  return 55000 + Math.floor(Math.random() * 999);
}

function parseUrl(u: string): { port: number; database: string; user: string; password: string } {
  const parsed = new URL(u);
  return {
    port: Number(parsed.port || 5432),
    database: parsed.pathname.replace(/^\//, '') || 'postgres',
    user: decodeURIComponent(parsed.username),
    password: decodeURIComponent(parsed.password),
  };
}

async function applyMigrations(url: string): Promise<void> {
  const client = new Client({ connectionString: url });
  await client.connect();
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
      if (!/already exists|duplicate/i.test(msg)) {
        console.error(`[bootDb] migration ${f} failed:`, msg);
        throw e;
      }
    }
  }
  await client.end();
}

export async function bootDb(): Promise<TestDb> {
  _testCounter += 1;

  // Fast path: reuse an externally-provided database (CI service container).
  const external = process.env.TEST_DATABASE_URL;
  if (external) {
    const { port, database } = parseUrl(external);
    await applyMigrations(external);
    return {
      url: external,
      pg: null,
      database,
      dataDir: null,
      port,
      stop: async () => { /* external: nothing to stop */ },
    };
  }

  // Slow path: spin up a fresh embedded-postgres on a random port.
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
  await applyMigrations(url);

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
