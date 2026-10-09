// Global auth guard. JWT (HS256) verified, sets req.auth, opt-in @Public to bypass.
import { CanActivate, ExecutionContext, Injectable, SetMetadata, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { loadConfig } from '../config/config.js';
import { ROLE_PERMISSIONS, type AuthContext, type Role } from '@merchantos/shared-types';
import { query } from '../db/db.js';

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
      if ((payload as any).typ !== 'access') throw new UnauthorizedException('not an access token');
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
      return true;
    } catch {
      throw new UnauthorizedException('invalid token');
    }
  }
}
