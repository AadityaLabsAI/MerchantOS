// Shifts: open, current, close, add entry. Store membership enforced.
import { Body, Controller, Get, Param, Post, Query, Req, UseGuards, NotFoundException, HttpException, BadRequestException } from '@nestjs/common';
import { z } from 'zod';
import { ulid } from '@merchantos/crypto';
import { MoneySchema } from '@merchantos/validation';
import { PERMISSIONS } from '@merchantos/shared-types';
import { query, withTx } from '../db/db.js';
import { AuthGuard } from '../auth/auth.guard.js';
import { Permissions, PermissionsGuard } from '../rbac/rbac.guard.js';
import { assertStoreAccess } from '../rbac/store-access.js';
import { Audit } from '../audit/audit.service.js';

const OpenInput = z.object({
  storeId: z.string().min(1).max(64),
  openingCash: MoneySchema.optional(),
});
const CloseInput = z.object({
  closingCash: MoneySchema,
  notes: z.string().max(500).optional(),
});
const EntryInput = z.object({
  type: z.string().min(1).max(50),
  amount: MoneySchema,
  description: z.string().max(200).optional(),
});

@Controller('api/shifts')
@UseGuards(AuthGuard, PermissionsGuard)
export class ShiftController {
  private audit = new Audit();

  @Get('current')
  @Permissions(PERMISSIONS.SHIFTS_VIEW)
  async current(@Req() req: any, @Query('storeId') storeId: string) {
    if (!storeId) throw new BadRequestException('storeId required');
    await assertStoreAccess(req.auth, storeId);
    // Only return shifts opened by THIS user, or all if OWNER.
    const r = await query(
      `SELECT * FROM shifts
        WHERE merchant_id = $1 AND store_id = $2 AND state = 'OPEN'
          AND ($3 = 'OWNER' OR opened_by = $4)
        ORDER BY opened_at DESC LIMIT 1`,
      [req.auth.merchantId, storeId, req.auth.role, req.auth.userId]);
    return { shift: r.rows[0] ? this.shape(r.rows[0]) : null };
  }

  @Post('open')
  @Permissions(PERMISSIONS.SHIFTS_MANAGE)
  async open(@Req() req: any, @Body() body: unknown) {
    const p = OpenInput.parse(body);
    await assertStoreAccess(req.auth, p.storeId);
    // Refuse to open a second shift for the same user+store.
    const existing = await query<{ id: string }>(
      `SELECT id FROM shifts WHERE merchant_id = $1 AND store_id = $2 AND state = 'OPEN' AND opened_by = $3`,
      [req.auth.merchantId, p.storeId, req.auth.userId]);
    if (existing.rows[0]) {
      throw new HttpException('you already have an open shift at this store; close it first', 409);
    }
    const id = ulid();
    const openingCash = p.openingCash?.minor ?? '0';
    const currency = p.openingCash?.currency ?? 'INR';
    await query(
      `INSERT INTO shifts (id, merchant_id, store_id, opened_by, opening_cash_minor, opening_cash_currency) VALUES ($1, $2, $3, $4, $5, $6)`,
      [id, req.auth.merchantId, p.storeId, req.auth.userId, openingCash, currency]);
    await this.audit.write({ merchantId: req.auth.merchantId, storeId: p.storeId, actorUserId: req.auth.userId,
      action: 'shift.open', targetType: 'shift', targetId: id, requestId: req.id, ip: req.ip });
    return { id };
  }

  @Post(':shiftId/close')
  @Permissions(PERMISSIONS.SHIFTS_MANAGE)
  async close(@Req() req: any, @Param('shiftId') shiftId: string, @Body() body: unknown) {
    const p = CloseInput.parse(body);
    let totalSalesMinor = '0';
    await withTx(async (c) => {
      const r = await c.query<{ store_id: string; opened_at: Date; opened_by: string }>(
        `SELECT store_id, opened_at, opened_by FROM shifts WHERE id = $1 AND merchant_id = $2 AND state = 'OPEN' FOR UPDATE`,
        [shiftId, req.auth.merchantId]);
      if (!r.rows[0]) throw new NotFoundException('no open shift');
      // Only OWNER or the shift opener may close it.
      if (req.auth.role !== 'OWNER' && r.rows[0].opened_by !== req.auth.userId) {
        throw new HttpException('only the opener or an OWNER can close this shift', 403);
      }
      const salesRes = await c.query<{ total: string }>(
        `SELECT COALESCE(SUM((p.amount_minor)::bigint), 0) AS total
           FROM payments p JOIN payment_sessions s ON s.id = p.payment_session_id
          WHERE s.store_id = $1 AND p.paid_at >= $2 AND p.paid_at < now()`,
        [r.rows[0].store_id, r.rows[0].opened_at]);
      totalSalesMinor = salesRes.rows[0].total.toString();
      await c.query(
        `UPDATE shifts SET state='CLOSED', closed_by=$1, closed_at=now(), closing_cash_minor=$2, closing_cash_currency=$3, notes=$4, total_sales_minor=$5, total_sales_currency=$3 WHERE id=$6`,
        [req.auth.userId, p.closingCash.minor, p.closingCash.currency, p.notes ?? null, totalSalesMinor, shiftId]);
    });
    await this.audit.write({ merchantId: req.auth.merchantId, actorUserId: req.auth.userId,
      action: 'shift.close', targetType: 'shift', targetId: shiftId, requestId: req.id, ip: req.ip,
      metadata: { totalSalesMinor } });
    return { id: shiftId, totalSalesMinor };
  }

  @Post(':shiftId/entries')
  @Permissions(PERMISSIONS.SHIFTS_MANAGE)
  async addEntry(@Req() req: any, @Param('shiftId') shiftId: string, @Body() body: unknown) {
    const p = EntryInput.parse(body);
    // Verify the shift exists and belongs to this merchant.
    const s = await query<{ store_id: string; state: string }>(
      `SELECT store_id, state FROM shifts WHERE id = $1 AND merchant_id = $2`, [shiftId, req.auth.merchantId]);
    if (!s.rows[0]) throw new NotFoundException();
    if (s.rows[0].state !== 'OPEN') throw new BadRequestException('shift is not open');
    await assertStoreAccess(req.auth, s.rows[0].store_id);
    await query(
      `INSERT INTO shift_entries (id, shift_id, type, amount_minor, currency, description) VALUES ($1, $2, $3, $4, $5, $6)`,
      [ulid(), shiftId, p.type, p.amount.minor, p.amount.currency, p.description ?? null]);
    return { ok: true };
  }

  private shape = (s: any) => ({
    id: s.id, storeId: s.store_id, state: s.state, openedBy: s.opened_by, openedAt: s.opened_at,
    openingCash: { currency: s.opening_cash_currency, minor: s.opening_cash_minor },
    closedBy: s.closed_by, closedAt: s.closed_at,
    closingCash: s.closing_cash_minor ? { currency: s.closing_cash_currency, minor: s.closing_cash_minor } : null,
    totalSales: s.total_sales_minor ? { currency: s.total_sales_currency, minor: s.total_sales_minor } : null,
  });
}
