// Idempotency response storage interceptor.
// The middleware (idempotency.nest-middleware) sets req._idempotency
// after looking up any prior response. If the request had a key AND no prior
// existed, the request proceeds here. We capture successful responses and
// store them so future requests with the same key replay the cached body.

import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { query } from '../db/db.js';

@Injectable()
export class IdempotencyStoreInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const http = context.switchToHttp();
    const req = http.getRequest();
    const res = http.getResponse();
    const meta = (req as any)._idempotency;
    if (!meta) return next.handle();
    return next.handle().pipe(
      tap(async (body) => {
        const status = res.statusCode || 200;
        if (status < 200 || status >= 300) return;
        if (!meta.merchantId || !meta.storeId) return;
        try {
          await query(
            `INSERT INTO idempotency_keys (key, merchant_id, store_id, endpoint, request_hash, response_status, response_body, expires_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, now() + interval '24 hours')
             ON CONFLICT (key) DO NOTHING`,
            [meta.key, meta.merchantId, meta.storeId, meta.endpoint, meta.bodyHash, status, JSON.stringify(body)]
          );
        } catch { /* best-effort */ }
      }),
    );
  }
}
