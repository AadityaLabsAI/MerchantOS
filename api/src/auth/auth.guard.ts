// Global auth guard. JWT (HS256) verified, sets req.auth, opt-in @Public to bypass.
import { CanActivate, ExecutionContext, Injectable, SetMetadata, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { loadConfig } from '../config/config.js';
import type { AuthContext } from '@merchantos/shared-types';

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
      const payload = await this.jwt.verifyAsync(token, { secret: cfg.JWT_ACCESS_SECRET });
      if ((payload as any).typ !== 'access') throw new UnauthorizedException('not an access token');
      const a: AuthContext = {
        userId: payload.sub,
        merchantId: payload.merchantId,
        storeId: payload.storeId ?? null,
        role: payload.role,
        permissions: payload.permissions ?? [],
      };
      req.auth = a;
      req.tenant = a;  // back-compat
      return true;
    } catch {
      throw new UnauthorizedException('invalid token');
    }
  }
}
