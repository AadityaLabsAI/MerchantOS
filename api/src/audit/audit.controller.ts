// Audit log read endpoint. Append-only writes happen via AuditService in other controllers.
import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { query } from '../db/db.js';
import { AuthGuard } from '../auth/auth.guard.js';
import { Permissions, PermissionsGuard } from '../rbac/rbac.guard.js';
import { PERMISSIONS } from '@merchantos/shared-types';
import { assertStoreAccess } from '../rbac/store-access.js';

const ListInput = z.object({
  storeId: z.string().min(1).optional(),
  actorUserId: z.string().min(1).optional(),
  action: z.string().min(1).optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(500).default(100),
  offset: z.coerce.number().int().min(0).default(0),
});

@Controller('api/audit')
@UseGuards(AuthGuard, PermissionsGuard)
export class AuditController {
  @Get()
  @Permissions(PERMISSIONS.AUDIT_VIEW)
  async list(@Req() req: any, @Query() q: any) {
    const p = ListInput.parse(q);
    if (p.storeId) await assertStoreAccess(req.auth, p.storeId);

    const where: string[] = ['merchant_id = $1'];
    const params: any[] = [req.auth.merchantId];
    if (p.storeId)     { params.push(p.storeId);     where.push(`store_id = $${params.length}`); }
    if (p.actorUserId) { params.push(p.actorUserId); where.push(`actor_user_id = $${params.length}`); }
    if (p.action)      { params.push(p.action);      where.push(`action = $${params.length}`); }
    if (p.from)        { params.push(p.from);        where.push(`created_at >= $${params.length}`); }
    if (p.to)          { params.push(p.to);          where.push(`created_at <= $${params.length}`); }
    params.push(p.limit, p.offset);

    const r = await query(
      `SELECT id, store_id, actor_user_id, action, target_type, target_id, request_id, ip, metadata, created_at
         FROM audit_log WHERE ${where.join(' AND ')}
         ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params);
    return {
      items: r.rows.map((row: any) => ({
        id: row.id,
        storeId: row.store_id,
        actorUserId: row.actor_user_id,
        action: row.action,
        targetType: row.target_type,
        targetId: row.target_id,
        requestId: row.request_id,
        ip: row.ip,
        metadata: row.metadata,
        createdAt: row.created_at,
      })),
      limit: p.limit, offset: p.offset,
    };
  }
}
