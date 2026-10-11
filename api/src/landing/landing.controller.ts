// MerchantOS v1.3.1 — landing + SPA shell
// Serves the Vite/esbuild-built React SPA from the landing directory.
// All unknown non-API routes fall back to index.html for client-side routing.
import { Controller, Get, Header, Req, Res, NotFoundException } from '@nestjs/common';
import type { Request } from 'express';
import { readFileSync, statSync, existsSync } from 'node:fs';
import { join, extname } from 'node:path';
import { Public } from '../auth/auth.guard.js';

function read(rel: string): string {
  const candidates = [
    join(process.cwd(), 'api', 'src', 'landing', rel),
    join(process.cwd(), 'src', 'landing', rel),
    join(__dirname, '..', '..', 'src', 'landing', rel),
    join(__dirname, '..', '..', '..', 'api', 'src', 'landing', rel),
  ];
  for (const p of candidates) {
    try { return readFileSync(p, 'utf8'); } catch {}
  }
  return '';
}

function readFileBuffer(rel: string): Buffer {
  const candidates = [
    join(process.cwd(), 'api', 'src', 'landing', rel),
    join(process.cwd(), 'src', 'landing', rel),
    join(__dirname, '..', '..', 'src', 'landing', rel),
    join(__dirname, '..', '..', '..', 'api', 'src', 'landing', rel),
  ];
  for (const p of candidates) {
    try { return readFileSync(p); } catch {}
  }
  return Buffer.from('');
}

const INDEX_HTML = read('spa_index.html');
const APP_JS = read('spa_app.js');
const APP_CSS = read('spa_app.css');

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.mjs':  'application/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg':  'image/svg+xml',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico':  'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf':  'font/ttf',
  '.map':  'application/json; charset=utf-8',
};

@Controller()
export class LandingController {
  @Public()
  @Get()
  @Header('Content-Type', 'text/html; charset=utf-8')
  @Header('Cache-Control', 'no-cache')
  root() { return INDEX_HTML; }

  @Public()
  @Get('app.js')
  @Header('Content-Type', 'application/javascript; charset=utf-8')
  @Header('Cache-Control', 'public, max-age=31536000, immutable')
  appJs() { return APP_JS; }

  @Public()
  @Get('app.css')
  @Header('Content-Type', 'text/css; charset=utf-8')
  @Header('Cache-Control', 'public, max-age=31536000, immutable')
  appCss() { return APP_CSS; }

  @Public()
  @Get('manifest.json')
  @Header('Content-Type', 'application/manifest+json')
  manifest() {
    return JSON.stringify({
      name: 'MerchantOS — 0% commission',
      short_name: 'MerchantOS',
      description: 'Self-hosted POS, khata, UPI & GST invoicing. 0% commission forever.',
      start_url: '/app',
      scope: '/app',
      display: 'standalone',
      background_color: '#ffffff',
      theme_color: '#1E3A8A',
      orientation: 'portrait',
      icons: [
        { src: '/icon-192.png', sizes: '192x192', type: 'image/svg+xml', purpose: 'any maskable' },
        { src: '/icon-512.png', sizes: '512x512', type: 'image/svg+xml', purpose: 'any maskable' },
      ],
    }, null, 2);
  }

  @Public()
  @Get('sw.js')
  @Header('Content-Type', 'application/javascript; charset=utf-8')
  serviceWorker() {
    return `// MerchantOS service worker
const CACHE = 'merchantos-v2';
const SHELL = ['/', '/app', '/app.js', '/app.css', '/manifest.json'];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL).catch(() => {})).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const u = new URL(e.request.url);
  if (u.pathname.startsWith('/api/') || u.pathname.startsWith('/auth/') || u.pathname.startsWith('/pay/') || u.pathname === '/healthz') return;
  e.respondWith(
    fetch(e.request).then((r) => {
      const c = r.clone();
      caches.open(CACHE).then((ch) => ch.put(e.request, c).catch(() => {})).catch(() => {});
      return r;
    }).catch(() => caches.match(e.request).then((r) => r || caches.match('/app')))
  );
});
`;
  }

  @Public()
  @Get('icon-192.png')
  @Header('Content-Type', 'image/svg+xml')
  @Header('Cache-Control', 'public, max-age=2592000')
  icon192() {
    return `<?xml version="1.0" encoding="UTF-8"?><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 192"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1E3A8A"/><stop offset="1" stop-color="#FF6B1A"/></linearGradient></defs><rect width="192" height="192" rx="42" fill="url(#g)"/><text x="96" y="130" font-size="110" text-anchor="middle" fill="white" font-family="sans-serif" font-weight="800">M</text></svg>`;
  }

  @Public()
  @Get('icon-512.png')
  @Header('Content-Type', 'image/svg+xml')
  @Header('Cache-Control', 'public, max-age=2592000')
  icon512() {
    return `<?xml version="1.0" encoding="UTF-8"?><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1E3A8A"/><stop offset="1" stop-color="#FF6B1A"/></linearGradient></defs><rect width="512" height="512" rx="112" fill="url(#g)"/><text x="256" y="350" font-size="300" text-anchor="middle" fill="white" font-family="sans-serif" font-weight="800">M</text></svg>`;
  }

  @Public()
  @Get('favicon.ico')
  @Header('Content-Type', 'image/svg+xml')
  favicon() { return this.icon192(); }

  // Catch-all for the React Router SPA: /app, /app/dashboard, /pay/:token, /login, etc.
  // Only routes that DON'T start with /api, /auth, /pay (which are real API routes) fall back.
  @Public()
  @Get('*')
  spa(@Req() req: Request, @Res() res: Response) {
    const url = req.url || '/';
    const path = url.split('?')[0];
    // Known asset roots we serve directly
    const ext = extname(path);
    if (ext && MIME[ext]) {
      // serve from dist if it exists
      const filename = path.startsWith('/') ? path.slice(1) : path;
      // search for the asset in the landing dir
      const candidates = [
        join(process.cwd(), 'api', 'src', 'landing', filename),
        join(process.cwd(), 'src', 'landing', filename),
        join(__dirname, '..', '..', 'src', 'landing', filename),
        join(__dirname, '..', '..', '..', 'api', 'src', 'landing', filename),
      ];
      for (const p of candidates) {
        if (existsSync(p) && statSync(p).isFile()) {
          const buf = readFileBuffer(filename);
          res.setHeader('Content-Type', MIME[ext] || 'application/octet-stream');
          res.setHeader('Cache-Control', 'public, max-age=2592000');
          res.send(buf);
          return;
        }
      }
    }
    // Otherwise return the SPA shell so the React Router can handle it client-side
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    res.send(INDEX_HTML);
  }
}
