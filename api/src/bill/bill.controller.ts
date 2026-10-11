// Bills: list, get, create (atomic), cancel, refund.
// On create: validates store access, checks stock, decrements stock, persists bill + items,
// records a CREDIT ledger entry if the bill has a customer (so khata reflects the sale).
// On cancel: refunds stock and reverses the ledger entry.
import { Body, Controller, Get, Param, Post, Query, Req, UseGuards, NotFoundException, HttpException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { z } from 'zod';
import { ulid } from '@merchantos/crypto';
import { moneyFromMinor } from '@merchantos/money';
import { CreateBillInput } from '@merchantos/validation';
import { PERMISSIONS } from '@merchantos/shared-types';
import { query, withTx } from '../db/db.js';
import { AuthGuard } from '../auth/auth.guard.js';
import { Permissions, PermissionsGuard } from '../rbac/rbac.guard.js';
import { assertStoreAccess } from '../rbac/store-access.js';
import { Audit } from '../audit/audit.service.js';

@Controller('api/bills')
@UseGuards(AuthGuard, PermissionsGuard)
export class BillController {
  private audit = new Audit();

  @Get()
  @Permissions(PERMISSIONS.BILLING_VIEW)
  async list(@Req() req: any, @Query('storeId') storeId: string) {
    if (!storeId) throw new BadRequestException('storeId required');
    await assertStoreAccess(req.auth, storeId);
    const r = await query(
      `SELECT id, customer_id, state, subtotal_minor, tax_minor, total_minor, currency, notes, created_at, updated_at
         FROM bills WHERE merchant_id = $1 AND store_id = $2 ORDER BY created_at DESC LIMIT 200`,
      [req.auth.merchantId, storeId]);
    return r.rows.map(b => ({ id: b.id, customerId: b.customer_id, state: b.state,
      subtotalMinor: b.subtotal_minor, taxMinor: b.tax_minor, totalMinor: b.total_minor, currency: b.currency,
      notes: b.notes, createdAt: b.created_at, updatedAt: b.updated_at }));
  }

  @Get(':id')
  @Permissions(PERMISSIONS.BILLING_VIEW)
  async get(@Req() req: any, @Param('id') id: string) {
    const bill = await query(`SELECT * FROM bills WHERE id = $1 AND merchant_id = $2`, [id, req.auth.merchantId]);
    if (!bill.rows[0]) throw new NotFoundException();
    await assertStoreAccess(req.auth, bill.rows[0].store_id);
    const items = await query(`SELECT * FROM bill_items WHERE bill_id = $1`, [id]);
    const b = bill.rows[0];
    return {
      id: b.id, customerId: b.customer_id, state: b.state, storeId: b.store_id,
      subtotalMinor: b.subtotal_minor, taxMinor: b.tax_minor, totalMinor: b.total_minor, currency: b.currency,
      notes: b.notes, createdAt: b.created_at, updatedAt: b.updated_at,
      items: items.rows.map(i => ({ id: i.id, productId: i.product_id, name: i.name, quantity: Number(i.quantity),
        unitPriceMinor: i.unit_price_minor, lineTotalMinor: i.line_total_minor, taxBps: i.tax_bps })),
    };
  }

  @Post()
  @Permissions(PERMISSIONS.BILLING_CREATE)
  async create(@Req() req: any, @Body() body: unknown) {
    const p = CreateBillInput.parse(body);
    await assertStoreAccess(req.auth, p.storeId);
    const currency = p.currency;

    const result = await withTx(async (c) => {
      // Lock all the products we'll touch so stock checks are race-free.
      const lineRows: Array<[string, string, string, string, number, string, string, number]> = [];
      let subtotal = moneyFromMinor(currency, 0n);
      let subtotalTax = moneyFromMinor(currency, 0n);
      for (const line of p.lines) {
        // FOR UPDATE so concurrent bill creation can't oversell.
        const prod = await c.query<{ name: string; price_minor: string; currency: string; stock_count: string; is_active: boolean; tax_bps: number }>(
          `SELECT name, price_minor, currency, stock_count, is_active, tax_bps FROM products
            WHERE id = $1 AND store_id = $2 AND merchant_id = $3 FOR UPDATE`,
          [line.productId, p.storeId, req.auth.merchantId]);
        if (!prod.rows[0]) throw new HttpException(`unknown product ${line.productId}`, 400);
        if (!prod.rows[0].is_active) throw new HttpException(`inactive product ${line.productId}`, 400);
        if (prod.rows[0].currency !== currency) {
          throw new HttpException(`product ${line.productId} currency ${prod.rows[0].currency} != bill currency ${currency}`, 400);
        }
        const unitPrice = line.overridePrice?.currency === currency ? line.overridePrice.minor : prod.rows[0].price_minor;
        const unitMoney = moneyFromMinor(currency, unitPrice);
        const lineMoney = unitMoney.times(BigInt(line.quantity));
        subtotal = subtotal.plus(lineMoney);
        // Per-line tax: use the bill-level taxBps if explicitly > 0; otherwise the product's tax_bps.
        // The product's tax_bps is treated as a per-product override; the bill-level rate is the default.
        const lineTaxBps = (p.taxBps && p.taxBps > 0) ? p.taxBps : (prod.rows[0].tax_bps || 0);
        // Compute tax as (line_subtotal * bps / 10000), truncated to nearest minor unit.
        const lineTaxMinor = (lineMoney.minor * BigInt(lineTaxBps)) / 10000n;
        const lineTaxMoney = moneyFromMinor(currency, lineTaxMinor);
        subtotalTax = subtotalTax.plus(lineTaxMoney);
        if (BigInt(prod.rows[0].stock_count) < BigInt(line.quantity)) {
          throw new HttpException(`insufficient stock for ${prod.rows[0].name}`, 409);
        }
        lineRows.push([ulid(), '', line.productId, prod.rows[0].name, line.quantity,
          unitPrice, lineMoney.minor.toString(), lineTaxBps]);
      }
      const taxMoney = subtotalTax;
      const totalMoney = subtotal.plus(taxMoney);
      const billId = ulid();
      // Patch the billId into each row
      for (const r of lineRows) r[1] = billId;
      await c.query(
        `INSERT INTO bills (id, merchant_id, store_id, customer_id, state, subtotal_minor, tax_minor, total_minor, currency, notes, created_by)
         VALUES ($1, $2, $3, $4, 'FINALIZED', $5, $6, $7, $8, $9, $10)`,
        [billId, req.auth.merchantId, p.storeId, p.customerId ?? null,
         subtotal.minor.toString(), taxMoney.minor.toString(), totalMoney.minor.toString(),
         currency, p.notes ?? null, req.auth.userId]);
      for (const row of lineRows) {
        await c.query(
          `INSERT INTO bill_items (id, bill_id, product_id, name, quantity, unit_price_minor, line_total_minor, tax_bps)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`, row);
        await c.query(
          `INSERT INTO stock_movements (id, merchant_id, store_id, product_id, type, quantity, reference_bill_id, actor_user_id)
           VALUES ($1, $2, $3, $4, 'SALE', $5, $6, $7)`,
          [ulid(), req.auth.merchantId, p.storeId, row[2], -row[4], billId, req.auth.userId]);
        await c.query(
          `UPDATE products SET stock_count = stock_count - $1, updated_at = now() WHERE id = $2`,
          [row[4], row[2]]);
      }
      // If this bill is for a customer on khata, record a CREDIT entry so the balance grows.
      if (p.customerId) {
        const cust = await c.query<{ id: string; store_id: string }>(
          `SELECT id, store_id FROM customers WHERE id = $1 AND merchant_id = $2 AND deleted_at IS NULL FOR UPDATE`,
          [p.customerId, req.auth.merchantId]);
        if (!cust.rows[0]) throw new HttpException('customer not found or deleted', 400);
        await c.query(
          `INSERT INTO customer_ledger_entries (id, customer_id, merchant_id, store_id, type, amount_minor, currency, description, reference_bill_id, actor_user_id)
           VALUES ($1, $2, $3, $4, 'CREDIT', $5, $6, $7, $8, $9)`,
          [ulid(), p.customerId, req.auth.merchantId, p.storeId, totalMoney.minor.toString(), currency, `Bill ${billId}`, billId, req.auth.userId]);
        await c.query(
          `UPDATE customers SET balance_minor = (balance_minor)::bigint + $1::bigint, updated_at = now() WHERE id = $2`,
          [totalMoney.minor.toString(), p.customerId]);
      }
      return { subtotal, tax: taxMoney, total: totalMoney, items: lineRows, billId };
    });
    await this.audit.write({ merchantId: req.auth.merchantId, storeId: p.storeId, actorUserId: req.auth.userId,
      action: 'bill.create', targetType: 'bill', targetId: result.billId, requestId: req.id, ip: req.ip,
      metadata: { lineCount: p.lines.length, totalMinor: result.total.minor.toString(), customerId: p.customerId ?? null } });
    return {
      id: result.billId, customerId: p.customerId ?? null, state: 'FINALIZED',
      subtotalMinor: result.subtotal.minor.toString(), taxMinor: result.tax.minor.toString(), totalMinor: result.total.minor.toString(),
      currency, items: result.items.map((r) => ({ id: r[0], productId: r[2], name: r[3], quantity: r[4],
        unitPriceMinor: r[5], lineTotalMinor: r[6], taxBps: r[7] })),
    };
  }

  @Post(':id/cancel')
  @Permissions(PERMISSIONS.BILLING_CANCEL)
  async cancel(@Req() req: any, @Param('id') id: string) {
    await withTx(async (c) => {
      const bill = await c.query<{ state: string; store_id: string; customer_id: string | null; total_minor: string; currency: string }>(
        `SELECT state, store_id, customer_id, total_minor, currency FROM bills WHERE id = $1 AND merchant_id = $2 FOR UPDATE`,
        [id, req.auth.merchantId]);
      if (!bill.rows[0]) throw new NotFoundException();
      if (bill.rows[0].state !== 'FINALIZED') throw new HttpException(`cannot cancel ${bill.rows[0].state} bill`, 400);

      // Return stock for every line.
      const items = await c.query<{ product_id: string; quantity: string }>(
        `SELECT product_id, quantity FROM bill_items WHERE bill_id = $1`, [id]);
      for (const item of items.rows) {
        const qty = BigInt(item.quantity);
        await c.query(
          `INSERT INTO stock_movements (id, merchant_id, store_id, product_id, type, quantity, reference_bill_id, actor_user_id, notes)
           VALUES ($1, $2, $3, $4, 'RETURN', $5, $6, $7, 'bill cancelled')`,
          [ulid(), req.auth.merchantId, bill.rows[0].store_id, item.product_id, qty.toString(), id, req.auth.userId]);
        await c.query(
          `UPDATE products SET stock_count = stock_count + $1, updated_at = now() WHERE id = $2`,
          [qty, item.product_id]);
      }
      // Reverse the customer ledger entry (DEBIT the same amount as the original CREDIT)
      if (bill.rows[0].customer_id) {
        const totalNegative = `-${bill.rows[0].total_minor}`;
        await c.query(
          `INSERT INTO customer_ledger_entries (id, customer_id, merchant_id, store_id, type, amount_minor, currency, description, reference_bill_id, actor_user_id)
           VALUES ($1, $2, $3, $4, 'DEBIT', $5, $6, $7, $8, $9)`,
          [ulid(), bill.rows[0].customer_id, req.auth.merchantId, bill.rows[0].store_id, totalNegative,
           bill.rows[0].currency, `Cancel bill ${id}`, id, req.auth.userId]);
        await c.query(
          `UPDATE customers SET balance_minor = (balance_minor)::bigint + $1::bigint, updated_at = now() WHERE id = $2`,
          [totalNegative, bill.rows[0].customer_id]);
      }
      // Defense-in-depth: include merchant_id even though the SELECT just verified it.
      await c.query(`UPDATE bills SET state = 'CANCELLED', updated_at = now() WHERE id = $1 AND merchant_id = $2`, [id, req.auth.merchantId]);
    });
    await this.audit.write({ merchantId: req.auth.merchantId, actorUserId: req.auth.userId,
      action: 'bill.cancel', targetType: 'bill', targetId: id, requestId: req.id, ip: req.ip });
    return { ok: true };
  }
}
