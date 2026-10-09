// Reports: today sales, top products, outstanding khata.
import { Controller, Get, Query, Req, UseGuards, BadRequestException } from '@nestjs/common';
import { z } from 'zod';
import { PERMISSIONS } from '@merchantos/shared-types';
import { query } from '../db/db.js';
import { AuthGuard } from '../auth/auth.guard.js';
import { Permissions, PermissionsGuard } from '../rbac/rbac.guard.js';
import { assertStoreAccess } from '../rbac/store-access.js';

const TodayQuery = z.object({ storeId: z.string().min(1).max(64) });
const TopQuery = z.object({ storeId: z.string().min(1).max(64), days: z.coerce.number().int().positive().max(365).default(30) });
const KhataQuery = z.object({ storeId: z.string().min(1).max(64) });

@Controller('api/reports')
@UseGuards(AuthGuard, PermissionsGuard)
export class ReportsController {
  @Get('today')
  @Permissions(PERMISSIONS.REPORTS_VIEW)
  async today(@Req() req: any, @Query() raw: any) {
    const { storeId } = TodayQuery.parse(raw);
    await assertStoreAccess(req.auth, storeId);
    const r = await query(
      `SELECT COALESCE(SUM((p.amount_minor)::bigint), 0) AS total, COUNT(*) AS cnt
         FROM payments p
         JOIN payment_sessions s ON s.id = p.payment_session_id
         JOIN stores st ON st.id = s.store_id AND st.merchant_id = s.merchant_id
        WHERE p.merchant_id = $1 AND s.store_id = $2 AND s.state = 'VERIFIED'
          AND p.currency = 'INR'
          AND DATE(p.paid_at AT TIME ZONE st.timezone) = DATE(now() AT TIME ZONE st.timezone)`,
      [req.auth.merchantId, storeId]);
    const row = r.rows[0];
    const total = BigInt(row.total);
    const cnt = Number(row.cnt);
    return {
      totalMinor: total.toString(), count: cnt,
      averageMinor: cnt ? (total / BigInt(cnt)).toString() : '0', currency: 'INR',
    };
  }

  @Get('top-products')
  @Permissions(PERMISSIONS.REPORTS_VIEW)
  async topProducts(@Req() req: any, @Query() raw: any) {
    const { storeId, days } = TopQuery.parse(raw);
    await assertStoreAccess(req.auth, storeId);
    // days is passed as integer parameter; SQL is safe.
    const r = await query(
      `SELECT bi.product_id, bi.name, SUM(bi.quantity)::bigint AS qty, SUM((bi.line_total_minor)::bigint) AS revenue
         FROM bill_items bi
         JOIN bills b ON b.id = bi.bill_id
        WHERE b.merchant_id = $1 AND b.store_id = $2 AND b.state = 'FINALIZED'
          AND b.created_at >= now() - make_interval(days => $3)
        GROUP BY bi.product_id, bi.name
        ORDER BY revenue DESC LIMIT 10`,
      [req.auth.merchantId, storeId, days]);
    return { products: r.rows.map(p => ({ productId: p.product_id, name: p.name,
      quantity: Number(p.qty), revenueMinor: p.revenue.toString(), currency: 'INR' })) };
  }

  @Get('outstanding-khata')
  @Permissions(PERMISSIONS.REPORTS_VIEW)
  async khata(@Req() req: any, @Query() raw: any) {
    const { storeId } = KhataQuery.parse(raw);
    await assertStoreAccess(req.auth, storeId);
    const r = await query(
      `SELECT COALESCE(SUM((balance_minor)::bigint), 0) AS total
         FROM customers WHERE merchant_id = $1 AND store_id = $2 AND (balance_minor)::bigint > 0`,
      [req.auth.merchantId, storeId]);
    return { outstandingMinor: r.rows[0].total.toString(), currency: 'INR' };
  }
}
