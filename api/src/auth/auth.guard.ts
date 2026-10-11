// Global auth guard. JWT (HS256) verified, sets req.auth, opt-in @Public to bypass.
import { CanActivate, ExecutionContext, HttpException, Injectable, SetMetadata, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { loadConfig } from '../config/config.js';
import { ROLE_PERMISSIONS, type AuthContext, type Role } from '@merchantos/shared-types';
import { query } from '../db/db.js';
import type {} from 'fastify';

export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

declare module 'fastify' {
  interface FastifyRequest { auth?: AuthContext; tenant?: AuthContext; }
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private reflector: Reflector, private jwt: JwtService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [ctx.getHandler(), ctx.getClass()]);
    if (isPublic) return true;
    const req = ctx.switchToHttp().getRequest();
    const header = req.headers?.authorization;
    if (!header?.startsWith('Bearer ')) throw new UnauthorizedException('missing bearer token');
    const token = header.slice('Bearer '.length);
    try {
      const cfg = loadConfig();
      const payload = await this.jwt.verifyAsync(token, { secret: cfg.JWT_ACCESS_SECRET, algorithms: ['HS256'] });
      if ((payload as any).typ !== 'access') { console.log('[auth] token typ is ' + (payload as any).typ + ' (expected access)'); throw new UnauthorizedException('not an access token'); }
        const userId = typeof (payload as any).sub === 'string' ? (payload as any).sub : '';
      const merchantId = typeof (payload as any).merchantId === 'string' ? (payload as any).merchantId : '';
      const storeId = typeof (payload as any).storeId === 'string' ? (payload as any).storeId : '';
      if (!userId || !merchantId || !storeId) throw new UnauthorizedException('token missing required tenant context');

      // Resolve authorization from current database state, not stale JWT role/permissions.
      const live = await query<{ id: string; merchant_id: string; role: string }>(
        `SELECT u.id, u.merchant_id, sm.role
           FROM users u
           JOIN store_memberships sm
             ON sm.user_id = u.id AND sm.merchant_id = u.merchant_id AND sm.store_id = $3
          WHERE u.id = $1 AND u.merchant_id = $2 AND u.is_active = true
          LIMIT 1`,
        [userId, merchantId, storeId],
      );
      if (!live.rows[0]) throw new UnauthorizedException('account inactive or store access revoked');
      const role = live.rows[0].role as Role;
      const permissions = ROLE_PERMISSIONS[role];
      if (!permissions) throw new UnauthorizedException('invalid current role');
      const a: AuthContext = {
        userId: live.rows[0].id,
        merchantId: live.rows[0].merchant_id,
        storeId,
        role,
        permissions,
      };
      req.auth = a;
      req.tenant = a;  // back-compat

      // Idempotency: if a key is present and a prior successful response exists,
      // short-circuit and replay. The actual handler does not run.
      const idemKey = ((req.headers as any)?.['idempotency-key'] || '').toString();
      if (idemKey) {
        if (!/^[A-Za-z0-9_-]{8,128}$/.test(idemKey)) {
          throw new UnauthorizedException({ code: 'BAD_IDEMPOTENCY_KEY', message: 'Idempotency-Key must be 8-128 chars of [A-Za-z0-9_-]' });
        }
        const crypto = require('node:crypto');
        const bodyHash = crypto.createHash('sha256').update(JSON.stringify(req.body || {})).digest('hex');
        const prior = await query<{ response_status: number; response_body: any; request_hash: string }>(
          `SELECT response_status, response_body, request_hash
             FROM idempotency_keys
            WHERE key = $1 AND merchant_id = $2 AND endpoint = $3
              AND expires_at > now()
            LIMIT 1`,
          [idemKey, a.merchantId, req.url]
        );
        const p = prior.rows[0];
        if (p) {
          if (p.request_hash !== bodyHash) {
            throw new UnauthorizedException({ code: 'IDEMPOTENCY_KEY_REUSED', message: 'Idempotency-Key was used previously with a different request body' });
          }
          // Replay: write the cached response directly via the Fastify reply.
          // canActivate returning false tells Nest not to invoke the handler.
          const res = ctx.switchToHttp().getResponse();
          res.code(p.response_status);
          res.send(p.response_body);
          return false;
        }
        // No prior; record metadata for the response interceptor to store.
        (req as any)._idempotency = { key: idemKey, bodyHash, endpoint: req.url, merchantId: a.merchantId, storeId: a.storeId };
      }
      return true;
    } catch (err) {
      if (err instanceof HttpException) throw err;
      throw new UnauthorizedException('invalid token');
    }
  }
}
