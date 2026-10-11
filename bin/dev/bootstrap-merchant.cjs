// First-run bootstrap: create one merchant + store + owner user.
// Idempotent: safe to re-run. Uses the actual schema in 001_foundation.sql.
const { Client } = require('pg');
const crypto = require('node:crypto');

const ENCODING = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
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

const args = process.argv.slice(2);
const email = (args[0] || 'owner@merchantos.local').toLowerCase();
const password = args[1] || 'OwnerPass123!';
const storeName = args[2] || 'Main Store';
const merchantName = args[3] || 'My Business';
const currency = args[4] || 'INR';
const locale = args[5] || 'en-IN';
const timezone = args[6] || 'Asia/Kolkata';

(async () => {
  const client = new Client({ connectionString: process.env.DATABASE_URL || 'postgres://merchantos:merchantos@127.0.0.1:5432/merchantos' });
  await client.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`bootstrap-merchant:${email}`]);

    // 1. Merchant
    let r = await client.query('SELECT id, name FROM merchants WHERE owner_email=$1 LIMIT 1', [email]);
    let merchantId;
    if (r.rows[0]) {
      merchantId = r.rows[0].id;
      console.log('[skip] merchant exists:', merchantId, r.rows[0].name);
    } else {
      merchantId = ulid();
      const settings = { default_currency: currency, default_locale: locale, default_timezone: timezone };
      await client.query(
        `INSERT INTO merchants (id, name, owner_email, phone, settings, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5::jsonb, now(), now())`,
        [merchantId, merchantName, email, '', JSON.stringify(settings)]
      );
      console.log('[ok]   merchant created:', merchantId, merchantName);
    }

    // 2. Store
    r = await client.query('SELECT id, name FROM stores WHERE merchant_id=$1 AND name=$2', [merchantId, storeName]);
    let storeId;
    if (r.rows[0]) {
      storeId = r.rows[0].id;
      console.log('[skip] store exists:', storeId, storeName);
    } else {
      storeId = ulid();
      const settings = { currency, locale, timezone };
      await client.query(
        `INSERT INTO stores (id, merchant_id, name, settings, created_at, updated_at)
         VALUES ($1, $2, $3, $4::jsonb, now(), now())`,
        [storeId, merchantId, storeName, JSON.stringify(settings)]
      );
      console.log('[ok]   store created:', storeId, storeName);
    }

    // 3. Owner user
    r = await client.query('SELECT id FROM users WHERE merchant_id=$1 AND email=$2', [merchantId, email]);
    let userId;
    if (r.rows[0]) {
      userId = r.rows[0].id;
      console.log('[skip] user exists:', userId, email);
    } else {
      userId = ulid();
      await client.query(
        `INSERT INTO users (id, merchant_id, email, name, password_hash, is_active, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, true, now(), now())`,
        [userId, merchantId, email, email.split('@')[0], hashPassword(password)]
      );
      console.log('[ok]   user created:', userId, email);
    }

    // 4. Store membership as OWNER
    r = await client.query('SELECT id FROM store_memberships WHERE user_id=$1 AND store_id=$2', [userId, storeId]);
    if (r.rows[0]) {
      await client.query(`UPDATE store_memberships SET role='OWNER', is_default=true WHERE user_id=$1 AND store_id=$2`, [userId, storeId]);
      console.log('[skip] membership exists; role set to OWNER');
    } else {
      await client.query(
        `INSERT INTO store_memberships (id, user_id, store_id, merchant_id, role, is_default, created_at)
         VALUES ($1, $2, $3, $4, 'OWNER', true, now())`,
        [ulid(), userId, storeId, merchantId]
      );
      console.log('[ok]   membership created with role OWNER');
    }

    await client.query('COMMIT');
    console.log('---');
    console.log('BOOTSTRAP_OK');
    console.log('merchantId=' + merchantId);
    console.log('storeId=' + storeId);
    console.log('userId=' + userId);
    console.log('email=' + email);
    console.log('password=' + password);
  } catch (e) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw e;
  } finally {
    await client.end();
  }
})().catch(e => { console.error('BOOTSTRAP_FAIL:', e.message); process.exit(1); });
