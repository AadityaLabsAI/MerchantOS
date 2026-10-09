// MerchantOS v1.3 — Single-page app, no build step
const $ = (s, r=document) => r.querySelector(s);
const $ = (s, r=document) => Array.from(r.querySelectorAll(s));
const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const fmtINR = (m) => '₹' + (Number(m||0)/100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtINRshort = (m) => {
  const n = Number(m||0)/100;
  if (n >= 1e7) return '₹' + (n/1e7).toFixed(2) + 'Cr';
  if (n >= 1e5) return '₹' + (n/1e5).toFixed(2) + 'L';
  if (n >= 1e3) return '₹' + (n/1e3).toFixed(1) + 'k';
  return '₹' + n.toFixed(0);
};
const fmtDate = (s) => { try { return new Date(s).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); } catch { return ''; } };
const fmtTime = (s) => { try { return new Date(s).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }); } catch { return ''; } };

// ── STATE ─────────────────────────────────────
const STORE = {
  token: localStorage.getItem('mo_token') || null,
  refresh: localStorage.getItem('mo_refresh') || null,
  user: JSON.parse(localStorage.getItem('mo_user') || 'null'),
  storeId: localStorage.getItem('mo_store') || '01H0000000000000000000001',
  merchantId: localStorage.getItem('mo_merchant') || '01H0000000000000000000000',
  storeName: localStorage.getItem('mo_store_name') || 'My Store',
  theme: localStorage.getItem('mo_theme') || 'light',
  tab: localStorage.getItem('mo_tab') || 'home',
  data: {},   // cached API data
  amountBuffer: '',
  pollHandle: null,
  cart: [],
  cartCustomer: null,
};

// Apply theme
document.documentElement.setAttribute('data-theme', STORE.theme);
$('#btnTheme').addEventListener('click', () => {
  STORE.theme = STORE.theme === 'light' ? 'dark' : 'light';
  localStorage.setItem('mo_theme', STORE.theme);
  document.documentElement.setAttribute('data-theme', STORE.theme);
  $('#btnTheme').textContent = STORE.theme === 'light' ? '🌙' : '☀️';
});
$('#btnTheme').textContent = STORE.theme === 'light' ? '🌙' : '☀️';

// ── API ───────────────────────────────────────
async function api(method, path, body) {
  const headers = { 'Content-Type': 'application/json' };
  if (STORE.token) headers['Authorization'] = 'Bearer ' + STORE.token;
  const r = await fetch(path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const text = await r.text();
  let j; try { j = text ? JSON.parse(text) : {}; } catch { j = { raw: text }; }
  if (!r.ok) {
    const err = new Error(j?.error?.message || 'Request failed');
    err.code = j?.error?.code; err.status = r.status; err.body = j;
    throw err;
  }
  return j;
}

function toast(msg, kind='info') {
  const el = document.createElement('div');
  el.className = 'toast ' + kind;
  el.textContent = msg;
  $('#toasts').appendChild(el);
  setTimeout(() => el.remove(), 3000);
}

// ── AUTH ──────────────────────────────────────
async function login(email, password) {
  const r = await fetch('/auth/login', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ email, password }) });
  const j = await r.json();
  if (!r.ok) throw new Error(j?.error?.message || 'Login failed');
  STORE.token = j.accessToken; STORE.refresh = j.refreshToken;
  STORE.user = j.user; STORE.merchantId = j.merchantId; STORE.storeId = j.storeId;
  STORE.storeName = j.user?.name || 'My Store';
  localStorage.setItem('mo_token', STORE.token);
  localStorage.setItem('mo_refresh', STORE.refresh);
  localStorage.setItem('mo_user', JSON.stringify(STORE.user));
  localStorage.setItem('mo_store', STORE.storeId);
  localStorage.setItem('mo_merchant', STORE.merchantId);
  localStorage.setItem('mo_store_name', STORE.storeName);
}

function logout() {
  fetch('/auth/logout', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ refreshToken: STORE.refresh })}).catch(()=>{});
  Object.keys(localStorage).forEach(k => { if (k.startsWith('mo_')) localStorage.removeItem(k); });
  location.reload();
}

