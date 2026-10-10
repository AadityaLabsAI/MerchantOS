// ============================================================================
// !! DEMO / PREVIEW ONLY !!
// This server intentionally accepts ANY email/password ("OWNER bypass") so the
// sandbox preview works without registration. NEVER use this server in
// production. Run the real NestJS API (npm start) for real deployments.
// ============================================================================
// MerchantOS — sandbox demo server.
// Serves the built SPA + a complete in-memory mock API.
// Open http://localhost:3000 and the full UI will work with sample data.
//
// API CONTRACT: This server mirrors the SHAPE the v1.3.0 SPA expects
// (singular resource names: /api/bill, /api/customer, /api/expense,
// /api/payment, /api/product, /api/shift, /api/supplier). The plural forms
// are also exposed as back-compat aliases.

const Fastify = require('fastify');
const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');

const PORT = process.env.PORT || 3000;
const app = Fastify({ logger: false });

// ============================================================================
// Sample data
// ============================================================================
const now = () => new Date().toISOString();

const PRODUCTS = [
  { id: 'p1', sku: 'BRS-001', name: 'Basmati Rice 5kg',        category: 'Grocery',       price: 549, costPrice: 480, stock: 42, lowStock: 10, unit: 'pack', hsn: '1006', gstRate: 5,  active: true },
  { id: 'p2', sku: 'OIL-002', name: 'Mustard Oil 1L',          category: 'Grocery',       price: 165, costPrice: 140, stock: 8,  lowStock: 10, unit: 'btl',  hsn: '1514', gstRate: 5,  active: true },
  { id: 'p3', sku: 'TEA-003', name: 'Tata Tea Premium 1kg',    category: 'Beverages',     price: 480, costPrice: 410, stock: 22, lowStock: 8,  unit: 'pack', hsn: '0902', gstRate: 5,  active: true },
  { id: 'p4', sku: 'MLK-004', name: 'Amul Toned Milk 500ml',   category: 'Dairy',         price: 27,  costPrice: 23,  stock: 65, lowStock: 20, unit: 'pkt',  hsn: '0401', gstRate: 0,  active: true },
  { id: 'p5', sku: 'BIS-005', name: 'Parle-G Biscuit 800g',    category: 'Snacks',        price: 95,  costPrice: 80,  stock: 38, lowStock: 15, unit: 'pack', hsn: '1905', gstRate: 12, active: true },
  { id: 'p6', sku: 'SOAP-006',name: 'Lux Soap (pack of 4)',    category: 'Personal Care', price: 175, costPrice: 145, stock: 5,  lowStock: 10, unit: 'pack', hsn: '3401', gstRate: 18, active: true },
  { id: 'p7', sku: 'CHG-007', name: 'Surf Excel 1kg',          category: 'Home Care',     price: 215, costPrice: 180, stock: 14, lowStock: 8,  unit: 'pack', hsn: '3402', gstRate: 18, active: true },
  { id: 'p8', sku: 'ATTA-008',name: 'Aashirvaad Atta 10kg',     category: 'Grocery',       price: 410, costPrice: 360, stock: 28, lowStock: 10, unit: 'pack', hsn: '1101', gstRate: 0,  active: true },
];

const CUSTOMERS = [
  { id: 'c1', name: 'Amit Verma',    phone: '+91 98101 23456', balance: -450,  partyType: 'CREDIT', lastTxnAt: '2026-10-07T11:23:00Z' },
  { id: 'c2', name: 'Priya Singh',   phone: '+91 99202 34567', balance: 1200,  partyType: 'CREDIT', lastTxnAt: '2026-10-06T17:45:00Z' },
  { id: 'c3', name: 'Suresh Patel',  phone: '+91 99803 45678', balance: 0,     partyType: 'CASH',   lastTxnAt: '2026-10-08T09:12:00Z' },
  { id: 'c4', name: 'Kavita Joshi',  phone: '+91 90104 56789', balance: -2300, partyType: 'CREDIT', lastTxnAt: '2026-10-05T14:00:00Z' },
  { id: 'c5', name: 'Rohit Mehta',   phone: '+91 98705 67890', balance: 380,   partyType: 'CREDIT', lastTxnAt: '2026-10-08T08:30:00Z' },
  { id: 'c6', name: 'Anjali Desai',  phone: '+91 98906 78901', balance: -150,  partyType: 'CREDIT', lastTxnAt: '2026-10-07T19:20:00Z' },
];

