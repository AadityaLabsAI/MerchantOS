// MerchantOS — sandbox demo server.
// Serves the built SPA + a complete in-memory mock API.
// Open http://localhost:3000 and the full UI will work with sample data.

const Fastify = require('fastify');
const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');

const PORT = process.env.PORT || 3000;
const app = Fastify({ logger: false });

// ---- In-memory state ----
const state = {
  merchant: { id: 'm_demo', name: 'Sharma Kirana Store', ownerEmail: 'demo@merchantos.in', phone: '+91 98765 43210', settings: { currency: 'INR' } },
  store:    { id: 's_demo', merchantId: 'm_demo', name: 'Main Store', address: 'Shop 14, Sector 18 Market', city: 'Noida', state: 'UP', pincode: '201301', phone: '+91 98765 43210', gstin: '09ABCDE1234F1Z5' },
  user:     { id: 'u_demo', merchantId: 'm_demo', storeId: 's_demo', name: 'Rajesh Sharma', email: 'demo@merchantos.in', phone: '+91 98765 43210', role: 'OWNER', permissions: ['*'] },
  tokens:   new Set(),
  shift:    { id: 'sh_demo', status: 'OPEN', openedAt: new Date().toISOString(), openingFloat: 500 },
  products: [
    { id: 'p1', merchantId: 'm_demo', storeId: 's_demo', sku: 'BRS-001', name: 'Basmati Rice 5kg', category: 'Grocery', price: 549, costPrice: 480, stock: 42, lowStock: 10, unit: 'pack', hsn: '1006', gstRate: 5, active: true },
    { id: 'p2', merchantId: 'm_demo', storeId: 's_demo', sku: 'OIL-002', name: 'Mustard Oil 1L', category: 'Grocery', price: 165, costPrice: 140, stock: 8, lowStock: 10, unit: 'btl', hsn: '1514', gstRate: 5, active: true },
    { id: 'p3', merchantId: 'm_demo', storeId: 's_demo', sku: 'TEA-003', name: 'Tata Tea Premium 1kg', category: 'Beverages', price: 480, costPrice: 410, stock: 22, lowStock: 8, unit: 'pack', hsn: '0902', gstRate: 5, active: true },
    { id: 'p4', merchantId: 'm_demo', storeId: 's_demo', sku: 'MLK-004', name: 'Amul Toned Milk 500ml', category: 'Dairy', price: 27, costPrice: 23, stock: 65, lowStock: 20, unit: 'pkt', hsn: '0401', gstRate: 0, active: true },
    { id: 'p5', merchantId: 'm_demo', storeId: 's_demo', sku: 'BIS-005', name: 'Parle-G Biscuit 800g', category: 'Snacks', price: 95, costPrice: 80, stock: 38, lowStock: 15, unit: 'pack', hsn: '1905', gstRate: 12, active: true },
    { id: 'p6', merchantId: 'm_demo', storeId: 's_demo', sku: 'SOAP-006', name: 'Lux Soap (pack of 4)', category: 'Personal Care', price: 175, costPrice: 145, stock: 5, lowStock: 10, unit: 'pack', hsn: '3401', gstRate: 18, active: true },
    { id: 'p7', merchantId: 'm_demo', storeId: 's_demo', sku: 'CHG-007', name: 'Surf Excel 1kg', category: 'Home Care', price: 215, costPrice: 180, stock: 14, lowStock: 8, unit: 'pack', hsn: '3402', gstRate: 18, active: true },
    { id: 'p8', merchantId: 'm_demo', storeId: 's_demo', sku: 'ATTA-008', name: 'Aashirvaad Atta 10kg', category: 'Grocery', price: 410, costPrice: 360, stock: 28, lowStock: 10, unit: 'pack', hsn: '1101', gstRate: 0, active: true },
  ],
  customers: [
    { id: 'c1', merchantId: 'm_demo', storeId: 's_demo', name: 'Amit Verma', phone: '+91 98101 23456', balance: -450, partyType: 'CREDIT', lastTxn: '2026-10-07T11:23:00Z' },
    { id: 'c2', merchantId: 'm_demo', storeId: 's_demo', name: 'Priya Singh', phone: '+91 99202 34567', balance: 1200, partyType: 'CREDIT', lastTxn: '2026-10-06T17:45:00Z' },
    { id: 'c3', merchantId: 'm_demo', storeId: 's_demo', name: 'Suresh Patel', phone: '+91 99803 45678', balance: 0, partyType: 'CASH', lastTxn: '2026-10-08T09:12:00Z' },
    { id: 'c4', merchantId: 'm_demo', storeId: 's_demo', name: 'Kavita Joshi', phone: '+91 90104 56789', balance: -2300, partyType: 'CREDIT', lastTxn: '2026-10-05T14:00:00Z' },
    { id: 'c5', merchantId: 'm_demo', storeId: 's_demo', name: 'Rohit Mehta', phone: '+91 98705 67890', balance: 380, partyType: 'CREDIT', lastTxn: '2026-10-08T08:30:00Z' },
    { id: 'c6', merchantId: 'm_demo', storeId: 's_demo', name: 'Anjali Desai', phone: '+91 98906 78901', balance: -150, partyType: 'CREDIT', lastTxn: '2026-10-07T19:20:00Z' },
  ],
  suppliers: [
    { id: 'su1', merchantId: 'm_demo', storeId: 's_demo', name: 'Agro Distributors', phone: '+91 99882 11111', balance: -12500, gstin: '09AAABB1234C1Z5' },
    { id: 'su2', merchantId: 'm_demo', storeId: 's_demo', name: 'Haldiram Wholesale', phone: '+91 99882 22222', balance: 0, gstin: '09AAACC2345D1Z6' },
    { id: 'su3', merchantId: 'm_demo', storeId: 's_demo', name: 'Dairy Fresh Co.', phone: '+91 99882 33333', balance: -3200 },
  ],
  transactions: [
    { id: 't1', merchantId: 'm_demo', storeId: 's_demo', kind: 'SALE', status: 'COMPLETED', method: 'UPI', amount: 549, customerId: 'c3', createdAt: '2026-10-08T16:42:00Z', upiRef: '512345678901' },
    { id: 't2', merchantId: 'm_demo', storeId: 's_demo', kind: 'SALE', status: 'COMPLETED', method: 'CASH', amount: 142, customerId: null, createdAt: '2026-10-08T15:20:00Z' },
    { id: 't3', merchantId: 'm_demo', storeId: 's_demo', kind: 'SALE', status: 'COMPLETED', method: 'UPI', amount: 950, customerId: 'c5', createdAt: '2026-10-08T14:15:00Z', upiRef: '512345678902' },
    { id: 't4', merchantId: 'm_demo', storeId: 's_demo', kind: 'COLLECTION', status: 'COMPLETED', method: 'CASH', amount: 200, customerId: 'c2', createdAt: '2026-10-08T13:08:00Z' },
    { id: 't5', merchantId: 'm_demo', storeId: 's_demo', kind: 'SALE', status: 'COMPLETED', method: 'UPI', amount: 1275, customerId: null, createdAt: '2026-10-08T11:45:00Z', upiRef: '512345678903' },
    { id: 't6', merchantId: 'm_demo', storeId: 's_demo', kind: 'SALE', status: 'REFUNDED', method: 'CARD', amount: 320, customerId: 'c1', createdAt: '2026-10-07T18:33:00Z' },
    { id: 't7', merchantId: 'm_demo', storeId: 's_demo', kind: 'SALE', status: 'COMPLETED', method: 'UPI', amount: 410, customerId: 'c3', createdAt: '2026-10-07T16:00:00Z', upiRef: '512345678904' },
    { id: 't8', merchantId: 'm_demo', storeId: 's_demo', kind: 'SALE', status: 'COMPLETED', method: 'CASH', amount: 95, customerId: null, createdAt: '2026-10-07T13:25:00Z' },
  ],
  bills: [
    { id: 'b1', merchantId: 'm_demo', storeId: 's_demo', number: 'INV-2026-0042', customerId: 'c5', total: 950, status: 'PAID', createdAt: '2026-10-08T14:15:00Z', items: [{ name: 'Basmati Rice 5kg', qty: 1, price: 549 }, { name: 'Parle-G 800g', qty: 1, price: 95 }, { name: 'Amul Milk 500ml', qty: 4, price: 27 }, { name: 'Tea 1kg', qty: 1, price: 248 }] },
    { id: 'b2', merchantId: 'm_demo', storeId: 's_demo', number: 'INV-2026-0041', customerId: 'c3', total: 549, status: 'PAID', createdAt: '2026-10-08T11:45:00Z', items: [{ name: 'Basmati Rice 5kg', qty: 1, price: 549 }] },
  ],
  expenses: [
    { id: 'e1', merchantId: 'm_demo', storeId: 's_demo', category: 'Rent', amount: 18000, note: 'October rent', createdAt: '2026-10-01T09:00:00Z' },
    { id: 'e2', merchantId: 'm_demo', storeId: 's_demo', category: 'Electricity', amount: 2400, note: 'BSES bill Sep', createdAt: '2026-10-03T14:00:00Z' },
    { id: 'e3', merchantId: 'm_demo', storeId: 's_demo', category: 'Salary', amount: 12000, note: 'Helper - October', createdAt: '2026-10-05T10:00:00Z' },
    { id: 'e4', merchantId: 'm_demo', storeId: 's_demo', category: 'Stock', amount: 8500, note: 'Local sundry items', createdAt: '2026-10-07T18:00:00Z' },
  ],
  shifts: [
    { id: 'sh1', merchantId: 'm_demo', storeId: 's_demo', status: 'CLOSED', openedAt: '2026-10-07T08:00:00Z', closedAt: '2026-10-07T21:30:00Z', openingFloat: 500, closingFloat: 2840, salesCount: 42, salesTotal: 18650 },
    { id: 'sh2', merchantId: 'm_demo', storeId: 's_demo', status: 'CLOSED', openedAt: '2026-10-06T08:00:00Z', closedAt: '2026-10-06T21:00:00Z', openingFloat: 500, closingFloat: 3120, salesCount: 38, salesTotal: 15900 },
    { id: 'sh3', merchantId: 'm_demo', storeId: 's_demo', status: 'OPEN', openedAt: '2026-10-08T08:00:00Z', openingFloat: 500 },
  ],
  ledger: {
    c1: [
      { id: 'l1', kind: 'UDHAR', amount: 1200, note: 'Groceries', createdAt: '2026-10-01T10:30:00Z' },
      { id: 'l2', kind: 'PAASA', amount: 500, note: 'Cash received', createdAt: '2026-10-03T16:00:00Z' },
      { id: 'l3', kind: 'UDHAR', amount: 350, note: 'Atta + Oil', createdAt: '2026-10-05T14:20:00Z' },
      { id: 'l4', kind: 'PAASA', amount: 600, note: 'GPay', createdAt: '2026-10-07T11:00:00Z' },
    ],
    c2: [
      { id: 'l1', kind: 'UDHAR', amount: 1500, note: 'Monthly grocery', createdAt: '2026-09-28T11:00:00Z' },
      { id: 'l2', kind: 'PAASA', amount: 300, note: 'Partial', createdAt: '2026-10-02T18:00:00Z' },
    ],
    c4: [
      { id: 'l1', kind: 'UDHAR', amount: 800, note: 'Big basket', createdAt: '2026-09-20T15:00:00Z' },
      { id: 'l2', kind: 'UDHAR', amount: 1500, note: 'Party supplies', createdAt: '2026-10-02T12:00:00Z' },
    ],
    c5: [
      { id: 'l1', kind: 'UDHAR', amount: 380, note: 'Evening snacks', createdAt: '2026-10-08T08:30:00Z' },
    ],
    c6: [
      { id: 'l1', kind: 'UDHAR', amount: 450, note: 'Misc', createdAt: '2026-10-06T19:20:00Z' },
      { id: 'l2', kind: 'PAASA', amount: 300, note: 'Cash', createdAt: '2026-10-07T15:00:00Z' },
    ],
  },
};

