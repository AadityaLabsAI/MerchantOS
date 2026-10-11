
const http = require('http');
const crypto = require('node:crypto');

function post(path, body, headers) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = http.request({
      host: '127.0.0.1', port: 3000, path, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data), ...headers },
    }, (res) => {
      let chunks = '';
      res.on('data', c => chunks += c);
      res.on('end', () => resolve({ status: res.statusCode, body: chunks }));
    });
    req.on('error', reject);
    req.write(data); req.end();
  });
}

(async () => {
  // Login
  const login = await post('/auth/login', { email: 'owner@merchantos.local', password: 'OwnerPass123!' });
  const { accessToken } = JSON.parse(login.body);
  console.log('Login:', login.status, 'token length:', accessToken.length);

  const key = 'idem-' + crypto.randomBytes(8).toString('hex');
  const body = {
    storeId: '01M4N7PVQMKX0ZE4GYDMJ2QQMN',
    lines: [{ productId: '01M4N7QVSKDEMSV7G1NBGR1P2P', quantity: 1 }],
    taxBps: 1800,
    currency: 'INR',
  };

  console.log('--- POST #1 (key=' + key + ') ---');
  const r1 = await post('/api/bills', body, { 'Authorization': 'Bearer ' + accessToken, 'Idempotency-Key': key });
  console.log('Status:', r1.status);
  console.log('Body:', r1.body.slice(0, 200));

  console.log('--- POST #2 (SAME key) ---');
  const r2 = await post('/api/bills', body, { 'Authorization': 'Bearer ' + accessToken, 'Idempotency-Key': key });
  console.log('Status:', r2.status);
  console.log('Body:', r2.body.slice(0, 200));

  const id1 = JSON.parse(r1.body).id;
  const id2 = r2.status === 201 ? JSON.parse(r2.body).id : 'N/A';
  console.log('--- Result ---');
  console.log('Bill 1:', id1);
  console.log('Bill 2:', id2);
  if (id1 === id2) console.log('PASS: same bill id on replay');
  else console.log('FAIL: different responses');
})();