const SUPPLIERS = [
  { id: 'su1', name: 'Agro Distributors',  phone: '+91 99882 11111', balance: -12500, gstin: '09AAABB1234C1Z5' },
  { id: 'su2', name: 'Haldiram Wholesale', phone: '+91 99882 22222', balance: 0,      gstin: '09AAACC2345D1Z6' },
  { id: 'su3', name: 'Dairy Fresh Co.',    phone: '+91 99882 33333', balance: -3200 },
];

// Mutable in-memory state
const state = {
  customerIdSeq: 7,
  productIdSeq: 9,
  supplierIdSeq: 4,
  billIdSeq: 3,
  expenseIdSeq: 5,
  paymentSeq: 0,
  bills: [
    { id: 'b1', customerId: 'c5', customerName: 'Rohit Mehta', total: 950, status: 'PAID',  createdAt: '2026-10-08T14:15:00Z' },
    { id: 'b2', customerId: 'c3', customerName: 'Suresh Patel',total: 549, status: 'PAID',  createdAt: '2026-10-08T11:45:00Z' },
  ],
  expenses: [
    { id: 'e1', category: 'Rent',        amount: 18000, note: 'October rent',       createdAt: '2026-10-01T09:00:00Z' },
    { id: 'e2', category: 'Electricity', amount: 2400,  note: 'BSES bill Sep',      createdAt: '2026-10-03T14:00:00Z' },
    { id: 'e3', category: 'Salary',      amount: 12000, note: 'Helper - October',   createdAt: '2026-10-05T10:00:00Z' },
  ],
  shift: null, // { shiftId, status, openedAt, openingCash, closingCash, closedAt }
  tokens: new Set(),
};

// ============================================================================
// Auth helpers
// ============================================================================
function makeToken() { return crypto.randomBytes(24).toString('hex'); }
function requireAuth(req, reply) {
  const h = req.headers.authorization || '';
  const t = h.startsWith('Bearer ') ? h.slice(7) : '';
  if (!state.tokens.has(t)) { reply.code(401).send({ error: 'unauthorized' }); return false; }
  return true;
}

// ============================================================================
// Auth
// ============================================================================
app.post('/auth/login', async (req, reply) => {
  const { email, phone, password } = req.body || {};
  if (!email && !phone) return reply.code(400).send({ error: 'email or phone required' });
  const access = makeToken(); const refresh = makeToken();
  state.tokens.add(access); state.tokens.add(refresh);
  return {
    accessToken: access, refreshToken: refresh,
    user: { id: 'u_demo', merchantId: 'm_demo', storeId: 's_demo', name: 'Rajesh Sharma', email: email || 'demo@merchantos.in', role: 'OWNER', permissions: ['*'] },
  };
});
app.post('/auth/refresh', async (req, reply) => {
  const { refreshToken } = req.body || {};
  if (!refreshToken || !state.tokens.has(refreshToken)) return reply.code(401).send({ error: 'invalid refresh' });
  const access = makeToken(); state.tokens.add(access);
  return { accessToken: access, refreshToken };
});
app.post('/auth/logout', async () => ({ ok: true }));
app.get('/auth/me', async (req, reply) => {
  if (!requireAuth(req, reply)) return;
  return { id: 'u_demo', merchantId: 'm_demo', storeId: 's_demo', name: 'Rajesh Sharma', email: 'demo@merchantos.in', phone: '+91 98765 43210', role: 'OWNER', permissions: ['*'] };
});

// ============================================================================
// Products  (SPA uses /api/product singular; also expose /api/products)
// ============================================================================
app.get('/api/product', async (req, reply) => {
  if (!requireAuth(req, reply)) return;
  const { search = '', limit = '200' } = req.query || {};
  const q = String(search).toLowerCase();
  const list = PRODUCTS.filter(p => !q || p.name.toLowerCase().includes(q) || (p.sku || '').toLowerCase().includes(q));
  return list.slice(0, Number(limit) || 200);
});
app.get('/api/products', async (req, reply) => {
  if (!requireAuth(req, reply)) return;
  return PRODUCTS;
});
app.post('/api/product', async (req, reply) => {
  if (!requireAuth(req, reply)) return;
  const id = 'p' + (state.productIdSeq++);
  const body = req.body || {};
  const p = {
    id, sku: body.sku || `SKU-${id}`, name: body.name || 'New Product',
    category: body.category || 'General', price: Number(body.price) || 0, costPrice: Number(body.costPrice) || 0,
    stock: Number(body.stock) || 0, lowStock: Number(body.lowStock) || 5,
    unit: body.unit || 'pcs', hsn: body.hsn || '', gstRate: Number(body.gstRate) || 0, active: true,
  };
  PRODUCTS.push(p);
  return p;
});

