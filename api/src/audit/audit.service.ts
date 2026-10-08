// Append-only audit log. Best-effort writes (don't fail the request).
import { ulid } from '@merchantos/crypto';
import { query } from '../db/db.js';

export interface AuditEntry {
  merchantId: string;
  storeId?: string | null;
  actorUserId?: string | null;
  action: string;
  targetType: string;
  targetId?: string | null;
  requestId?: string | null;
  ip?: string | null;
  metadata?: Record<string, unknown>;
}

export class Audit {
  async write(e: AuditEntry): Promise<void> {
    try {
      await query(
        `INSERT INTO audit_log (id, merchant_id, store_id, actor_user_id, action, target_type, target_id, request_id, ip, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [ulid(), e.merchantId, e.storeId ?? null, e.actorUserId ?? null, e.action, e.targetType,
         e.targetId ?? null, e.requestId ?? null, e.ip ?? null, JSON.stringify(e.metadata ?? {})]);
    } catch (err) {
      console.error('[audit] write failed', (err as Error).message);
    }
  }
}
