// Single Postgres pool. Tunes for production.
import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';
import { loadConfig } from '../config/config.js';

let _pool: Pool | null = null;

export function getPool(): Pool {
  if (_pool) return _pool;
  const cfg = loadConfig();
  _pool = new Pool({
    connectionString: cfg.DATABASE_URL,
    min: cfg.DATABASE_POOL_MIN,
    max: cfg.DATABASE_POOL_MAX,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
    // Each connection is recycled after 30 minutes to avoid leaks/stale state.
    maxLifetimeSeconds: 30 * 60,
    // Default statement timeout: 15s. The DB enforces this; protects against runaway queries.
    statement_timeout: 15_000,
    // TCP keepalive so dead connections (NAT, firewall) are detected.
    keepAlive: true,
    keepAliveInitialDelayMillis: 10_000,
    ssl: cfg.DATABASE_SSL ? { rejectUnauthorized: false } : false,
  });
  _pool.on('error', (err) => {
    console.error('[pg] idle client error', err.message);
  });
  return _pool;
}

export async function query<T extends QueryResultRow = any>(sql: string, params: unknown[] = []): Promise<QueryResult<T>> {
  const start = Date.now();
  try {
    return await getPool().query<T>(sql, params as any[]);
  } catch (err) {
    const ms = Date.now() - start;
    // Log full detail server-side; clients get a sanitized error from the global filter.
    console.error(`[pg] query failed after ${ms}ms: ${(err as Error).message} | sql=${sql.slice(0, 200)}`);
    throw err;
  }
}

export async function withTx<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch { /* ignore */ }
    throw err;
  } finally {
    client.release();
  }
}

/** Graceful drain. Called from main.ts on SIGTERM. */
export async function closePool(): Promise<void> {
  if (_pool) {
    const p = _pool;
    _pool = null;
    await p.end();
  }
}