// ============================================================================
// Customers  (SPA uses /api/customer singular; also /api/customers)
// ============================================================================
app.get('/api/customer', async (req, reply) => {
  if (!requireAuth(req, reply)) return;
  const { search = '' } = req.query || {};
  const q = String(search).toLowerCase();
  if (!q) return CUSTOMERS;
  return CUSTOMERS.filter(c => c.name.toLowerCase().includes(q) || (c.phone || '').includes(q));
});
app.get('/api/customers', async (req, reply) => {
  if (!requireAuth(req, reply)) return;
  return CUSTOMERS;
});
app.post('/api/customer', async (req, reply) => {
  if (!requireAuth(req, reply)) return;
  const id = 'c' + (state.customerIdSeq++);
  const body = req.body || {};
  const c = {
    id, name: body.name || 'New Customer', phone: body.phone || null,
    balance: 0, partyType: 'CREDIT', lastTxnAt: now(),
  };
  CUSTOMERS.push(c);
  return c;
});
app.get('/api/customer/:id', async (req, reply) => {
  if (!requireAuth(req, reply)) return;
  const c = CUSTOMERS.find(x => x.id === req.params.id);
  if (!c) return reply.code(404).send({ error: 'not found' });
  return c;
});
app.get('/api/customer/:id/ledger', async (req, reply) => {
  if (!requireAuth(req, reply)) return;
  // Generate sample ledger based on balance
  const c = CUSTOMERS.find(x => x.id === req.params.id);
  if (!c) return reply.code(404).send({ error: 'not found' });
  const bal = c.balance;
  return [
    { id: 'l1', type: 'UDHAR',  amount: Math.abs(bal) || 500, note: 'Groceries', createdAt: '2026-10-01T10:00:00Z' },
    { id: 'l2', type: 'PAASA',  amount: bal < 0 ? Math.abs(bal) : 200, note: 'Partial payment', createdAt: '2026-10-05T15:00:00Z' },
  ];
});
app.post('/api/customer/:id/ledger', async (req, reply) => {
  if (!requireAuth(req, reply)) return;
  const body = req.body || {};
  const cust = CUSTOMERS.find(c => c.id === req.params.id);
  if (!cust) return reply.code(404).send({ error: 'not found' });
  // Update customer balance based on entry type
  const amt = Number(body.amount) || 0;
  if (body.type === 'UDHAR' || body.type === 'CREDIT') {
    cust.balance = (cust.balance || 0) + amt;
  } else if (body.type === 'PAASA' || body.type === 'DEBIT' || body.type === 'PAYMENT') {
    cust.balance = (cust.balance || 0) - amt;
  } else if (body.type === 'ADJUSTMENT') {
    cust.balance = amt;
  }
  cust.lastTxnAt = now();
  return { ok: true, id: 'l' + Date.now(), newBalance: cust.balance };
});
app.get('/api/customers/:id', async (req, reply) => {
  if (!requireAuth(req, reply)) return;
  const c = CUSTOMERS.find(x => x.id === req.params.id);
  if (!c) return reply.code(404).send({ error: 'not found' });
  return c;
});
app.get('/api/customers/:id/ledger', async (req, reply) => {
  if (!requireAuth(req, reply)) return;
  const c = CUSTOMERS.find(x => x.id === req.params.id);
  if (!c) return reply.code(404).send({ error: 'not found' });
  return [
    { id: 'l1', type: 'UDHAR',  amount: Math.abs(c.balance) || 500, note: 'Groceries', createdAt: '2026-10-01T10:00:00Z' },
  ];
});

