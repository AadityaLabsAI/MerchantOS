#!/usr/bin/env node
// Bootstrap an owner/staff account only when it does not exist.
// Re-running this script never resets an existing user's password, active state, or role.
const { Client } = require('pg');
const crypto = require('node:crypto');
const ENCODING = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const ALLOWED_ROLES = new Set(['OWNER', 'MANAGER', 'CASHIER', 'ACCOUNTANT', 'STAFF']);

function ulid() {
  let time = Date.now();
  let prefix = '';
  for (let i = 10; i > 0; i--) { prefix = ENCODING.charAt(time % 32) + prefix; time = Math.floor(time / 32); }
  const rand = crypto.randomBytes(16);
  let suffix = '';
  for (let i = 0; i < 16; i++) suffix += ENCODING.charAt(rand[i] % 32);
  return prefix + suffix;
}

function hashPassword(plain) {
  const salt = crypto.randomBytes(16);
  const N = 16384, r = 8, p = 1;
  const hash = crypto.scryptSync(plain, salt, 64, { N, r, p });
  return `scrypt$${N}$${r}$${p}$${salt.toString('base64')}$${hash.toString('base64')}`;
}

(async () => {
  const [rawEmail, password, rawRole = 'OWNER', storeId = process.env.STORE_ID] = process.argv.slice(2);
  const email = (rawEmail || '').trim().toLowerCase();
  const role = String(rawRole).toUpperCase();
  if (!email || !password) {
    console.error('usage: create-user.js <email> <password> <role> [storeId]');
    process.exitCode = 1; return;
  }
  if (!storeId) {
    console.error('storeId required (or set STORE_ID env)');
    process.exitCode = 1; return;
  }
  if (!ALLOWED_ROLES.has(role)) {
    console.error('invalid role; expected OWNER, MANAGER, CASHIER, ACCOUNTANT, or STAFF');
    process.exitCode = 1; return;
  }

  const clientConfig = process.env.DATABASE_URL
    ? { connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 5000 }
    : {
        host: process.env.PGHOST || '127.0.0.1',
        port: Number(process.env.PGPORT || 5432),
        user: process.env.PGUSER || 'postgres',
        password: process.env.PGPASSWORD || undefined,
        database: process.env.PGDATABASE || 'merchantos',
        connectionTimeoutMillis: 5000,
      };
  const client = new Client(clientConfig);
  await client.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`bootstrap-user:${email}`]);
    const store = await client.query('SELECT merchant_id FROM stores WHERE id = $1', [storeId]);
    if (!store.rows[0]) throw new Error(`store not found: ${storeId}`);
    const merchantId = store.rows[0].merchant_id;

    let found = await client.query(
      'SELECT id FROM users WHERE merchant_id = $1 AND email = $2 FOR UPDATE',
      [merchantId, email],
    );
    let userId;
    let created = false;
    if (found.rows[0]) {
      userId = found.rows[0].id;
    } else {
      userId = ulid();
      await client.query(
        'INSERT INTO users (id, merchant_id, email, name, password_hash) VALUES ($1, $2, $3, $4, $5)',
        [userId, merchantId, email, email.split('@')[0], hashPassword(password)],
      );
      created = true;
    }

    const membership = await client.query(
      `INSERT INTO store_memberships (id, user_id, store_id, merchant_id, role, is_default)
       VALUES ($1, $2, $3, $4, $5, true)
       ON CONFLICT (user_id, store_id) DO NOTHING
       RETURNING id`,
      [ulid(), userId, storeId, merchantId, role],
    );
    await client.query('COMMIT');
    if (created) {
      console.log(`Created bootstrap user ${email} with role ${role} at store ${storeId}`);
    } else {
      console.log(`User ${email} already exists; existing password, active state, and roles were preserved`);
    }
    if (!membership.rows[0]) console.log('Existing store membership preserved; no role changes made');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw err;
  } finally {
    await client.end();
  }
})().catch((e) => {
  console.error('create-user failed:', e.message);
  process.exitCode = 1;
});
