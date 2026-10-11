#!/usr/bin/env node
/**
 * MerchantOS — single-command boot.
 *
 * Brings the entire stack up from a clean checkout:
 *   1. Installs PostgreSQL if missing
 *   2. Creates the merchantos database and role
 *   3. Installs Node deps for all packages, api, and web
 *   4. Builds all packages, the api, and the web SPA
 *   5. Copies web assets into the api/landing directory
 *   6. Applies all migrations
 *   7. Seeds demo data (1 merchant, 2 stores, 4 products, 1 customer)
 *   8. Creates the OWNER user
 *   9. Writes a working .env.development
 *  10. Starts the API on port 3000
 *
 * Usage: node bin/boot.cjs [--no-start] [--port=3000]
 *   --no-start  set up the environment but do not launch the API
 *   --port=N    port to listen on (default 3000)
 *
 * Idempotent: re-running on a working install only re-builds the api.
 * Safe to run on a fresh Ubuntu/Debian VM/container as a non-root user with sudo.
 */
const { execSync, spawn } = require('node:child_process');
const { existsSync, readFileSync, readdirSync, writeFileSync, statSync } = require('node:fs');
const { join, resolve } = require('node:path');

const REPO_ROOT = resolve(__dirname, '..');
const API_DIR = join(REPO_ROOT, 'api');
const WEB_DIR = join(REPO_ROOT, 'web');
const PKG_DIR = join(REPO_ROOT, 'packages');

const args = process.argv.slice(2);
const noStart = args.includes('--no-start');
const portArg = args.find(a => a.startsWith('--port='));
const PORT = portArg ? Number(portArg.split('=')[1]) : 3000;

const SUDO = process.getuid && process.getuid() !== 0 ? 'sudo' : '';

const run = (cmd, opts = {}) => {
  console.log('\n$ ' + cmd);
  try {
    execSync(cmd, { stdio: 'inherit', cwd: opts.cwd || REPO_ROOT, ...opts });
  } catch (e) {
    if (opts.ignoreError) return;
    console.error('FAILED: ' + cmd);
    process.exit(1);
  }
};

const whichOk = (bin) => { try { execSync('which ' + bin, { stdio: 'ignore' }); return true; } catch { return false; } };

console.log('\n=== MerchantOS boot ===');
console.log('Repo root:', REPO_ROOT);
console.log('Port:', PORT);
console.log('===========================');

// 1. PostgreSQL
if (!whichOk('psql')) {
  console.log('\n[1/10] Installing PostgreSQL...');
  run(`${SUDO} apt-get update`, { ignoreError: true });
  run(`${SUDO} apt-get install -y postgresql postgresql-client`);
} else {
  console.log('\n[1/10] PostgreSQL already installed');
}
run(`${SUDO} pg_ctlcluster 15 main start || true`);

// 2. Database
console.log('\n[2/10] Creating database + role');
run(`${SUDO} -u postgres psql -c "CREATE USER merchantos WITH PASSWORD 'merchantos' SUPERUSER;" || true`);
run(`${SUDO} -u postgres psql -c "CREATE DATABASE merchantos OWNER merchantos;" || true`);
const dbUrl = 'postgresql://merchantos:merchantos@127.0.0.1:5432/merchantos';

// 3. Deps
console.log('\n[3/10] Installing node dependencies');
for (const pkg of readdirSync(PKG_DIR)) {
  const d = join(PKG_DIR, pkg);
  if (statSync(d).isDirectory() && existsSync(join(d, 'package.json'))) {
    console.log('  packages/' + pkg);
    run('npm install --no-audit --no-fund', { cwd: d });
  }
}
run('npm install --no-audit --no-fund', { cwd: API_DIR });
run('npm install --no-audit --no-fund', { cwd: WEB_DIR });

// 4. Build
console.log('\n[4/10] Building packages + api + web');
for (const pkg of readdirSync(PKG_DIR)) {
  const d = join(PKG_DIR, pkg);
  if (statSync(d).isDirectory() && existsSync(join(d, 'package.json'))) {
    run('npm run build', { cwd: d });
  }
}
run('npm run build', { cwd: API_DIR });
run('npm run build', { cwd: WEB_DIR });

