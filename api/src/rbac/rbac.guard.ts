// RBAC: per-controller/per-method @Permissions decorator + PermissionsGuard.
import { CanActivate, ExecutionContext, ForbiddenException, Injectable, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Permission } from '@merchantos/shared-types';

export const PERMISSIONS_KEY = 'permissions';
export const Permissions = (...perms: Permission[]) => SetMetadata(PERMISSIONS_KEY, perms);

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private reflector: Reflector) {}
  canActivate(ctx: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Permission[]>(PERMISSIONS_KEY, [ctx.getHandler(), ctx.getClass()]);
    if (!required || required.length === 0) return true;
    const req = ctx.switchToHttp().getRequest();
    const have: Permission[] = req.auth?.permissions ?? req.tenant?.permissions ?? [];
    if (required.some(p => have.includes(p))) return true;
    throw new ForbiddenException(`missing one of: ${required.join(', ')}`);
  }
}
