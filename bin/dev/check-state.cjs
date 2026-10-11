
const { Client } = require('pg');
const c = new Client({ connectionString: 'postgres://merchantos:merchantos@127.0.0.1:5432/merchantos' });
(async () => {
  await c.connect();
  console.log('--- Product stock ---');
  const p = await c.query("SELECT name, stock_count FROM products");
  console.log(JSON.stringify(p.rows, null, 2));
  console.log();
  console.log('--- Stock movements ---');
  const m = await c.query("SELECT type, quantity, notes FROM stock_movements ORDER BY created_at DESC LIMIT 5");
  console.log(JSON.stringify(m.rows, null, 2));
  console.log();
  console.log('--- Customer ledger (all rows) ---');
  const l = await c.query("SELECT * FROM customer_ledger_entries");
  console.log(JSON.stringify(l.rows, null, 2));
  console.log();
  console.log('--- Bills ---');
  const b = await c.query("SELECT id, state, total_minor, currency FROM bills");
  console.log(JSON.stringify(b.rows, null, 2));
  await c.end();
})();