// ============================================================================
// Suppliers  (SPA uses /api/supplier singular; also /api/suppliers)
// ============================================================================
app.get('/api/supplier', async (req, reply) => {
  if (!requireAuth(req, reply)) return;
  return SUPPLIERS;
});
app.get('/api/suppliers', async (req, reply) => {
  if (!requireAuth(req, reply)) return;
  return SUPPLIERS;
});
app.post('/api/supplier', async (req, reply) => {
  if (!requireAuth(req, reply)) return;
  const id = 'su' + (state.supplierIdSeq++);
  const body = req.body || {};
  const s = { id, name: body.name || 'New Supplier', phone: body.phone || null, balance: 0, gstin: body.gstin || null };
  SUPPLIERS.push(s);
  return s;
});

// ============================================================================
// Bills  (SPA uses /api/bill singular; also /api/bills)
// ============================================================================
app.get('/api/bill', async (req, reply) => {
  if (!requireAuth(req, reply)) return;
  const { limit = '100' } = req.query || {};
  return state.bills.slice(0, Number(limit) || 100);
});
app.get('/api/bills', async (req, reply) => {
  if (!requireAuth(req, reply)) return;
  return state.bills;
});
app.post('/api/bill', async (req, reply) => {
  if (!requireAuth(req, reply)) return;
  const id = 'b' + (state.billIdSeq++);
  const body = req.body || {};
  const b = {
    id, customerId: body.customerId || null, customerName: body.customerName || 'Walk-in customer',
    total: body.total || 0, status: body.status || 'PAID', createdAt: now(),
  };
  state.bills.unshift(b);
  return b;
});
app.post('/api/bills', async (req, reply) => {
  if (!requireAuth(req, reply)) return;
  const id = 'b' + (state.billIdSeq++);
  const body = req.body || {};
  const b = { id, customerId: body.customerId || null, customerName: body.customerName || 'Walk-in', total: body.total || 0, status: 'PAID', createdAt: now() };
  state.bills.unshift(b);
  return b;
});

// ============================================================================
// Expenses  (SPA uses /api/expense singular; also /api/expenses)
// ============================================================================
app.get('/api/expense', async (req, reply) => {
  if (!requireAuth(req, reply)) return;
  const { limit = '100' } = req.query || {};
  return state.expenses.slice(0, Number(limit) || 100);
});
app.get('/api/expenses', async (req, reply) => {
  if (!requireAuth(req, reply)) return;
  return state.expenses;
});
app.post('/api/expense', async (req, reply) => {
  if (!requireAuth(req, reply)) return;
  const id = 'e' + (state.expenseIdSeq++);
  const body = req.body || {};
  const e = { id, category: body.category || 'MISC', amount: Number(body.amount) || 0, note: body.note || null, createdAt: now() };
  state.expenses.unshift(e);
  return e;
});
app.post('/api/expenses', async (req, reply) => {
  if (!requireAuth(req, reply)) return;
  const id = 'e' + (state.expenseIdSeq++);
  const body = req.body || {};
  const e = { id, category: body.category || 'MISC', amount: Number(body.amount) || 0, note: body.note || null, createdAt: now() };
  state.expenses.unshift(e);
  return e;
});

// ============================================================================
// Shifts  (SPA uses /api/shift singular; also /api/shifts)
// ============================================================================
app.get('/api/shift/current', async (req, reply) => {
  if (!requireAuth(req, reply)) return;
  if (!state.shift) return { open: false, shiftId: null, openedAt: null, openingCash: 0 };
  return { open: true, shiftId: state.shift.shiftId, openedAt: state.shift.openedAt, openingCash: state.shift.openingCash };
});
app.post('/api/shift/open', async (req, reply) => {
  if (!requireAuth(req, reply)) return;
  if (state.shift && state.shift.status === 'OPEN') {
    return { ok: true, shiftId: state.shift.shiftId, openedAt: state.shift.openedAt, openingCash: state.shift.openingCash };
  }
  const body = req.body || {};
  const cash = body.openingCash;
  const opening = typeof cash === 'object' && cash !== null ? Number(cash.minor || 0) / 100 : Number(cash) || 0;
  state.shift = {
    shiftId: 'sh_' + Date.now(),
    status: 'OPEN',
    openedAt: now(),
    openingCash: opening,
    openedBy: 'u_demo',
  };
  return { ok: true, shiftId: state.shift.shiftId, openedAt: state.shift.openedAt, openingCash: opening };
});
app.post('/api/shift/:id/close', async (req, reply) => {
  if (!requireAuth(req, reply)) return;
  if (!state.shift) return reply.code(400).send({ error: 'no shift open' });
  const body = req.body || {};
  const cash = body.closingCash;
  const closing = typeof cash === 'object' && cash !== null ? Number(cash.minor || 0) / 100 : Number(cash) || 0;
  state.shift.status = 'CLOSED';
  state.shift.closedAt = now();
  state.shift.closingCash = closing;
  return { ok: true, shiftId: state.shift.shiftId, totalSales: 0 };
});
app.get('/api/shifts', async (req, reply) => {
  if (!requireAuth(req, reply)) return;
  return state.shift ? [state.shift] : [];
});
app.get('/api/shifts/active', async (req, reply) => {
  if (!requireAuth(req, reply)) return;
  return state.shift && state.shift.status === 'OPEN' ? state.shift : null;
});
app.post('/api/shifts', async (req, reply) => {
  if (!requireAuth(req, reply)) return;
  return { ok: true, shiftId: state.shift ? state.shift.shiftId : 'sh_' + Date.now() };
});
app.post('/api/shifts/:id/close', async (req, reply) => {
  if (!requireAuth(req, reply)) return;
  return { ok: true, totalSales: 0 };
});