// 5. Copy web assets
console.log('\n[5/10] Copying web assets into api/landing');
run('cp web/dist/app.js api/src/landing/spa_app.js');
run('cp web/dist/app.css api/src/landing/spa_app.css');
run('cp web/dist/index.html api/src/landing/spa_index.html');
const iconPath = join(API_DIR, 'src/landing/icon.svg');
if (!existsSync(iconPath)) {
  console.log('  writing icon.svg');
  writeFileSync(iconPath,
    '<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 192">\n  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1E3A8A"/><stop offset="1" stop-color="#FF6B1A"/></linearGradient></defs>\n  <rect width="192" height="192" rx="42" fill="url(#g)"/>\n  <text x="96" y="130" font-size="110" text-anchor="middle" fill="white" font-family="sans-serif" font-weight="800">M</text>\n</svg>\n');
}

// 6. Rebuild api (with assets)
console.log('\n[6/10] Rebuilding api with SPA assets');
run('npm run build', { cwd: API_DIR });

// 7. Migrations
console.log('\n[7/10] Applying migrations');
run(`DATABASE_URL="${dbUrl}" NODE_PATH=./node_modules node ../bin/dev/apply-migrations.cjs`, { cwd: API_DIR });

// 8. Seed
console.log('\n[8/10] Seeding demo data');
const seedSql = readFileSync(join(REPO_ROOT, 'bin/seed'), 'utf8');
const sqlStart = seedSql.indexOf("<<'SQL'") + "<<'SQL'".length;
const sqlEnd = seedSql.indexOf('\nSQL', sqlStart);
const seed = seedSql.substring(sqlStart, sqlEnd);
const seedFile = '/tmp/merchantos-seed.sql';
writeFileSync(seedFile, seed);
run(`PGPASSWORD=merchantos psql -h 127.0.0.1 -U merchantos -d merchantos -v ON_ERROR_STOP=1 -f ${seedFile}`, { ignoreError: true });

// 9. Create user
console.log('\n[9/10] Creating OWNER user');
run(`DATABASE_URL="${dbUrl}" NODE_PATH=./node_modules node ../bin/create-user.js owner@merchantos.local 'OwnerPass123!' OWNER 01H0000000000000000000001`, { cwd: API_DIR, ignoreError: true });

// 10. .env
const envPath = join(API_DIR, '.env.development');
const env = `NODE_ENV=development
PORT=${PORT}
DATABASE_URL=${dbUrl}
JWT_ACCESS_SECRET=dev-jwt-access-secret-1234567890abcdef1234567890abcdef
JWT_REFRESH_SECRET=dev-jwt-refresh-secret-1234567890abcdef1234567890abcdef
JWT_ACCESS_TTL=15m
JWT_REFRESH_TTL=30d
WEBHOOK_HMAC_SECRET=dev-webhook-secret-1234567890abcdef1234567890abcdef
API_BASE_URL=http://127.0.0.1:${PORT}
WEB_BASE_URL=http://127.0.0.1:${PORT}
WEB_ORIGIN=http://127.0.0.1:${PORT}
CORS_ORIGINS=http://127.0.0.1:${PORT}
ENABLE_PAYMENT_SIMULATOR=true
AI_ENABLED=false
SEED_USER_EMAIL=owner@merchantos.local
SEED_USER_PASSWORD=OwnerPass123!
SEED_USER_NAME=Owner
`;
writeFileSync(envPath, env);
console.log('\n[10/10] Wrote ' + envPath);

console.log('\n=== MerchantOS ready ===');
console.log('  API:    http://127.0.0.1:' + PORT);
console.log('  Login:  owner@merchantos.local / OwnerPass123!');
console.log('  Store:  01H0000000000000000000001 (Main Street Outlet)');
console.log('  Smoke:  node bin/smoke-test.cjs');
console.log('===========================\n');

if (noStart) {
  console.log('(--no-start: skipping launch)');
  process.exit(0);
}

// Start API
console.log('Starting API...');
const child = spawn('node', ['dist/main.js'], {
  cwd: API_DIR,
  stdio: 'inherit',
  env: { ...process.env, ...Object.fromEntries(env.split('\n').filter(l => l.includes('=')).map(l => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1)]; })) },
});
process.on('SIGINT', () => { child.kill('SIGTERM'); process.exit(0); });
process.on('SIGTERM', () => { child.kill('SIGTERM'); process.exit(0); });
child.on('exit', (code) => process.exit(code || 0));
