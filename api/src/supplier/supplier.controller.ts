// Suppliers + purchases. Store membership enforced on every endpoint.
import { Body, Controller, Get, Param, Post, Query, Req, UseGuards, NotFoundException, BadRequestException } from '@nestjs/common';
import { z } from 'zod';
import { ulid } from '@merchantos/crypto';
import { MoneySchema } from '@merchantos/validation';
import { PERMISSIONS } from '@merchantos/shared-types';
import { query, withTx } from '../db/db.js';
import { AuthGuard } from '../auth/auth.guard.js';
import { Permissions, PermissionsGuard } from '../rbac/rbac.guard.js';
import { assertStoreAccess } from '../rbac/store-access.js';
import { Audit } from '../audit/audit.service.js';

const CreateSupplier = z.object({
  storeId: z.string().min(1).max(64),
  name: z.string().min(1).max(200),
  phone: z.string().max(20).optional(),
  email: z.string().email().optional(),
  address: z.string().max(500).optional(),
  gstin: z.string().max(20).optional(),
});
const RecordPurchase = z.object({
  storeId: z.string().min(1).max(64),
  supplierId: z.string().min(1).max(64),
  invoiceNumber: z.string().max(64).optional(),
  total: MoneySchema,
  items: z.array(z.object({ productId: z.string().min(1).max(64), quantity: z.number().int().positive(), unitCost: MoneySchema.optional() })).min(1).max(500),
  notes: z.string().max(500).optional(),
});

@Controller('api/suppliers')
@UseGuards(AuthGuard, PermissionsGuard)
export class SupplierController {
  private audit = new Audit();

  @Get()
  @Permissions(PERMISSIONS.SUPPLIERS_VIEW)
  async list(@Req() req: any, @Query('storeId') storeId: string) {
    if (!storeId) throw new BadRequestException('storeId required');
    await assertStoreAccess(req.auth, storeId);
    const r = await query(
      `SELECT id, name, phone, email, address, gstin, balance_minor, balance_currency, created_at
         FROM suppliers WHERE merchant_id = $1 AND store_id = $2 ORDER BY name`,
      [req.auth.merchantId, storeId]);
    return { suppliers: r.rows.map(s => ({ id: s.id, name: s.name, phone: s.phone, email: s.email,
      address: s.address, gstin: s.gstin, balanceMinor: s.balance_minor, currency: s.balance_currency })) };
  }