// ============================================================================
// Transactions list (used by Transactions page; combines bills + payments)
// ============================================================================
app.get('/api/payment', async (req, reply) => {
  if (!requireAuth(req, reply)) return;
  const { type = '', search = '', limit = '100' } = req.query || {};
  const q = String(search).toLowerCase();
  // Build a unified transaction list from bills
  const txns = state.bills.map(b => ({
    id: b.id, type: 'BILL', amount: b.total, status: b.status === 'PAID' ? 'COMPLETED' : 'PENDING',
    partyName: b.customerName || 'Walk-in customer', note: null, method: b.method || 'CASH',
    createdAt: b.createdAt,
  }));
  // Add sample UPI / expense / khata entries for demo richness
  txns.push(
    { id: 'tx_u1', type: 'PAYMENT', amount: 549,  status: 'COMPLETED', partyName: 'Suresh Patel',  note: 'UPI', method: 'UPI', createdAt: '2026-10-08T16:42:00Z' },
    { id: 'tx_u2', type: 'PAYMENT', amount: 142,  status: 'COMPLETED', partyName: 'Walk-in customer', note: null, method: 'CASH', createdAt: '2026-10-08T15:20:00Z' },
    { id: 'tx_u3', type: 'PAYMENT', amount: 950,  status: 'COMPLETED', partyName: 'Rohit Mehta',   note: 'UPI', method: 'UPI', createdAt: '2026-10-08T14:15:00Z' },
    { id: 'tx_u4', type: 'PAASA',  amount: 200,  status: 'COMPLETED', partyName: 'Priya Singh',   note: 'Partial payment', method: 'CASH', createdAt: '2026-10-08T13:08:00Z' },
    { id: 'tx_u5', type: 'PAYMENT', amount: 1275, status: 'COMPLETED', partyName: 'Walk-in customer', note: 'UPI', method: 'UPI', createdAt: '2026-10-08T11:45:00Z' },
    { id: 'tx_u6', type: 'REFUND',  amount: 320,  status: 'COMPLETED', partyName: 'Amit Verma',    note: 'Damaged item', method: 'CARD', createdAt: '2026-10-07T18:33:00Z' },
    { id: 'tx_u7', type: 'PAYMENT', amount: 410,  status: 'COMPLETED', partyName: 'Suresh Patel',  note: 'UPI', method: 'UPI', createdAt: '2026-10-07T16:00:00Z' },
    { id: 'tx_u8', type: 'UDHAR',  amount: 600,  status: 'COMPLETED', partyName: 'Kavita Joshi',  note: 'Groceries', method: 'CREDIT', createdAt: '2026-10-07T15:00:00Z' },
    { id: 'tx_e1', type: 'EXPENSE', amount: 18000,status: 'COMPLETED', partyName: 'Landlord',      note: 'October rent', method: 'BANK', createdAt: '2026-10-01T09:00:00Z' },
    { id: 'tx_e2', type: 'EXPENSE', amount: 2400, status: 'COMPLETED', partyName: 'BSES',          note: 'Electricity', method: 'UPI', createdAt: '2026-10-03T14:00:00Z' },
    { id: 'tx_e3', type: 'EXPENSE', amount: 12000,status: 'COMPLETED', partyName: 'Helper',        note: 'Salary', method: 'CASH', createdAt: '2026-10-05T10:00:00Z' },
  );
  // Filter
  let filtered = txns;
  if (type && type !== 'all') filtered = filtered.filter(t => t.type === type);
  if (q) filtered = filtered.filter(t => (t.partyName || '').toLowerCase().includes(q) || t.id.toLowerCase().includes(q) || (t.note || '').toLowerCase().includes(q));
  // Sort newest first
  filtered.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  return filtered.slice(0, Number(limit) || 100);
});

