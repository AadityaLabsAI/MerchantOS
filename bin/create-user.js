#!/usr/bin/env node
// Create or update a user with a known password, and assign a role.
// Usage: node bin/create-user.js <email> <password> <role> [storeId]
//   role: OWNER | MANAGER | CASHIER | ACCOUNTANT | STAFF
//   storeId: required (use the demo store from `bin/seed`)

const { Client } = require('pg');
const crypto = require('node:crypto');
const ENCODING = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

function ulid() {
  const now = Date.now();
  let time = now, str = '';
  for (let i = 10; i > 0; i--) { str = ENCODING.charAt(time % 32) + str; time = Math.floor(time / 32); }
  const rand = crypto.randomBytes(16);
  let s = '';
  for (let i = 0; i < 16; i++) s += ENCODING.charAt(rand[i] % 32);
  return str + s;
}

function hashPassword(plain) {
  const salt = crypto.randomBytes(16);
  const N = 16384, r = 8, p = 1;
  const hash = crypto.scryptSync(plain, salt, 64, { N, r, p });
  return `scrypt$${N}$${r}$${p}$${salt.toString('base64')}$${hash.toString('base64')}`;
}

(async () => {
  const [email, password, role = 'OWNER', storeId = process.env.STORE_ID] = process.argv.slice(2);
  if (!email || !password) { console.error('usage: create-user.js <email> <password> <role> [storeId]'); process.exit(1); }
  if (!storeId) { console.error('storeId required (or set STORE_ID env)'); process.exit(1); }

  const client = new Client({ host: process.env.PGHOST || '127.0.0.1',
    port: Number(process.env.PGPORT || 5432),
    user: process.env.PGUSER || 'postgres',
    database: process.env.PGDATABASE || 'merchantos' });
  await client.connect();
  const store = await client.query(`SELECT merchant_id FROM stores WHERE id = $1`, [storeId]);
  if (!store.rows[0]) { console.error('store not found'); process.exit(1); }
  const merchantId = store.rows[0].merchant_id;
  const userId = ulid();
  const hash = hashPassword(password);
  await client.query(
    `INSERT INTO users (id, merchant_id, email, name, password_hash) VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (merchant_id, email) DO UPDATE SET password_hash = EXCLUDED.password_hash, is_active = true, updated_at = now()`,
    [userId, merchantId, email, email.split('@')[0], hash]);
  const idForMembership = await client.query(`SELECT id FROM users WHERE merchant_id = $1 AND email = $2`, [merchantId, email]);
  await client.query(
    `INSERT INTO store_memberships (id, user_id, store_id, merchant_id, role, is_default) VALUES ($1, $2, $3, $4, $5, true)
       ON CONFLICT (user_id, store_id) DO UPDATE SET role = EXCLUDED.role`,
    [ulid(), idForMembership.rows[0].id, storeId, merchantId, role]);
  console.log(`Created/updated user ${email} with role ${role} at store ${storeId} (merchant ${merchantId})`);
  await client.end();
})().catch((e) => { console.error(e); process.exit(1); });
