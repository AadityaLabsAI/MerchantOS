// Structured request logger. X-Request-Id propagation.
import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { randomUUID } from 'node:crypto';
import { loadConfig } from '../config/config.js';

@Injectable()
export class RequestLoggerInterceptor implements NestInterceptor {
  intercept(ctx: ExecutionContext, next: CallHandler): Observable<any> {
    const cfg = loadConfig();
    if (cfg.LOG_LEVEL === 'error') return next.handle();
    const http = ctx.switchToHttp();
    const req = http.getRequest();
    const res = http.getResponse();
    const start = Date.now();
    const requestId = req.headers['x-request-id'] || randomUUID();
    req.id = requestId;
    if (typeof res.setHeader === 'function') res.setHeader('X-Request-Id', requestId);
    else if (typeof res.header === 'function') res.header('X-Request-Id', requestId);
    return next.handle().pipe(tap({ next: () => log(req, res, start, requestId, false), error: () => log(req, res, start, requestId, true) }));
  }
}

function log(req: any, res: any, start: number, requestId: string, error: boolean): void {
  console.log(JSON.stringify({
    ts: new Date().toISOString(),
    level: error ? 'error' : 'info',
    method: req.method,
    path: req.path ?? req.url,
    status: res.statusCode,
    durationMs: Date.now() - start,
    requestId,
    userId: req.auth?.userId,
    merchantId: req.auth?.merchantId,
  }));
}
