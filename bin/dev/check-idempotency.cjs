
const { Client } = require('pg');
const c = new Client({ connectionString: 'postgres://merchantos:merchantos@127.0.0.1:5432/merchantos' });
(async () => {
  await c.connect();
  const key = process.env.KEY;
  if (!key) { console.error('KEY env var required'); process.exit(1); }
  const r = await c.query("SELECT count(*) as n FROM bills WHERE idempotency_key = $1", [key]);
  console.log('Bills with this key in DB: ' + r.rows[0].n);
  const i = await c.query("SELECT count(*) as n FROM idempotency_keys WHERE key = $1", [key]);
  console.log('idempotency_keys rows with this key: ' + i.rows[0].n);
  await c.end();
})();