// ---- Helpers ----
function makeToken() { return crypto.randomBytes(24).toString('hex'); }
function requireAuth(req, reply) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) { reply.code(401).send({ error: 'unauthorized' }); return false; }
  const tok = auth.slice(7);
  if (!state.tokens.has(tok)) { reply.code(401).send({ error: 'invalid token' }); return false; }
  return true;
}
const iso = d => new Date(d).toISOString();

// ---- Auth ----
app.post('/auth/login', async (req, reply) => {
  const { email, phone, password } = req.body || {};
  if (!email && !phone) return reply.code(400).send({ error: 'email or phone required' });
  // OWNER bypass — accept any credential in demo
  const access = makeToken(); const refresh = makeToken();
  state.tokens.add(access); state.tokens.add(refresh);
  return { accessToken: access, refreshToken: refresh, user: state.user };
});
app.post('/auth/refresh', async (req, reply) => {
  const { refreshToken } = req.body || {};
  if (!refreshToken || !state.tokens.has(refreshToken)) return reply.code(401).send({ error: 'invalid refresh' });
  const access = makeToken(); state.tokens.add(access);
  return { accessToken: access, refreshToken };
});
app.post('/auth/register', async () => ({ ok: true }));
app.post('/auth/logout', async () => ({ ok: true }));
app.get('/auth/me', async (req, reply) => {
  if (!requireAuth(req, reply)) return;
  return state.user;
});