  @Post()
  @Permissions(PERMISSIONS.SUPPLIERS_CREATE)
  async create(@Req() req: any, @Body() body: unknown) {
    const p = CreateSupplier.parse(body);
    await assertStoreAccess(req.auth, p.storeId);
    const id = ulid();
    await query(
      `INSERT INTO suppliers (id, merchant_id, store_id, name, phone, email, address, gstin) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [id, req.auth.merchantId, p.storeId, p.name, p.phone ?? null, p.email ?? null, p.address ?? null, p.gstin ?? null]);
    await this.audit.write({ merchantId: req.auth.merchantId, storeId: p.storeId, actorUserId: req.auth.userId,
      action: 'supplier.create', targetType: 'supplier', targetId: id, requestId: req.id, ip: req.ip });
    return { id };
  }

  @Post(':supplierId/purchases')
  @Permissions(PERMISSIONS.PURCHASES_CREATE)
  async recordPurchase(@Req() req: any, @Param('supplierId') supplierId: string, @Body() body: unknown) {
    const p = RecordPurchase.parse(body);
    await assertStoreAccess(req.auth, p.storeId);
    const id = ulid();
    const totalMinor = BigInt(p.total.minor);
    if (totalMinor <= 0n || p.total.currency.length !== 3) {
      throw new BadRequestException('purchase total must be positive and use a valid currency');
    }
    const productIds = p.items.map((item) => item.productId);
    if (new Set(productIds).size !== productIds.length) {
      throw new BadRequestException('duplicate product lines are not allowed in a purchase');
    }

    await withTx(async (c) => {
      const supplier = await c.query<{ id: string; store_id: string; balance_minor: string; balance_currency: string }>(
        `SELECT id, store_id, balance_minor, balance_currency
           FROM suppliers WHERE id = $1 AND merchant_id = $2 FOR UPDATE`,
        [supplierId, req.auth.merchantId]);
      if (!supplier.rows[0]) throw new NotFoundException('supplier not found');
      if (supplier.rows[0].store_id !== p.storeId) {
        throw new BadRequestException('supplier does not belong to the given storeId');
      }
      if (supplier.rows[0].balance_currency !== p.total.currency) {
        throw new BadRequestException('purchase currency must match supplier balance currency');
      }

      const products = await c.query<{
        id: string; currency: string; cost_minor: string; stock_count: string
      }>(
        `SELECT id, currency, cost_minor, stock_count FROM products
          WHERE merchant_id = $1 AND store_id = $2 AND id = ANY($3::text[])
          ORDER BY id FOR UPDATE`,
        [req.auth.merchantId, p.storeId, productIds]);
      const byId = new Map(products.rows.map((product) => [product.id, product]));
      if (byId.size !== productIds.length) {
        throw new BadRequestException('every purchase product must belong to this merchant and store');
      }

      const lines = p.items.map((item) => {
        const product = byId.get(item.productId)!;
        if (product.currency !== p.total.currency) {
          throw new BadRequestException('purchase, supplier balance, and product currencies must match');
        }
        if (item.unitCost && item.unitCost.currency !== p.total.currency) {
          throw new BadRequestException('purchase line currency mismatch');
        }
        const unitCostMinor = BigInt(item.unitCost?.minor ?? product.cost_minor);
        if (unitCostMinor < 0n) throw new BadRequestException('unit cost cannot be negative');
        return {
          ...item,
          unitCostMinor,
          lineTotalMinor: unitCostMinor * BigInt(item.quantity),
          currentStock: BigInt(product.stock_count),
        };
      });
      const computedTotal = lines.reduce((sum, line) => sum + line.lineTotalMinor, 0n);
      if (computedTotal !== totalMinor) {
        throw new BadRequestException('purchase total does not match the sum of line items');
      }

      await c.query(
        `INSERT INTO supplier_purchases (id, merchant_id, store_id, supplier_id, invoice_number, total_minor, currency, notes, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [id, req.auth.merchantId, p.storeId, supplierId, p.invoiceNumber ?? null,
         totalMinor.toString(), p.total.currency, p.notes ?? null, req.auth.userId]);

      for (const line of lines) {
        await c.query(
          `INSERT INTO supplier_purchase_items
             (id, purchase_id, merchant_id, store_id, product_id, quantity, unit_cost_minor, line_total_minor, currency)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [ulid(), id, req.auth.merchantId, p.storeId, line.productId, line.quantity,
           line.unitCostMinor.toString(), line.lineTotalMinor.toString(), p.total.currency]);
        await c.query(
          `UPDATE products SET stock_count = (stock_count)::bigint + $1::bigint,
                                cost_minor = $2, updated_at = now()
            WHERE id = $3 AND merchant_id = $4 AND store_id = $5`,
          [line.quantity, line.unitCostMinor.toString(), line.productId, req.auth.merchantId, p.storeId]);
        await c.query(
          `INSERT INTO stock_movements (id, merchant_id, store_id, product_id, type, quantity, actor_user_id, notes)
           VALUES ($1, $2, $3, $4, 'PURCHASE', $5, $6, $7)`,
          [ulid(), req.auth.merchantId, p.storeId, line.productId, line.quantity, req.auth.userId,
           `supplier purchase ${id}`]);
      }
      await c.query(
        `UPDATE suppliers SET balance_minor = (balance_minor)::bigint + $1::bigint, updated_at = now()
          WHERE id = $2 AND merchant_id = $3 AND store_id = $4`,
        [totalMinor.toString(), supplierId, req.auth.merchantId, p.storeId]);
    });
    await this.audit.write({ merchantId: req.auth.merchantId, storeId: p.storeId, actorUserId: req.auth.userId,
      action: 'purchase.create', targetType: 'supplier_purchase', targetId: id, requestId: req.id, ip: req.ip,
      metadata: { supplierId, totalMinor: p.total.minor } });
    return { id };
  }
}
