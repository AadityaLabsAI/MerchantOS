#!/usr/bin/env node
/**
 * MerchantOS — end-to-end smoke test.
 *
 * Exercises every major API path against a running server.
 * Exits 0 on success, 1 on any failure.
 *
 * Usage: node bin/smoke-test.cjs [base-url]
 */
const http = require('node:http');
const crypto = require('node:crypto');

const BASE = process.argv[2] || 'http://127.0.0.1:3000';
const BASE_URL = new URL(BASE);
const STORE = '01H0000000000000000000001';
const OWNER_EMAIL = process.env.SEED_USER_EMAIL || 'owner@merchantos.local';
const OWNER_PASS = process.env.SEED_USER_PASSWORD || 'OwnerPass123!';

let pass = 0, fail = 0;
const log = (ok, name, detail = '') => {
  console.log('  ' + (ok ? '\u001b[32m✓\u001b[0m' : '\u001b[31m✗\u001b[0m') + ' ' + name + (detail ? ' — ' + detail : ''));
  if (ok) pass++; else fail++;
};

function req(method, path, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const data = body !== undefined && body !== null ? JSON.stringify(body) : '';
    const r = http.request({
      host: BASE_URL.hostname, port: BASE_URL.port || 80, path, method,
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data), ...headers },
    }, (res) => {
      let chunks = '';
      res.on('data', c => chunks += c);
      res.on('end', () => {
        let b = chunks;
        try { b = JSON.parse(chunks); } catch {}
        resolve({ status: res.statusCode, body: b });
      });
    });
    r.on('error', reject);
    if (data) r.write(data);
    r.end();
  });
}

(async () => {
  console.log('\n=== MerchantOS smoke test ===');
  console.log('Target:', BASE, '\n');

  // 1. Health
  console.log('--- Health ---');
  const h = await req('GET', '/healthz');
  log(h.status === 200 && h.body?.status === 'ok', 'GET /healthz', 'status=' + h.status);

  // 2. Login
  console.log('\n--- Auth ---');
  const login = await req('POST', '/auth/login', { email: OWNER_EMAIL, password: OWNER_PASS });
  log(login.status === 201 && login.body?.accessToken, 'POST /auth/login', 'token_len=' + (login.body?.accessToken?.length || 0));
  if (!login.body?.accessToken) { console.log('ABORT: cannot proceed without token'); process.exit(1); }
  const token = login.body.accessToken;
  const auth = { 'Authorization': 'Bearer ' + token };

  const bad = await req('POST', '/auth/login', { email: OWNER_EMAIL, password: 'wrong' });
  log(bad.status === 401, 'POST /auth/login (bad pass) → 401', 'status=' + bad.status);

  // 3. Products
  console.log('\n--- Products ---');
  const prods = await req('GET', '/api/products?storeId=' + STORE, null, auth);
  const items = Array.isArray(prods.body) ? prods.body : (prods.body?.items || []);
  log(prods.status === 200 && items.length > 0, 'GET /api/products', 'count=' + items.length);
  if (items.length === 0) { console.log('ABORT: no products seeded'); process.exit(1); }
  const product = items[0];

  // 4. Customers
  console.log('\n--- Customers ---');
  const custs = await req('GET', '/api/customers?storeId=' + STORE, null, auth);
  const custItems = Array.isArray(custs.body) ? custs.body : (custs.body?.items || []);
  log(custs.status === 200, 'GET /api/customers', 'count=' + custItems.length);

  const newCust = await req('POST', '/api/customers', {
    storeId: STORE, name: 'Smoke ' + crypto.randomBytes(2).toString('hex'),
  }, auth);
  log(newCust.status === 201 && newCust.body?.id, 'POST /api/customers', 'id=' + newCust.body?.id);

  // 5. Bills + tax + idempotency
  console.log('\n--- Bills ---');
  const b1 = await req('POST', '/api/bills', {
    storeId: STORE, lines: [{ productId: product.id, quantity: 2 }], taxBps: 1800, currency: 'INR',
  }, auth);
  log(b1.status === 201, 'POST /api/bills', 'total=' + b1.body?.totalMinor);
  if (b1.body) {
    const s = BigInt(b1.body.subtotalMinor), t = BigInt(b1.body.taxMinor), tot = BigInt(b1.body.totalMinor);
    const expectedTax = (s * 1800n) / 10000n;
    log(t === expectedTax, '  tax math', 'actual=' + t + ' expected=' + expectedTax);
    log(s + t === tot, '  total = subtotal + tax', 'actual=' + tot + ' expected=' + (s + t));
  }

  const idemKey = 'smoke-' + crypto.randomBytes(8).toString('hex');
  const billBody = { storeId: STORE, lines: [{ productId: product.id, quantity: 1 }], taxBps: 1800, currency: 'INR' };
  const i1 = await req('POST', '/api/bills', billBody, { ...auth, 'Idempotency-Key': idemKey });
  const i2 = await req('POST', '/api/bills', billBody, { ...auth, 'Idempotency-Key': idemKey });
  log(i1.body?.id === i2.body?.id, 'Idempotency-Key replay', 'id1=' + i1.body?.id + ' id2=' + i2.body?.id);

  const got = await req('GET', '/api/bills/' + b1.body.id, null, auth);
  log(got.status === 200 && got.body?.state === 'FINALIZED', 'GET /api/bills/:id', 'state=' + got.body?.state);

  const cancel = await req('POST', '/api/bills/' + b1.body.id + '/cancel', {}, auth);
  log(cancel.status === 201 && cancel.body?.ok, 'POST /api/bills/:id/cancel');

  // 6. Reports + Audit
  console.log('\n--- Reports & Audit ---');
  const today = await req('GET', '/api/reports/today?storeId=' + STORE, null, auth);
  log(today.status === 200, 'GET /api/reports/today', 'status=' + today.status);

  const audit = await req('GET', '/api/audit?storeId=' + STORE, null, auth);
  const aItems = Array.isArray(audit.body) ? audit.body : (audit.body?.items || []);
  log(audit.status === 200 && aItems.length > 0, 'GET /api/audit', 'count=' + aItems.length);

  // 7. SPA
  console.log('\n--- SPA ---');
  const app = await req('GET', '/app');
  log(app.status === 200 && (typeof app.body === 'string' ? app.body.includes('<title>') : true), 'GET /app', 'bytes=' + (typeof app.body === 'string' ? app.body.length : 0));
  const js = await req('GET', '/spa_app.js');
  log(js.status === 200, 'GET /spa_app.js', 'bytes=' + (typeof js.body === 'string' ? js.body.length : 0));
  const css = await req('GET', '/spa_app.css');
  log(css.status === 200, 'GET /spa_app.css', 'bytes=' + (typeof css.body === 'string' ? css.body.length : 0));
  const icon = await req('GET', '/icon.svg');
  log(icon.status === 200, 'GET /icon.svg', 'bytes=' + (typeof icon.body === 'string' ? icon.body.length : 0));

  console.log('\n=== RESULT ===');
  console.log('  ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail > 0 ? 1 : 0);
})().catch(e => { console.error('SMOKE TEST ERROR:', e.message); process.exit(2); });