// ============================================================================
// Payment sessions  (SPA uses /api/payment/sessions; also /api/payments/sessions)
// ============================================================================
app.post('/api/payment/sessions', async (req, reply) => {
  if (!requireAuth(req, reply)) return;
  const body = req.body || {};
  const id = 'ps_' + Date.now();
  const token = 'tok_' + crypto.randomBytes(6).toString('hex');
  const amt = body.amount;
  return {
    id, token, qrPayload: 'upi://pay?pa=demo@upi&pn=Sharma%20Kirana%20Store&am=' + (typeof amt === 'object' ? (Number(amt.minor) / 100).toFixed(2) : (amt || 0)),
    amount: amt || { currency: 'INR', minor: '0' },
    expiresAt: new Date(Date.now() + 600_000).toISOString(),
    status: 'CREATED',
  };
});
app.post('/api/payments/sessions', async (req, reply) => {
  if (!requireAuth(req, reply)) return;
  const body = req.body || {};
  const id = 'ps_' + Date.now();
  const token = 'tok_' + crypto.randomBytes(6).toString('hex');
  return { id, token, qrPayload: 'upi://pay?pa=demo@upi&pn=Sharma', amount: body.amount, expiresAt: new Date(Date.now() + 600_000).toISOString(), status: 'PENDING' };
});
// (moved to /api/payment/sessions/:token)
app.get('/api/payments/qr/:token', async (req, reply) => {
  // Return a 1x1 transparent PNG so the SPA's <img> doesn't break
  const png = Buffer.from('89504E470D0A1A0A0000000D49484452000000010000000108060000001F15C4890000000D49444154789C63600000000200015B2C2D870000000049454E44AE426082', 'hex');
  reply.header('Content-Type', 'image/png');
  reply.header('Cache-Control', 'no-store');
  return png;
});
app.get('/api/payment/sessions/:token', async (req, reply) => {
  if (!requireAuth(req, reply)) return;
  return { token: req.params.token, status: 'PENDING', amount: { currency: 'INR', minor: '0' } };
});
app.get('/api/payment/qr/:token', async (req, reply) => {
  const png = Buffer.from('89504E470D0A1A0A0000000D49484452000000010000000108060000001F15C4890000000D49444154789C63600000000200015B2C2D870000000049454E44AE426082', 'hex');
  reply.header('Content-Type', 'image/png');
  reply.header('Cache-Control', 'no-store');
  return png;
});

