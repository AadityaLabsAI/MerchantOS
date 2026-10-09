// MerchantOS v1.3 — landing page
import { Controller, Get, Header } from '@nestjs/common';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
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

const INDEX_HTML = read('spa_index.html');
const APP_JS = read('spa_app.js');

@Controller()
export class LandingController {
  @Public()
  @Get()
  @Header('Content-Type', 'text/html; charset=utf-8')
  root() { return INDEX_HTML; }

  @Public()
  @Get('app.js')
  @Header('Content-Type', 'application/javascript; charset=utf-8')
  appJs() { return APP_JS; }

  @Public()
  @Get('manifest.json')
  @Header('Content-Type', 'application/manifest+json')
  manifest() {
    return JSON.stringify({
      name: 'MerchantOS — 0% commission',
      short_name: 'MerchantOS',
      description: 'Self-hosted POS, khata, and payments. 0% commission forever.',
      start_url: '/',
      display: 'standalone',
      background_color: '#ffffff',
      theme_color: '#6d28d9',
      orientation: 'portrait',
      icons: [
        { src: '/icon-192.png', sizes: '192x192', type: 'image/svg+xml', purpose: 'any maskable' },
        { src: '/icon-512.png', sizes: '512x512', type: 'image/svg+xml', purpose: 'any maskable' },
      ],
    });
  }

  @Public()
  @Get('sw.js')
  @Header('Content-Type', 'application/javascript; charset=utf-8')
  serviceWorker() {
    return "// MerchantOS service worker\nconst CACHE='merchantos-v1';const SHELL=['/','/app.js','/manifest.json'];self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)).catch(()=>{}));self.skipWaiting();});self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))));self.clients.claim();});self.addEventListener('fetch',e=>{if(e.request.method!=='GET')return;const u=new URL(e.request.url);if(u.pathname.startsWith('/api/')||u.pathname.startsWith('/auth/')||u.pathname.startsWith('/pay/')||u.pathname==='/healthz')return;e.respondWith(fetch(e.request).then(r=>{const c=r.clone();caches.open(CACHE).then(ch=>ch.put(e.request,c)).catch(()=>{});return r;}).catch(()=>caches.match(e.request).then(r=>r||caches.match('/'))));});";
  }

  @Public()
  @Get('icon-192.png')
  @Header('Content-Type', 'image/svg+xml')
  icon192() { return '<?xml version="1.0" encoding="UTF-8"?><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 192"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#7c3aed"/><stop offset="1" stop-color="#ec4899"/></linearGradient></defs><rect width="192" height="192" rx="42" fill="url(#g)"/><text x="96" y="130" font-size="110" text-anchor="middle" fill="white" font-family="sans-serif" font-weight="800">M</text></svg>'; }

  @Public()
  @Get('icon-512.png')
  @Header('Content-Type', 'image/svg+xml')
  icon512() { return '<?xml version="1.0" encoding="UTF-8"?><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#7c3aed"/><stop offset="1" stop-color="#ec4899"/></linearGradient></defs><rect width="512" height="512" rx="112" fill="url(#g)"/><text x="256" y="350" font-size="300" text-anchor="middle" fill="white" font-family="sans-serif" font-weight="800">M</text></svg>'; }
}
