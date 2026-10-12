// Idempotency as a NestJS middleware (runs after auth, before handler).
// Apply in AppModule via configure(consumer) so it runs on every /api/* and /auth/* route.

import { Injectable, NestMiddleware, HttpException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { query } from '../db/db.js';

const HEADER = 'idempotency-key';
const KEY_RE = /^[A-Za-z0-9_-]{8,128}$/;

@Injectable()
export class IdempotencyMiddleware implements NestMiddleware {
  async use(req: Request & { auth?: any }, res: Response, next: NextFunction) {
    // eslint-disable-next-line no-console
    console.log('[idempotency] middleware called:', req.method, 'url=', req.url, 'originalUrl=', req.originalUrl, 'auth=', JSON.stringify(req.auth || null).slice(0,80), 'key=', (req.headers as any)?.['idempotency-key'] || 'NONE');
    const method = req.method;
    if (method === 'GET' || method === 'OPTIONS' || method === 'HEAD') return next();
    const url = req.originalUrl || req.url || '';
    if (!url.startsWith('/api/') && !url.startsWith('/auth/')) return next();

    const key = ((req.headers as any)?.[HEADER] || '').toString();
    if (!key) return next();
    if (!KEY_RE.test(key)) {
      return next(new HttpException({ code: 'BAD_IDEMPOTENCY_KEY', message: 'Idempotency-Key must be 8-128 chars of [A-Za-z0-9_-]' }, 400));
    }

    const merchantId = req?.auth?.merchantId;
    const storeId = req?.auth?.storeId;
    if (!merchantId || !storeId) {
      // Auth hasn't populated yet, OR this is an unauthenticated endpoint.
      // For unauthenticated (login/register), still allow idempotency once we know merchant.
      // We can defer the merchant lookup to the response store phase.
    }

    const bodyHash = hashRequestBody(req.body);
    (req as any)._idempotency = { key, bodyHash, endpoint: url, merchantId, storeId };

    // Prior lookup only if we have merchant context.
    if (merchantId) {
      const prior = await query<{ response_status: number; response_body: any; request_hash: string }>(
        `SELECT response_status, response_body, request_hash
           FROM idempotency_keys
          WHERE key = $1 AND merchant_id = $2 AND endpoint = $3
            AND expires_at > now()
          LIMIT 1`,
        [key, merchantId, url]
      );
      const p = prior.rows[0];
      if (p) {
        if (p.request_hash !== bodyHash) {
          return next(new HttpException({ code: 'IDEMPOTENCY_KEY_REUSED', message: 'Idempotency-Key was used previously with a different request body' }, 409));
        }
        res.status(p.response_status).json(p.response_body);
        return;
      }
    }
    next();
  }
}

// Express response interceptor: store successful responses for future replays.
export function attachIdempotencyStorage(res: Response, req: any) {
  const meta = (req as any)._idempotency;
  if (!meta) return;
  const originalJson = res.json.bind(res);
  res.json = (body: any) => {
    const status = res.statusCode || 200;
    if (status >= 200 && status < 300 && meta.merchantId && meta.storeId) {
      query(
        `INSERT INTO idempotency_keys (key, merchant_id, store_id, endpoint, request_hash, response_status, response_body, expires_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, now() + interval '24 hours')
         ON CONFLICT (key) DO NOTHING`,
        [meta.key, meta.merchantId, meta.storeId, meta.endpoint, meta.bodyHash, status, JSON.stringify(body)]
      ).catch(() => { /* best-effort */ });
    }
    return originalJson(body);
  };
}

function hashRequestBody(body: any): string {
  const crypto = require('node:crypto');
  return crypto.createHash('sha256').update(JSON.stringify(body || {})).digest('hex');
}
