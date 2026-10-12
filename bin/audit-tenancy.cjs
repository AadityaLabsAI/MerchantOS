#!/usr/bin/env node
/**
 * Audit tenancy: every query() call that touches a tenant-scoped table must
 * include a `WHERE merchant_id` clause (or be in a context where one has
 * already been verified).
 */
const { readFileSync, readdirSync, statSync } = require('node:fs');
const { join } = require('node:path');

const TENANT_TABLES = new Set([
  'merchants', 'stores', 'users', 'products', 'customers', 'customer_ledger_entries',
  'bills', 'bill_items', 'stock_movements', 'suppliers', 'supplier_purchases',
  'supplier_purchase_items', 'shifts', 'shift_entries', 'payment_sessions',
  'payments', 'payment_events', 'expenses', 'audit_log', 'notification_events',
  'ai_conversations', 'ai_messages', 'refresh_tokens', 'devices',
  'store_memberships',
]);

const ALLOW_NO_MERCHANT = new Set(['refresh_tokens', 'idempotency_keys']);

function walk(dir) {
  const out = [];
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    const s = statSync(p);
    if (s.isDirectory()) out.push(...walk(p));
    else if (f.endsWith('.ts') && !f.endsWith('.test.ts') && !f.endsWith('.d.ts')) out.push(p);
  }
  return out;
}

const cwd = process.cwd();
const src = cwd.endsWith('/api') ? join(cwd, 'src') : join(cwd, 'api', 'src');
if (!require('node:fs').existsSync(src)) { console.error('src not found: ' + src); process.exit(2); }
const files = walk(src);

const issues = [];
for (const f of files) {
  const content = readFileSync(f, 'utf8');
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!/\b(query|c\.query)\s*\(/.test(line)) continue;
    let sqlSnippet = line;
    if (line.match(/`/) && !line.match(/`[^`]*`/)) {
      for (let j = i + 1; j < lines.length; j++) {
        sqlSnippet += '\n' + lines[j];
        if (lines[j].match(/`/)) break;
      }
    }
    const tableMatches = sqlSnippet.match(/\b(SELECT|INSERT\s+INTO|UPDATE|DELETE\s+FROM)\s+("?\w+"?)/gi);
    if (!tableMatches) continue;
    const tablesTouched = new Set();
    for (const m of tableMatches) {
      const t = m.replace(/^(\w+\s+)?(INTO\s+)?(FROM\s+)?/i, '').replace(/"/g, '').trim();
      if (TENANT_TABLES.has(t)) tablesTouched.add(t);
    }
    if (tablesTouched.size === 0) continue;
    const hasMerchantScope = /\b(merchant_id|merchantId)\b/.test(sqlSnippet);
    const flagged = [...tablesTouched].filter(t => !ALLOW_NO_MERCHANT.has(t));
    if (flagged.length === 0) continue;
    if (!hasMerchantScope) {
      issues.push({
        file: f.replace(cwd + '/', ''),
        line: i + 1,
        tables: flagged,
        sql: sqlSnippet.trim().slice(0, 200),
      });
    }
  }
}

if (issues.length === 0) {
  console.log('OK: no suspicious queries found (all touch tenant tables with merchant_id)');
  process.exit(0);
}
console.log('SUSPICIOUS queries (need human review):\n');
for (const i of issues) {
  console.log(`  ${i.file}:${i.line}`);
  console.log(`    tables: ${i.tables.join(', ')}`);
  console.log(`    sql: ${i.sql}`);
  console.log();
}
console.log(`${issues.length} issue(s) flagged.`);
process.exit(1);