// ---- Health ----
app.get('/healthz', async () => ({ ok: true, time: iso(new Date()) }));

// ---- Customers (khata) ----
app.get('/api/customers', async (req, reply) => {
  if (!requireAuth(req, reply)) return;
  const { q } = req.query || {};
  let list = state.customers;
  if (q) list = list.filter(c => c.name.toLowerCase().includes(String(q).toLowerCase()));
  return list;
});
app.get('/api/customers/:id', async (req, reply) => {
  if (!requireAuth(req, reply)) return;
  const c = state.customers.find(x => x.id === req.params.id);
  return c || { error: 'not found' };
});
app.post('/api/customers', async (req, reply) => {
  if (!requireAuth(req, reply)) return;
  const c = { id: 'c' + (state.customers.length + 1), merchantId: 'm_demo', storeId: 's_demo', balance: 0, partyType: 'CREDIT', lastTxn: iso(new Date()), ...req.body };
  state.customers.unshift(c);
  return c;
});
app.get('/api/customers/:id/ledger', async (req, reply) => {
  if (!requireAuth(req, reply)) return;
  return state.ledger[req.params.id] || [];
});
app.post('/api/customers/:id/ledger', async (req, reply) => {
  if (!requireAuth(req, reply)) return;
  const list = state.ledger[req.params.id] = state.ledger[req.params.id] || [];
  const entry = { id: 'l' + (list.length + 1), createdAt: iso(new Date()), ...req.body };
  list.unshift(entry);
  const cust = state.customers.find(c => c.id === req.params.id);
  if (cust) {
    const sign = entry.kind === 'UDHAR' ? -1 : 1;
    cust.balance = (cust.balance || 0) + sign * entry.amount;
    cust.lastTxn = entry.createdAt;
  }
  return entry;
});

