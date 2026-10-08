// Expenses: list + create. Store membership enforced.
import { Body, Controller, Get, Post, Query, Req, UseGuards, BadRequestException } from '@nestjs/common';
import { ulid } from '@merchantos/crypto';
import { PERMISSIONS } from '@merchantos/shared-types';
import { query } from '../db/db.js';
import { AuthGuard } from '../auth/auth.guard.js';
import { Permissions, PermissionsGuard } from '../rbac/rbac.guard.js';
import { assertStoreAccess } from '../rbac/store-access.js';
import { Audit } from '../audit/audit.service.js';
import { CreateExpenseInput } from '@merchantos/validation';

@Controller('api/expenses')
@UseGuards(AuthGuard, PermissionsGuard)
export class ExpenseController {
  private audit = new Audit();

  @Get()
  @Permissions(PERMISSIONS.EXPENSES_VIEW)
  async list(@Req() req: any, @Query('storeId') storeId: string) {
    if (!storeId) throw new BadRequestException('storeId required');
    await assertStoreAccess(req.auth, storeId);
    const r = await query(
      `SELECT id, category, amount_minor, currency, description, vendor, paid_at, created_at
         FROM expenses WHERE merchant_id = $1 AND store_id = $2 ORDER BY paid_at DESC LIMIT 200`,
      [req.auth.merchantId, storeId]);
    return { expenses: r.rows.map(e => ({ id: e.id, category: e.category, amountMinor: e.amount_minor,
      currency: e.currency, description: e.description, vendor: e.vendor, paidAt: e.paid_at, createdAt: e.created_at })) };
  }

  @Post()
  @Permissions(PERMISSIONS.EXPENSES_CREATE)
  async create(@Req() req: any, @Body() body: unknown) {
    const p = CreateExpenseInput.parse(body);
    await assertStoreAccess(req.auth, p.storeId);
    const id = ulid();
    await query(
      `INSERT INTO expenses (id, merchant_id, store_id, category, amount_minor, currency, description, vendor, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [id, req.auth.merchantId, p.storeId, p.category, p.amount.minor, p.amount.currency, p.description, p.vendor ?? null, req.auth.userId]);
    await this.audit.write({ merchantId: req.auth.merchantId, storeId: p.storeId, actorUserId: req.auth.userId,
      action: 'expense.create', targetType: 'expense', targetId: id, requestId: req.id, ip: req.ip,
      metadata: { amountMinor: p.amount.minor, category: p.category } });
    return { id };
  }
}