// ============================================================================
// Reports
// ============================================================================
app.get('/api/reports/today', async (req, reply) => {
  if (!requireAuth(req, reply)) return;
  const totalSales = 2916, salesCount = 4;
  const payments = totalSales, paymentsCount = salesCount;
  const refunds = 320, refundsCount = 1;
  const outstandingKhata = Math.abs(CUSTOMERS.filter(c => c.balance < 0).reduce((s, c) => s + c.balance, 0));
  return {
    // Flat fields expected by the Dashboard
    totalSales, totalSalesCount: salesCount,
    payments, paymentsCount,
    refunds, refundsCount,
    outstandingKhata,
    // Nested fields used by the Reports page
    salesCount, byMethod: { UPI: 2774, CASH: 142 },
    billsCount: state.bills.length, expensesTotal: state.expenses.reduce((s, e) => s + e.amount, 0),
    inventory: { totalSkus: PRODUCTS.length, lowStock: PRODUCTS.filter(p => p.stock < p.lowStock).length, stockValue: PRODUCTS.reduce((s, p) => s + p.stock * p.costPrice, 0) },
    khata: { outstanding: outstandingKhata, credit: CUSTOMERS.filter(c => c.balance > 0).reduce((s, c) => s + c.balance, 0) },
  };
});
app.get('/api/reports/top-products', async (req, reply) => {
  if (!requireAuth(req, reply)) return;
  const days = Math.max(1, Math.min(365, Number((req.query || {}).days) || 30));
  return {
    products: PRODUCTS.map((p, i) => {
      const sold = [12, 8, 15, 23, 19, 6, 9, 11][i] || 5;
      const quantity = sold * days;
      const revenue = quantity * p.price;
      return { productId: p.id, name: p.name, quantity, revenueMinor: String(Math.round(revenue * 100)), currency: 'INR' };
    }).sort((a, b) => Number(BigInt(b.revenueMinor) - BigInt(a.revenueMinor))),
  };
});
app.get('/api/reports/outstanding-khata', async (req, reply) => {
  if (!requireAuth(req, reply)) return;
  const { limit = '5' } = req.query || {};
  // Return array of customers with negative balance (they owe merchant)
  const parties = CUSTOMERS
    .filter(c => c.balance < 0)
    .map(c => ({ customerId: c.id, name: c.name, balance: Math.abs(c.balance), lastTxnAt: c.lastTxnAt }))
    .sort((a, b) => b.balance - a.balance)
    .slice(0, Number(limit) || 5);
  const total = CUSTOMERS.filter(c => c.balance < 0).reduce((s, c) => s + Math.abs(c.balance), 0);
  return parties;  // SPA Dashboard expects an array
});

// ============================================================================
// AI assistant
// ============================================================================
app.post('/api/assistant/ask', async (req, reply) => {
  if (!requireAuth(req, reply)) return;
  return { id: 'ai_' + Date.now(), reply: 'Demo mode: AI assistant is disabled in the sandbox preview. In production, this routes to your local Ollama instance for fully private, free business insights.' };
});

// ============================================================================
// Health + misc
// ============================================================================
app.get('/healthz', async () => ({ ok: true, time: now() }));

// ============================================================================
// SPA serving
// ============================================================================
const HTML = fs.readFileSync(path.join(__dirname, 'src', 'landing', 'spa_index.html'), 'utf-8');
const JS   = fs.readFileSync(path.join(__dirname, 'src', 'landing', 'spa_app.js'));
const CSS  = fs.readFileSync(path.join(__dirname, 'src', 'landing', 'spa_app.css'));

function setHtml(req, reply) {
  reply.header('Content-Type', 'text/html; charset=utf-8');
  reply.header('Cache-Control', 'no-cache');
  return reply.send(HTML);
}
function setJs(req, reply) {
  reply.header('Content-Type', 'application/javascript; charset=utf-8');
  reply.header('Cache-Control', 'public, max-age=31536000, immutable');
  return reply.send(JS);
}
function setCss(req, reply) {
  reply.header('Content-Type', 'text/css; charset=utf-8');
  reply.header('Cache-Control', 'public, max-age=31536000, immutable');
  return reply.send(CSS);
}

// SPA routes — anything that doesn't start with /api, /auth, /healthz, /pay, or have a dot is HTML
app.get('/', setHtml);
app.get('/login', setHtml);
app.get('/app', setHtml);
app.get('/app/*', setHtml);
app.get('/app.js', setJs);

// /pay/:token SPA route (customer-facing payment page) — defined here so setHtml is initialized
app.get('/pay/:token', setHtml);
app.get('/app.css', setCss);
app.get('/manifest.json', async (req, reply) => {
  reply.header('Content-Type', 'application/manifest+json');
  return {
    name: 'MerchantOS', short_name: 'MerchantOS',
    description: '0% Commission UPI payments, khata, inventory & GST invoicing for Indian shops.',
    start_url: '/app', display: 'standalone', background_color: '#1E3A8A', theme_color: '#1E3A8A',
    icons: [
      { src: '/icon-192.svg', sizes: '192x192', type: 'image/svg+xml' },
      { src: '/icon-512.svg', sizes: '512x512', type: 'image/svg+xml' },
    ],
  };
});

app.listen({ port: Number(PORT), host: '0.0.0.0' }, (err) => {
  if (err) { console.error(err); process.exit(1); }
  console.log(`MerchantOS demo server listening on http://localhost:${PORT}`);
});