// ---- Products ----
app.get('/api/products', async (req, reply) => {
  if (!requireAuth(req, reply)) return;
  const { q } = req.query || {};
  let list = state.products;
  if (q) list = list.filter(p => p.name.toLowerCase().includes(String(q).toLowerCase()) || p.sku.toLowerCase().includes(String(q).toLowerCase()));
  return list;
});
app.post('/api/products', async (req, reply) => {
  if (!requireAuth(req, reply)) return;
  const p = { id: 'p' + (state.products.length + 1), merchantId: 'm_demo', storeId: 's_demo', active: true, ...req.body };
  state.products.unshift(p);
  return p;
});

// ---- Suppliers ----
app.get('/api/suppliers', async (req, reply) => {
  if (!requireAuth(req, reply)) return;
  return state.suppliers;
});
app.post('/api/suppliers', async (req, reply) => {
  if (!requireAuth(req, reply)) return;
  const s = { id: 'su' + (state.suppliers.length + 1), merchantId: 'm_demo', storeId: 's_demo', balance: 0, ...req.body };
  state.suppliers.unshift(s);
  return s;
});

// ---- Bills ----
app.get('/api/bills', async (req, reply) => {
  if (!requireAuth(req, reply)) return;
  return state.bills;
});
app.get('/api/bills/:id', async (req, reply) => {
  if (!requireAuth(req, reply)) return;
  return state.bills.find(b => b.id === req.params.id);
});
app.post('/api/bills', async (req, reply) => {
  if (!requireAuth(req, reply)) return;
  const b = { id: 'b' + (state.bills.length + 1), number: 'INV-2026-' + (43 + state.bills.length), status: 'PAID', createdAt: iso(new Date()), ...req.body };
  state.bills.unshift(b);
  return b;
});