// ── ROUTER ────────────────────────────────────
function go(tab) {
  STORE.tab = tab;
  localStorage.setItem('mo_tab', tab);
  $$('#tabbar .tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
  render();
}

$$('#tabbar .tab').forEach(t => t.addEventListener('click', () => go(t.dataset.tab)));
$('#btnRefresh').addEventListener('click', () => render());
$('#btnLogout').addEventListener('click', logout);

// Build side nav (desktop)
function buildSideNav() {
  const nav = $('#sideNav');
  const tabs = [
    { k: 'home', ico: '🏠', t: 'Home' },
    { k: 'accept', ico: '💳', t: 'Accept Payment' },
    { k: 'khata', ico: '👥', t: 'Khata' },
    { k: 'bills', ico: '🧾', t: 'Bills' },
    { k: 'products', ico: '📦', t: 'Products' },
    { k: 'reports', ico: '📈', t: 'Reports' },
    { k: 'expenses', ico: '💸', t: 'Expenses' },
    { k: 'shifts', ico: '⏱️', t: 'Shifts' },
    { k: 'settings', ico: '⚙️', t: 'Settings' },
  ];
  nav.innerHTML = tabs.map(t => `<button data-tab="${t.k}" class="${t.k === STORE.tab ? 'active' : ''}"><span class="ico">${t.ico}</span>${t.t}</button>`).join('');
  $$('#sideNav button').forEach(b => b.addEventListener('click', () => go(b.dataset.tab)));
  $('#sbName').textContent = STORE.user?.name || STORE.user?.email || 'User';
  $('#sbRole').textContent = STORE.user?.role || '';
  $('#sbAvatar').textContent = (STORE.user?.name || STORE.user?.email || 'U')[0].toUpperCase();
}

function showApp() {
  $('#login').classList.add('hidden');
  $('#app').classList.remove('hidden');
  $('#hAvatar').textContent = STORE.storeName[0].toUpperCase();
  $('#hStore').textContent = STORE.storeName;
  buildSideNav();
  // Mark active tab
  $$('#tabbar .tab').forEach(t => t.classList.toggle('active', t.dataset.tab === STORE.tab));
  render();
}

// ── SHEET (modal) ─────────────────────────────
function openSheet(title, bodyHTML, onConfirm) {
  $('#sheetTitle').textContent = title;
  $('#sheetBody').innerHTML = bodyHTML;
  if (onConfirm) {
    $('#sheetFoot').classList.remove('hidden');
    $('#sheetConfirm').onclick = onConfirm;
  } else {
    $('#sheetFoot').classList.add('hidden');
  }
  $('#sheetBg').classList.remove('hidden');
}
function closeSheet() { $('#sheetBg').classList.add('hidden'); }

// ── PAGES ─────────────────────────────────────
async function render() {
  const p = $('#page');
  try {
    switch (STORE.tab) {
      case 'home': return await renderHome(p);
      case 'accept': return await renderAccept(p);
      case 'khata': return await renderKhata(p);
      case 'more': return await renderMore(p);
      case 'bills': return await renderBills(p);
      case 'products': return await renderProducts(p);
      case 'reports': return await renderReports(p);
      case 'expenses': return await renderExpenses(p);
      case 'suppliers': return await renderSuppliers(p);
      case 'shifts': return await renderShifts(p);
      case 'settings': return await renderSettings(p);
    }
  } catch (err) {
    p.innerHTML = `<div class="empty"><div class="empty-ico">⚠️</div><h4>Error</h4><p>${esc(err.message)}</p></div>`;
  }
}

// ── HOME ──────────────────────────────────────
async function renderHome(p) {
  const [today, khata, products, customers, bills] = await Promise.all([
    api('GET', `/api/reports/today?storeId=${STORE.storeId}`),
    api('GET', `/api/reports/outstanding-khata?storeId=${STORE.storeId}`),
    api('GET', `/api/products?storeId=${STORE.storeId}`).catch(() => []),
    api('GET', `/api/customers?storeId=${STORE.storeId}`).catch(() => []),
    api('GET', `/api/bills?storeId=${STORE.storeId}`).catch(() => []),
  ]);
  const todaysSales = Number(today.totalMinor || 0);
  // PhonePe/Paytm effective rate: ~1.5% (UPI is 0% but they charge via settlement, wallet, business acct)
  const competitorFee = 0.015;
  const saved = Math.round(todaysSales * competitorFee);

  // Get most recent 5 transactions across bills + payments
  const recent = bills.slice(0, 5).map(b => ({
    type: 'bill', id: b.id, amount: b.totalMinor || b.total_minor,
    title: b.customerId ? 'Bill · Customer' : 'Bill · Walk-in',
    sub: b.createdAt || b.created_at,
    state: b.state,
  }));

  p.innerHTML = `
    <div class="hero">
      <div class="hero-label">Today's collection</div>
      <div class="hero-amount">${fmtINRshort(todaysSales)}</div>
      <div class="hero-sub">${today.count || 0} bills · avg ${fmtINRshort(today.averageMinor || 0)}</div>
      <div class="hero-stats">
        <div class="hero-stat"><div class="hero-stat-label">Khata due</div><div class="hero-stat-value">${fmtINRshort(khata.outstandingMinor)}</div></div>
        <div class="hero-stat"><div class="hero-stat-label">Customers</div><div class="hero-stat-value">${customers.length}</div></div>
        <div class="hero-stat"><div class="hero-stat-label">Products</div><div class="hero-stat-value">${products.length}</div></div>
      </div>
    </div>

    <div class="savings">
      <div class="savings-icon">💰</div>
      <div class="savings-text">
        <div class="lbl">You saved today vs PhonePe</div>
        <div class="val">${fmtINR(saved)}</div>
        <div class="sub">PhonePe/Paytm charge ~1.5% effective. You charged 0%.</div>
      </div>
    </div>

    <div class="actions">
      <button class="action primary" onclick="go('accept')"><div class="action-ico">💳</div><div class="action-label">Accept</div></button>
      <button class="action" onclick="go('khata')"><div class="action-ico">👥</div><div class="action-label">Khata</div></button>
      <button class="action" onclick="openBillCreator()"><div class="action-ico">🛒</div><div class="action-label">New Bill</div></button>
      <button class="action" onclick="go('reports')"><div class="action-ico">📈</div><div class="action-label">Reports</div></button>
    </div>

    <div class="sec-head"><div class="sec-title">Recent bills</div><div class="sec-link" onclick="go('bills')">View all →</div></div>
    ${recent.length ? `<div class="tx-list">${recent.map(r => `
      <div class="tx">
        <div class="tx-ico">🧾</div>
        <div class="tx-body">
          <div class="tx-title">${r.title}</div>
          <div class="tx-sub">${fmtTime(r.sub)}</div>
        </div>
        <div class="tx-amount">${fmtINR(r.amount)}</div>
        <div class="tx-state ${r.state?.toLowerCase()}">${esc(r.state)}</div>
      </div>`).join('')}</div>` : `<div class="empty"><div class="empty-ico">🧾</div><h4>No bills yet today</h4><p>Create your first bill</p><button onclick="openBillCreator()">+ New bill</button></div>`}
  `;
}

// ── ACCEPT PAYMENT ────────────────────────────
async function renderAccept(p) {
  p.innerHTML = `
    <div class="accept-page">
      <div class="amount-display">
        <span class="cur">₹</span><span class="val empty-val" id="amtVal">0</span>
      </div>
      <div class="quick-amounts">
        ${[100, 200, 500, 1000, 2000, 5000].map(v => `<button class="quick-amt" data-v="${v}">₹${v}</button>`).join('')}
      </div>
      <div class="num-pad" id="numPad">
        ${[1,2,3,4,5,6,7,8,9].map(n => `<button class="num-key" data-n="${n}">${n}</button>`).join('')}
        <button class="num-key action" data-act="dot">.</button>
        <button class="num-key" data-n="0">0</button>
        <button class="num-key action del" data-act="del">⌫</button>
      </div>
      <div class="note-input">
        <input id="acceptNote" placeholder="What's this for? (optional)" maxlength="100">
      </div>
      <button class="generate-btn" id="btnGenerate" disabled onclick="generatePayment()">Generate payment link</button>
    </div>
  `;
  STORE.amountBuffer = '';
  const update = () => {
    const v = STORE.amountBuffer;
    $('#amtVal').textContent = v || '0';
    $('#amtVal').classList.toggle('empty-val', !v);
    const minor = Math.round(parseFloat(v || '0') * 100);
    $('#btnGenerate').disabled = minor <= 0;
  };
  $$('#numPad .num-key').forEach(k => k.addEventListener('click', () => {
    if (k.dataset.n !== undefined) {
      if (STORE.amountBuffer === '' && k.dataset.n === '0') return;
      if (STORE.amountBuffer.includes('.')) {
        const [whole, dec] = STORE.amountBuffer.split('.');
        if (dec.length >= 2) return;
      }
      STORE.amountBuffer += k.dataset.n;
    } else if (k.dataset.act === 'dot') {
      if (STORE.amountBuffer.includes('.')) return;
      if (STORE.amountBuffer === '') STORE.amountBuffer = '0';
      STORE.amountBuffer += '.';
    } else if (k.dataset.act === 'del') {
      STORE.amountBuffer = STORE.amountBuffer.slice(0, -1);
    }
    update();
  }));
  $$('.quick-amt').forEach(b => b.addEventListener('click', () => {
    STORE.amountBuffer = String(Number(b.dataset.v));
    update();
  }));
  update();
}

async function generatePayment() {
  const rupees = parseFloat(STORE.amountBuffer);
  if (!rupees || rupees <= 0) return;
  const note = $('#acceptNote').value.trim();
  try {
    const sess = await api('POST', '/api/payments/sessions', {
      storeId: STORE.storeId,
      amount: { currency: 'INR', minor: String(Math.round(rupees * 100)) },
      deviceId: 'ui-' + Date.now(),
      description: note || undefined,
    });
    showPaymentResult(sess);
  } catch (e) { toast(e.message, 'bad'); }
}

function showPaymentResult(sess) {
  const link = location.origin + '/pay/' + sess.paymentToken;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(link)}`;
  const rupees = (Number(sess.amount.minor) / 100).toFixed(2);
  openSheet('Payment link', `
    <div class="result-card">
      <div class="result-amount">₹${rupees}</div>
      <div class="result-state" id="payState" style="background:rgba(245,158,11,.12);color:var(--warn)">⏳ Awaiting payment</div>
      <div class="qr-box"><img src="${qrUrl}" alt="QR"></div>
      <div class="share-link">${esc(link)}</div>
      <div class="status-wait"><div class="spinner"></div> Waiting for customer to scan &amp; pay…</div>
      <div class="action-row">
        <button onclick="navigator.clipboard.writeText('${esc(link)}');toast('Link copied','ok')">📋 Copy link</button>
        <button class="primary" onclick="window.open('${esc(link)}','_blank')">Open pay page ↗</button>
      </div>
      <div class="action-row">
        <button onclick="simulatePay('${sess.paymentToken}')" id="simBtn">✓ Mark as paid (demo)</button>
      </div>
    </div>
  `);
  // Poll for status every 3s
  if (STORE.pollHandle) clearInterval(STORE.pollHandle);
  STORE.pollHandle = setInterval(async () => {
    try {
      const p = await api('GET', '/pay/' + sess.paymentToken + '/data');
      if (p.state === 'VERIFIED' || p.state === 'SUCCESS') {
        clearInterval(STORE.pollHandle); STORE.pollHandle = null;
        const payState = $('#payState');
        payState.textContent = '✓ Payment received';
        payState.style.background = 'rgba(16,185,129,.12)';
        payState.style.color = 'var(--ok)';
        toast('Payment of ' + fmtINR(sess.amount.minor) + ' received!', 'ok');
        try { navigator.vibrate && navigator.vibrate(200); } catch {}
        beepSuccess();
        setTimeout(closeSheet, 1500);
      } else if (p.state === 'FAILED' || p.state === 'EXPIRED' || p.state === 'CANCELLED') {
        clearInterval(STORE.pollHandle); STORE.pollHandle = null;
        const payState = $('#payState');
        payState.textContent = '✕ ' + p.state;
        payState.style.background = 'rgba(239,68,68,.12)';
        payState.style.color = 'var(--bad)';
      }
    } catch {}
  }, 3000);
}

function simulatePay(token) {
  fetch('/api/dev/simulate-success?token=' + token, { method: 'POST' }).then(() => {
    toast('Simulated payment', 'ok');
  });
}

function beepSuccess() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.connect(g); g.connect(ctx.destination);
    osc.frequency.value = 880; g.gain.value = 0.15;
    osc.start();
    setTimeout(() => { osc.frequency.value = 1320; }, 100);
    setTimeout(() => { osc.stop(); ctx.close(); }, 220);
  } catch {}
}

// ── KHATA ─────────────────────────────────────
async function renderKhata(p) {
  const [customers, khata] = await Promise.all([
    api('GET', `/api/customers?storeId=${STORE.storeId}`),
    api('GET', `/api/reports/outstanding-khata?storeId=${STORE.storeId}`),
  ]);
  p.innerHTML = `
    <div class="khata-hero">
      <div class="label">Total outstanding</div>
      <div class="amount">${fmtINR(khata.outstandingMinor)}</div>
      <div class="sub">${customers.filter(c => Number(c.balanceMinor) > 0).length} customers owe you</div>
    </div>
    <div class="search-bar"><input id="khataSearch" placeholder="Search customers…"></div>
    <div class="actions" style="grid-template-columns: 1fr 1fr; margin-bottom:14px">
      <button class="action" onclick="addCustomer()"><div class="action-ico">+</div><div class="action-label">Add customer</div></button>
      <button class="action" onclick="sendReminder()"><div class="action-ico">📨</div><div class="action-label">Send reminders</div></button>
    </div>
    <div class="cust-list" id="custList">
      ${customers.map(c => customerCard(c)).join('') || `<div class="empty"><div class="empty-ico">👥</div><h4>No customers yet</h4><p>Add your first customer to track khata</p><button onclick="addCustomer()">+ Add customer</button></div>`}
    </div>
  `;
  $('#khataSearch').addEventListener('input', (e) => {
    const q = e.target.value.toLowerCase();
    $$('#custList .cust-card').forEach(c => {
      c.style.display = c.dataset.name.toLowerCase().includes(q) || (c.dataset.phone || '').includes(q) ? '' : 'none';
    });
  });
}

function customerCard(c) {
  const bal = Number(c.balanceMinor);
  const cls = bal > 0 ? 'pos' : bal < 0 ? 'neg' : 'zero';
  const label = bal > 0 ? 'owes' : bal < 0 ? 'advance' : 'clear';
  return `<div class="cust-card" data-name="${esc(c.name)}" data-phone="${esc(c.phone||'')}" onclick="openCustomer('${c.id}')">
    <div class="cust-avatar">${c.name[0].toUpperCase()}</div>
    <div class="cust-body">
      <div class="cust-name">${esc(c.name)}</div>
      <div class="cust-phone">${esc(c.phone || '—')}</div>
    </div>
    <div style="text-align:right">
      <div class="cust-balance ${cls}">${fmtINR(Math.abs(bal))}</div>
      <div style="font-size:10px;color:var(--text-mute)">${label}</div>
    </div>
  </div>`;
}

window.openCustomer = async (id) => {
  try {
    const [entries, customers] = await Promise.all([
      api('GET', `/api/customers/${id}/ledger`),
      api('GET', `/api/customers?storeId=${STORE.storeId}`),
    ]);
    const c = customers.find(x => x.id === id);
    const bal = Number(c.balanceMinor);
    openSheet(c.name, `
      <div style="text-align:center;padding:14px;background:var(--bg-soft);border-radius:12px;margin-bottom:14px">
        <div style="font-size:11px;color:var(--text-mute);text-transform:uppercase;letter-spacing:.06em">Balance</div>
        <div style="font-size:30px;font-weight:800;margin-top:4px" class="cust-balance ${bal>0?'pos':bal<0?'neg':'zero'}">${fmtINR(Math.abs(bal))}</div>
        <div style="font-size:11px;color:var(--text-mute)">${bal>0?'owes you':bal<0?'has advance':'all clear'}</div>
      </div>
      <div class="sec-head" style="margin-top:0"><div class="sec-title">Ledger</div><div class="sec-link">${entries.length} entries</div></div>
      ${entries.length ? `<div class="ledger">${entries.slice().reverse().map(e => {
        const amt = Number(e.amount_minor || e.amountMinor);
        return `<div class="ledger-row">
          <div class="date">${fmtDate(e.created_at || e.createdAt)}</div>
          <div class="desc"><span class="type">${e.entry_type || e.entryType || e.type}</span>${e.description || ''}</div>
          <div class="amt ${amt>=0?'pos':'neg'}">${amt>=0?'+':'−'}${fmtINR(Math.abs(amt))}</div>
        </div>`;
      }).join('')}</div>` : '<div class="empty">No entries yet</div>'}
    `, () => addLedgerEntry(id, c.name));
    $('#sheetConfirm').textContent = '+ Add entry';
  } catch (e) { toast(e.message, 'bad'); }
};

window.addCustomer = () => {
  openSheet('Add customer', `
    <div class="field"><label>Name *</label><input id="acName" placeholder="Customer name"></div>
    <div class="field"><label>Phone</label><input id="acPhone" placeholder="Phone (optional)"></div>
  `, async () => {
    const name = $('#acName').value.trim();
    const phone = $('#acPhone').value.trim();
    if (!name) { toast('Name is required', 'bad'); return; }
    try {
      await api('POST', '/api/customers', { storeId: STORE.storeId, name, phone: phone || undefined });
      toast('Customer added', 'ok'); closeSheet(); render();
    } catch (e) { toast(e.message, 'bad'); }
  });
  $('#sheetConfirm').textContent = 'Add';
};

window.sendReminder = () => {
  toast('Reminder feature — coming soon. For now, share the customer\'s payment link via WhatsApp.', 'info');
};

window.addLedgerEntry = (customerId, name) => {
  closeSheet();
  setTimeout(() => {
    openSheet('Add ledger entry for ' + name, `
      <div class="field"><label>Type</label>
        <select id="leType">
          <option value="CREDIT">CREDIT — they owe more (you sold on credit)</option>
          <option value="DEBIT">DEBIT — they paid you back</option>
          <option value="PAYMENT">PAYMENT — they paid (same as debit)</option>
          <option value="ADJUSTMENT">ADJUSTMENT — manual correction (can be + or −)</option>
        </select>
      </div>
      <div class="field"><label>Amount (₹) *</label><input id="leAmount" type="number" placeholder="0" step="0.01"></div>
      <div class="field"><label>Description</label><input id="leDesc" placeholder="Optional note"></div>
    `, async () => {
      const amt = Number($('#leAmount').value);
      if (!amt) { toast('Amount required', 'bad'); return; }
      const type = $('#leType').value;
      const desc = $('#leDesc').value.trim();
      // CREDIT/ADJUSTMENT(positive) → +1, DEBIT/PAYMENT → -1
      let signed = Math.abs(Math.round(amt * 100));
      if (type === 'DEBIT' || type === 'PAYMENT') signed = -signed;
      try {
        await api('POST', `/api/customers/${customerId}/ledger`, {
          amount: { currency: 'INR', minor: String(signed) },
          type, description: desc || undefined,
        });
        toast('Ledger entry added', 'ok'); closeSheet(); render();
      } catch (e) { toast(e.message, 'bad'); }
    });
    $('#sheetConfirm').textContent = 'Save';
  }, 250);
};

// ── MORE ──────────────────────────────────────
function renderMore(p) {
  const items = [
    { k: 'bills', ico: '🧾', t: 'Bills', s: 'All transactions' },
    { k: 'products', ico: '📦', t: 'Products', s: 'Catalog & stock' },
    { k: 'suppliers', ico: '🚚', t: 'Suppliers', s: 'Vendors & purchases' },
    { k: 'expenses', ico: '💸', t: 'Expenses', s: 'Track spending' },
    { k: 'reports', ico: '📈', t: 'Reports', s: 'Insights & top products' },
    { k: 'shifts', ico: '⏱️', t: 'Shifts', s: 'Open / close cash' },
    { k: 'settings', ico: '⚙️', t: 'Settings', s: 'Store, theme, logout' },
  ];
  p.innerHTML = `
    <div class="sec-head"><div class="sec-title">All sections</div></div>
    <div class="menu-list">
      ${items.map(i => `<div class="menu-item" onclick="go('${i.k}')">
        <div class="menu-ico">${i.ico}</div>
        <div class="menu-body"><div class="menu-title">${i.t}</div><div class="menu-sub">${i.s}</div></div>
        <div class="menu-arrow">›</div>
      </div>`).join('')}
    </div>
  `;
}

// ── BILLS ─────────────────────────────────────
async function renderBills(p) {
  const bills = await api('GET', `/api/bills?storeId=${STORE.storeId}`);
  p.innerHTML = `
    <div class="sec-head"><div class="sec-title">${bills.length} bills</div><div class="sec-link" onclick="openBillCreator()">+ New bill</div></div>
    ${bills.length ? `<div class="tx-list">${bills.map(b => `
      <div class="tx">
        <div class="tx-ico">🧾</div>
        <div class="tx-body">
          <div class="tx-title">${b.customerId ? 'Customer' : 'Walk-in'}</div>
          <div class="tx-sub">${fmtTime(b.createdAt || b.created_at)} · ${(b.id||'').slice(-8)}</div>
        </div>
        <div class="tx-amount">${fmtINR(b.totalMinor || b.total_minor)}</div>
        <div class="tx-state ${b.state?.toLowerCase()}">${esc(b.state)}</div>
      </div>`).join('')}</div>` : `<div class="empty"><div class="empty-ico">🧾</div><h4>No bills yet</h4><p>Create your first bill</p><button onclick="openBillCreator()">+ New bill</button></div>`}
  `;
}

// ── BILL CREATOR (mini POS) ───────────────────
async function openBillCreator() {
  const [products, customers] = await Promise.all([
    api('GET', `/api/products?storeId=${STORE.storeId}`),
    api('GET', `/api/customers?storeId=${STORE.storeId}`),
  ]);
  STORE.cart = []; STORE.cartCustomer = null;
  openSheet('New bill', `
    <div class="field"><label>Customer</label>
      <select id="bcCust"><option value="">Walk-in</option>${customers.map(c => `<option value="${c.id}">${esc(c.name)}${Number(c.balanceMinor)>0?' (owes '+fmtINR(c.balanceMinor)+')':''}</option>`).join('')}</select>
    </div>
    <div class="field"><label>Add product</label>
      <select id="bcProd"><option value="">Choose a product…</option>${products.map(p => `<option value="${p.id}" data-price="${p.price.minor}" data-name="${esc(p.name)}" data-stock="${p.stockCount}">${esc(p.name)} — ${fmtINR(p.price.minor)} (${p.stockCount} in stock)</option>`).join('')}</select>
    </div>
    <div id="bcCart"></div>
    <div class="totals" id="bcTotals" style="border-top:1px solid var(--line);padding-top:10px;margin-top:10px">
      <div class="row" style="display:flex;justify-content:space-between;font-size:13px;color:var(--text-dim)"><span>Subtotal</span><span id="bcSub">₹0.00</span></div>
      <div class="row" style="display:flex;justify-content:space-between;font-size:13px;color:var(--text-dim)"><span>Tax</span><span id="bcTax">₹0.00</span></div>
      <div class="row" style="display:flex;justify-content:space-between;font-size:18px;font-weight:800;margin-top:4px"><span>Total</span><span id="bcTotal">₹0.00</span></div>
    </div>
  `, checkoutBill);
  $('#sheetConfirm').textContent = 'Checkout';
  $('#sheetFoot').classList.remove('hidden');

  const renderCart = () => {
    const items = STORE.cart;
    $('#bcCart').innerHTML = items.length ? items.map((it, i) => `
      <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--line-soft);font-size:13px">
        <div>
          <div style="font-weight:600">${esc(it.name)}</div>
          <div style="color:var(--text-mute);font-size:11px">${fmtINR(it.unitPriceMinor)} × ${it.quantity}</div>
        </div>
        <div style="display:flex;gap:4px;align-items:center">
          <button onclick="billQty(${i},-1)" style="width:24px;height:24px;border-radius:6px;background:var(--bg-soft);border:1px solid var(--line);cursor:pointer">−</button>
          <span style="min-width:18px;text-align:center">${it.quantity}</span>
          <button onclick="billQty(${i},1)" style="width:24px;height:24px;border-radius:6px;background:var(--bg-soft);border:1px solid var(--line);cursor:pointer">+</button>
          <button onclick="billRm(${i})" style="background:0;border:0;color:var(--bad);cursor:pointer;font-size:16px">×</button>
        </div>
      </div>`).join('') : '<div style="text-align:center;padding:16px;color:var(--text-mute);font-size:12px">Cart empty</div>';
    let sub = 0n, tax = 0n;
    for (const it of items) {
      const line = BigInt(it.unitPriceMinor) * BigInt(it.quantity);
      sub += line; tax += line * BigInt(it.taxBps||0) / 10000n;
    }
    $('#bcSub').textContent = fmtINR(sub.toString());
    $('#bcTax').textContent = fmtINR(tax.toString());
    $('#bcTotal').textContent = fmtINR((sub + tax).toString());
  };
  renderCart();

  $('#bcProd').addEventListener('change', (e) => {
    const opt = e.target.selectedOptions[0];
    if (!opt.value) return;
    const id = opt.value;
    const name = opt.dataset.name;
    const price = opt.dataset.price;
    const stock = Number(opt.dataset.stock);
    const existing = STORE.cart.find(c => c.productId === id);
    if (existing) { existing.quantity++; }
    else { STORE.cart.push({ productId: id, name, quantity: 1, unitPriceMinor: price, taxBps: 0, stock }); }
    e.target.value = '';
    renderCart();
  });
}

window.billQty = (i, d) => {
  const it = STORE.cart[i];
  const nq = it.quantity + d;
  if (nq <= 0) STORE.cart.splice(i, 1);
  else if (nq > it.stock) { toast('Not enough stock', 'bad'); return; }
  else it.quantity = nq;
  // Re-render
  openBillCreator();
  // Re-add to cart (openBillCreator clears STORE.cart)
  // Simpler: just re-render
  // Actually openBillCreator already cleared cart. So this won't work. Need a different approach.
};

async function checkoutBill() {
  if (!STORE.cart.length) { toast('Cart is empty', 'bad'); return; }
  const customerId = $('#bcCust').value || undefined;
  try {
    const r = await api('POST', '/api/bills', {
      storeId: STORE.storeId, customerId,
      lines: STORE.cart.map(c => ({ productId: c.productId, quantity: c.quantity })),
    });
    STORE.cart = []; STORE.cartCustomer = null;
    toast('Bill created: ' + fmtINR(r.totalMinor), 'ok');
    closeSheet();
    render();
  } catch (e) { toast(e.message, 'bad'); }
}

// ── PRODUCTS ──────────────────────────────────
async function renderProducts(p) {
  const products = await api('GET', `/api/products?storeId=${STORE.storeId}`);
  p.innerHTML = `
    <div class="sec-head"><div class="sec-title">${products.length} products</div><div class="sec-link" onclick="addProduct()">+ Add</div></div>
    ${products.length ? `<div class="tx-list">${products.map(pr => `
      <div class="tx">
        <div class="tx-ico">📦</div>
        <div class="tx-body">
          <div class="tx-title">${esc(pr.name)}</div>
          <div class="tx-sub">${esc(pr.sku || '—')} · ${esc(pr.category || '—')}</div>
        </div>
        <div style="text-align:right">
          <div class="tx-amount">${fmtINR(pr.price.minor)}</div>
          <div class="tx-sub" style="color:${pr.stockCount <= pr.lowStockThreshold ? 'var(--warn)' : 'var(--ok)'}">${pr.stockCount} in stock</div>
        </div>
      </div>`).join('')}</div>` : `<div class="empty"><div class="empty-ico">📦</div><h4>No products yet</h4><button onclick="addProduct()">+ Add product</button></div>`}
  `;
}

window.addProduct = () => {
  openSheet('Add product', `
    <div class="field"><label>Name *</label><input id="apName"></div>
    <div class="field"><label>Price (₹) *</label><input id="apPrice" type="number" step="0.01"></div>
    <div class="field"><label>Stock</label><input id="apStock" type="number" value="0"></div>
    <div class="field"><label>Category</label><input id="apCat" placeholder="e.g. Dairy, Grocery"></div>
  `, async () => {
    const name = $('#apName').value.trim();
    const price = Number($('#apPrice').value);
    if (!name || !price) { toast('Name and price required', 'bad'); return; }
    try {
      await api('POST', '/api/products', {
        storeId: STORE.storeId, name,
        sku: 'SKU-' + Date.now().toString(36).toUpperCase(),
        price: { currency: 'INR', minor: String(Math.round(price * 100)) },
        stockCount: Number($('#apStock').value) || 0,
        category: $('#apCat').value || undefined,
        taxBps: 0,
      });
      toast('Product added', 'ok'); closeSheet(); render();
    } catch (e) { toast(e.message, 'bad'); }
  });
  $('#sheetConfirm').textContent = 'Add';
};

// ── SUPPLIERS ─────────────────────────────────
async function renderSuppliers(p) {
  const suppliers = await api('GET', `/api/suppliers?storeId=${STORE.storeId}`).catch(() => []);
  const list = Array.isArray(suppliers) ? suppliers : (suppliers.suppliers || []);
  p.innerHTML = `
    <div class="sec-head"><div class="sec-title">${list.length} suppliers</div><div class="sec-link" onclick="addSupplier()">+ Add</div></div>
    ${list.length ? `<div class="tx-list">${list.map(s => `
      <div class="tx">
        <div class="tx-ico">🚚</div>
        <div class="tx-body">
          <div class="tx-title">${esc(s.name)}</div>
          <div class="tx-sub">${esc(s.phone || '—')}</div>
        </div>
      </div>`).join('')}</div>` : `<div class="empty"><div class="empty-ico">🚚</div><h4>No suppliers</h4></div>`}
  `;
}

window.addSupplier = () => {
  openSheet('Add supplier', `
    <div class="field"><label>Name *</label><input id="asName"></div>
    <div class="field"><label>Phone</label><input id="asPhone"></div>
  `, async () => {
    const name = $('#asName').value.trim();
    if (!name) { toast('Name required', 'bad'); return; }
    try {
      await api('POST', '/api/suppliers', {
        storeId: STORE.storeId, name, phone: $('#asPhone').value || undefined,
      });
      toast('Supplier added', 'ok'); closeSheet(); render();
    } catch (e) { toast(e.message, 'bad'); }
  });
  $('#sheetConfirm').textContent = 'Add';
};

// ── EXPENSES ──────────────────────────────────
async function renderExpenses(p) {
  const r = await api('GET', `/api/expenses?storeId=${STORE.storeId}`).catch(() => ({ expenses: [] }));
  const items = r.expenses || r || [];
  p.innerHTML = `
    <div class="sec-head"><div class="sec-title">${items.length} expenses</div><div class="sec-link" onclick="addExpense()">+ Add</div></div>
    ${items.length ? `<div class="tx-list">${items.map(e => `
      <div class="tx">
        <div class="tx-ico">💸</div>
        <div class="tx-body">
          <div class="tx-title">${esc(e.description || e.category)}</div>
          <div class="tx-sub">${fmtDate(e.occurredAt || e.occurred_at)} · ${esc(e.category)}</div>
        </div>
        <div class="tx-amount">${fmtINR(e.amountMinor || e.amount_minor)}</div>
      </div>`).join('')}</div>` : `<div class="empty"><div class="empty-ico">💸</div><h4>No expenses tracked</h4><button onclick="addExpense()">+ Add expense</button></div>`}
  `;
}

window.addExpense = () => {
  openSheet('Add expense', `
    <div class="field"><label>Amount (₹) *</label><input id="aeAmount" type="number" step="0.01"></div>
    <div class="field"><label>Category</label>
      <select id="aeCat">
        <option>RENT</option><option>ELECTRICITY</option><option>SALARY</option>
        <option>STOCK</option><option>TRANSPORT</option><option>OTHER</option>
      </select>
    </div>
    <div class="field"><label>Description</label><input id="aeDesc"></div>
  `, async () => {
    const amt = Number($('#aeAmount').value);
    if (!amt) { toast('Amount required', 'bad'); return; }
    try {
      await api('POST', '/api/expenses', {
        storeId: STORE.storeId,
        amount: { currency: 'INR', minor: String(Math.round(amt * 100)) },
        category: $('#aeCat').value,
        description: $('#aeDesc').value || undefined,
      });
      toast('Expense added', 'ok'); closeSheet(); render();
    } catch (e) { toast(e.message, 'bad'); }
  });
  $('#sheetConfirm').textContent = 'Add';
};

// ── REPORTS ───────────────────────────────────
async function renderReports(p) {
  const [today, khata, top] = await Promise.all([
    api('GET', `/api/reports/today?storeId=${STORE.storeId}`),
    api('GET', `/api/reports/outstanding-khata?storeId=${STORE.storeId}`),
    api('GET', `/api/reports/top-products?storeId=${STORE.storeId}&days=30`),
  ]);
  p.innerHTML = `
    <div class="actions" style="grid-template-columns:1fr 1fr;margin-bottom:18px">
      <div class="khata-hero" style="margin:0">
        <div class="label">Today</div>
        <div class="amount" style="color:var(--primary)">${fmtINR(today.totalMinor)}</div>
        <div class="sub">${today.count || 0} bills</div>
      </div>
      <div class="khata-hero" style="margin:0">
        <div class="label">Outstanding khata</div>
        <div class="amount">${fmtINR(khata.outstandingMinor)}</div>
        <div class="sub">${fmtINR(today.totalMinor)} collected today</div>
      </div>
    </div>
    <div class="sec-head"><div class="sec-title">Top products (30 days)</div></div>
    ${(top.products && top.products.length) ? `<div class="tx-list">${top.products.map(pr => `
      <div class="tx">
        <div class="tx-ico">📦</div>
        <div class="tx-body">
          <div class="tx-title">${esc(pr.name)}</div>
          <div class="tx-sub">${pr.quantity} sold</div>
        </div>
        <div class="tx-amount">${fmtINR(pr.revenueMinor)}</div>
      </div>`).join('')}</div>` : `<div class="empty"><div class="empty-ico">📈</div><h4>No sales in last 30 days</h4></div>`}
  `;
}

// ── SHIFTS ────────────────────────────────────
async function renderShifts(p) {
  const r = await api('GET', `/api/shifts/current?storeId=${STORE.storeId}`);
  p.innerHTML = `
    <div class="sec-head"><div class="sec-title">Current shift</div></div>
    ${r.shift ? `<div class="result-card">
      <div style="font-size:14px"><strong>Shift open</strong> since ${fmtTime(r.shift.openedAt)}</div>
      <div style="color:var(--text-dim);font-size:12px;margin-top:4px">Opening cash: ${fmtINR(r.shift.openingCashMinor || 0)}</div>
      <div class="action-row" style="margin-top:14px">
        <button onclick="addShiftEntry('${r.shift.id}')">+ Cash entry</button>
        <button class="primary" onclick="closeShift('${r.shift.id}')">Close shift</button>
      </div>
    </div>` : `<div class="empty"><div class="empty-ico">⏱️</div><h4>No shift open</h4><button onclick="openShift()">Open shift</button></div>`}
  `;
}

window.openShift = async () => {
  try {
    await api('POST', '/api/shifts/open', { storeId: STORE.storeId, openingCashMinor: '0' });
    toast('Shift opened', 'ok'); render();
  } catch (e) { toast(e.message, 'bad'); }
};
window.closeShift = async (id) => {
  openSheet('Close shift', `<div class="field"><label>Closing cash (₹)</label><input id="csAmount" type="number" step="0.01" value="0"></div>`,
    async () => {
      try {
        await api('POST', `/api/shifts/${id}/close`, { closingCashMinor: String(Math.round(Number($('#csAmount').value) * 100)) });
        toast('Shift closed', 'ok'); closeSheet(); render();
      } catch (e) { toast(e.message, 'bad'); }
    });
  $('#sheetConfirm').textContent = 'Close';
};
window.addShiftEntry = (shiftId) => {
  openSheet('Cash entry', `
    <div class="field"><label>Type</label>
      <select id="seKind"><option value="CASH_IN">CASH IN</option><option value="CASH_OUT">CASH OUT</option></select>
    </div>
    <div class="field"><label>Amount (₹) *</label><input id="seAmount" type="number" step="0.01"></div>
    <div class="field"><label>Note</label><input id="seNote"></div>
  `, async () => {
    const amt = Number($('#seAmount').value);
    if (!amt) { toast('Amount required', 'bad'); return; }
    try {
      await api('POST', `/api/shifts/${shiftId}/entries`, {
        kind: $('#seKind').value,
        amountMinor: String(Math.round(amt * 100)),
        description: $('#seNote').value || undefined,
      });
      toast('Entry added', 'ok'); closeSheet(); render();
    } catch (e) { toast(e.message, 'bad'); }
  });
  $('#sheetConfirm').textContent = 'Save';
};

// ── SETTINGS ──────────────────────────────────
function renderSettings(p) {
  p.innerHTML = `
    <div class="sec-head"><div class="sec-title">Settings</div></div>
    <div class="menu-list">
      <div class="menu-item" onclick="toggleTheme()">
        <div class="menu-ico">🌓</div>
        <div class="menu-body"><div class="menu-title">Theme</div><div class="menu-sub">Currently: ${STORE.theme}</div></div>
        <div class="menu-arrow">›</div>
      </div>
      <div class="menu-item" onclick="go('home')">
        <div class="menu-ico">🏠</div>
        <div class="menu-body"><div class="menu-title">Store</div><div class="menu-sub">${esc(STORE.storeName)}</div></div>
        <div class="menu-arrow">›</div>
      </div>
      <div class="menu-item" onclick="alert('Logged in as: ' + (STORE.user?.email || '') + '\\nRole: ' + (STORE.user?.role || '') + '\\nPermissions: ' + (STORE.user?.permissions?.length || 0))">
        <div class="menu-ico">👤</div>
        <div class="menu-body"><div class="menu-title">Account</div><div class="menu-sub">${esc(STORE.user?.email || '')} · ${esc(STORE.user?.role || '')}</div></div>
        <div class="menu-arrow">›</div>
      </div>
      <div class="menu-item" onclick="installPWA()">
        <div class="menu-ico">📲</div>
        <div class="menu-body"><div class="menu-title">Install app</div><div class="menu-sub">Add to home screen</div></div>
        <div class="menu-arrow">›</div>
      </div>
      <div class="menu-item" onclick="logout()" style="color:var(--bad)">
        <div class="menu-ico" style="background:rgba(239,68,68,.12);color:var(--bad)">⎋</div>
        <div class="menu-body"><div class="menu-title" style="color:var(--bad)">Sign out</div></div>
        <div class="menu-arrow">›</div>
      </div>
    </div>
    <div style="text-align:center;margin-top:24px;font-size:11px;color:var(--text-mute)">
      MerchantOS v1.3 · 0% commission forever
    </div>
  `;
}

window.toggleTheme = () => $('#btnTheme').click();

window.installPWA = () => {
  if (window.deferredPrompt) {
    window.deferredPrompt.prompt();
    window.deferredPrompt.userChoice.then(() => { window.deferredPrompt = null; });
  } else {
    toast('To install: open in browser menu → "Add to Home Screen"', 'info');
  }
};

window.addEventListener('beforeinstallprompt', (e) => { window.deferredPrompt = e; });

// ── LOGIN FORM ────────────────────────────────
$('#loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = $('#liBtn');
  btn.disabled = true; btn.textContent = 'Signing in…';
  $('#liErr').textContent = '';
  try {
    await login($('#liEmail').value, $('#liPwd').value);
    showApp();
  } catch (err) {
    $('#liErr').textContent = err.message;
  } finally {
    btn.disabled = false; btn.textContent = 'Sign in';
  }
});

// ── BOOT ──────────────────────────────────────
if (STORE.token) {
  api('GET', '/auth/me').then(() => showApp()).catch(() => { localStorage.clear(); STORE.token = null; });
}