// ---- Expenses ----
app.get('/api/expenses', async (req, reply) => {
  if (!requireAuth(req, reply)) return;
  return state.expenses;
});
app.post('/api/expenses', async (req, reply) => {
  if (!requireAuth(req, reply)) return;
  const e = { id: 'e' + (state.expenses.length + 1), createdAt: iso(new Date()), ...req.body };
  state.expenses.unshift(e);
  return e;
});

// ---- Shifts ----
app.get('/api/shifts', async (req, reply) => {
  if (!requireAuth(req, reply)) return;
  return state.shifts;
});
app.get('/api/shifts/active', async (req, reply) => {
  if (!requireAuth(req, reply)) return;
  return state.shifts.find(s => s.status === 'OPEN') || null;
});
app.post('/api/shifts', async (req, reply) => {
  if (!requireAuth(req, reply)) return;
  const s = { id: 'sh' + (state.shifts.length + 1), status: 'OPEN', openedAt: iso(new Date()), merchantId: 'm_demo', storeId: 's_demo', ...req.body };
  state.shifts.unshift(s);
  return s;
});
app.post('/api/shifts/:id/close', async (req, reply) => {
  if (!requireAuth(req, reply)) return;
  const s = state.shifts.find(x => x.id === req.params.id);
  if (s) { s.status = 'CLOSED'; s.closedAt = iso(new Date()); }
  return s;
});

// ---- Payments / Transactions ----
app.get('/api/payments', async (req, reply) => {
  if (!requireAuth(req, reply)) return;
  return state.transactions;
});
app.post('/api/payments', async (req, reply) => {
  if (!requireAuth(req, reply)) return;
  const t = { id: 't' + (state.transactions.length + 1), status: 'COMPLETED', createdAt: iso(new Date()), merchantId: 'm_demo', storeId: 's_demo', ...req.body };
  state.transactions.unshift(t);
  return t;
});
app.post('/api/payments/sessions', async (req, reply) => {
  if (!requireAuth(req, reply)) return;
  return { id: 'ps_demo', token: 'tok_' + crypto.randomBytes(6).toString('hex'), qrPayload: 'upi://pay?pa=demo@upi&pn=' + encodeURIComponent(state.merchant.name), amount: req.body?.amount || 0, expiresAt: iso(Date.now() + 600_000), status: 'PENDING' };
});
app.get('/pay/:token', async () => ({ token: 'demo', status: 'PENDING' }));

// ---- Reports ----
app.get('/api/reports/today', async (req, reply) => {
  if (!requireAuth(req, reply)) return;
  const sales = state.transactions.filter(t => t.kind === 'SALE' && t.status === 'COMPLETED');
  const today = sales.filter(s => iso(s.createdAt).startsWith('2026-10-08'));
  const total = today.reduce((s, t) => s + t.amount, 0);
  const byMethod = {};
  today.forEach(t => { byMethod[t.method] = (byMethod[t.method] || 0) + t.amount; });
  return {
    salesCount: today.length, totalSales: total, byMethod,
    billsCount: state.bills.length, expensesTotal: state.expenses.reduce((s, e) => s + e.amount, 0),
    inventory: { totalSkus: state.products.length, lowStock: state.products.filter(p => p.stock < p.lowStock).length, stockValue: state.products.reduce((s, p) => s + p.stock * p.costPrice, 0) },
    khata: { outstanding: state.customers.filter(c => c.balance < 0).reduce((s, c) => s + Math.abs(c.balance), 0), credit: state.customers.filter(c => c.balance > 0).reduce((s, c) => s + c.balance, 0) },
  };
});
app.get('/api/reports/top-products', async (req, reply) => {
  if (!requireAuth(req, reply)) return;
  // Simulated top sellers
  return state.products.map((p, i) => ({ ...p, soldToday: [12, 8, 15, 23, 19, 6, 9, 11][i] || 5 })).sort((a, b) => b.soldToday - a.soldToday);
});
app.get('/api/reports/khata', async (req, reply) => {
  if (!requireAuth(req, reply)) return;
  return state.customers.filter(c => c.balance !== 0);
});

// ---- AI (mock) ----
app.post('/api/assistant/ask', async (req, reply) => {
  if (!requireAuth(req, reply)) return;
  return { id: 'ai_' + Date.now(), reply: 'Demo mode: AI assistant is disabled in the sandbox preview. In production, this routes to your local Ollama instance for fully private, free business insights.' };
});

// ---- SPA serving ----
const HTML = fs.readFileSync(path.join(__dirname, 'src', 'landing', 'spa_index.html'), 'utf-8');
const JS   = fs.readFileSync(path.join(__dirname, 'src', 'landing', 'spa_app.js'));
const CSS  = fs.readFileSync(path.join(__dirname, 'src', 'landing', 'spa_app.css'));

app.get('/', async (req, reply) => { reply.type('text/html; charset=utf-8'); reply.header('Cache-Control', 'no-cache'); return HTML; });
app.get('/app', async (req, reply) => { reply.type('text/html; charset=utf-8'); return HTML; });
app.get('/app.js', async (req, reply) => { reply.type('application/javascript; charset=utf-8'); reply.header('Cache-Control', 'public, max-age=31536000, immutable'); return JS; });
app.get('/app.css', async (req, reply) => { reply.type('text/css; charset=utf-8'); reply.header('Cache-Control', 'public, max-age=31536000, immutable'); return CSS; });
app.get('/manifest.json', async () => ({
  name: 'MerchantOS — 0% Commission (Demo)', short_name: 'MerchantOS',
  start_url: '/app', scope: '/app', display: 'standalone',
  background_color: '#ffffff', theme_color: '#1E3A8A',
  icons: [{ src: '/icon-192.svg', sizes: '192x192', type: 'image/svg+xml' }, { src: '/icon-512.svg', sizes: '512x512', type: 'image/svg+xml' }],
}));
app.get('/sw.js', async (req, reply) => {
  reply.type('application/javascript; charset=utf-8');
  return '// demo sw\nself.addEventListener("install",e=>self.skipWaiting());\nself.addEventListener("activate",e=>self.clients.claim());';
});
const ICON_SVG = `<?xml version="1.0" encoding="UTF-8"?><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1E3A8A"/><stop offset="1" stop-color="#FF6B1A"/></linearGradient></defs><rect width="512" height="512" rx="112" fill="url(#g)"/><text x="256" y="350" font-size="300" text-anchor="middle" fill="white" font-family="sans-serif" font-weight="800">M</text></svg>`;
app.get('/icon-192.svg', async (req, reply) => { reply.type('image/svg+xml'); return ICON_SVG; });
app.get('/icon-512.svg', async (req, reply) => { reply.type('image/svg+xml'); return ICON_SVG; });
app.get('/favicon.ico', async (req, reply) => { reply.type('image/svg+xml'); return ICON_SVG; });

// Catch-all for SPA routes
app.setNotFoundHandler((req, reply) => {
  if (req.url.startsWith('/api/') || req.url.startsWith('/auth/') || req.url === '/healthz') {
    return reply.code(404).send({ error: 'not found' });
  }
  reply.type('text/html; charset=utf-8').header('Cache-Control', 'no-cache');
  reply.send(HTML);
});

app.listen({ host: '0.0.0.0', port: PORT }, (err, addr) => {
  if (err) { console.error(err); process.exit(1); }
  console.log(`[demo] MerchantOS running at ${addr}`);
  console.log(`[demo] Open http://localhost:${PORT}/app to see the UI`);
});
