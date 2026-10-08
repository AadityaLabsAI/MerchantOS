// Products: list, get, create, stock adjust. RBAC + store membership enforced.
import { Body, Controller, Get, Param, Post, Query, Req, UseGuards, NotFoundException, BadRequestException } from '@nestjs/common';
import { z } from 'zod';
import { ulid } from '@merchantos/crypto';
import { MoneySchema } from '@merchantos/validation';
import { PERMISSIONS } from '@merchantos/shared-types';
import { query } from '../db/db.js';
import { AuthGuard } from '../auth/auth.guard.js';
import { Permissions, PermissionsGuard } from '../rbac/rbac.guard.js';
import { assertStoreAccess } from '../rbac/store-access.js';
import { Audit } from '../audit/audit.service.js';

const ListQuery = z.object({ storeId: z.string().min(1).max(64), q: z.string().max(200).optional() });
const CreateInput = z.object({
  storeId: z.string().min(1).max(64),
  sku: z.string().min(1).max(64),
  barcode: z.string().max(64).optional(),
  name: z.string().min(1).max(200),
  category: z.string().max(64).optional(),
  description: z.string().max(2000).optional(),
  price: MoneySchema,
  cost: MoneySchema.optional(),
  taxBps: z.number().int().min(0).max(10000).default(0),
  stockCount: z.number().int().nonnegative().default(0),
  lowStockThreshold: z.number().int().nonnegative().default(5),
});
const AdjustStockInput = z.object({ delta: z.number().int(), reason: z.string().min(1).max(200) });

@Controller('api/products')
@UseGuards(AuthGuard, PermissionsGuard)
export class ProductController {
  private audit = new Audit();

  @Get()
  @Permissions(PERMISSIONS.INVENTORY_VIEW)
  async list(@Req() req: any, @Query() raw: any) {
    const q = ListQuery.parse(raw);
    await assertStoreAccess(req.auth, q.storeId);
    const r = await query(
      `SELECT id, sku, barcode, name, category, description, price_minor, cost_minor, currency, tax_bps, stock_count, low_stock_threshold, is_active
         FROM products WHERE merchant_id = $1 AND store_id = $2 AND is_active = true
         ${q.q ? 'AND (name ILIKE $3 OR sku ILIKE $3 OR barcode ILIKE $3)' : ''}
         ORDER BY name LIMIT 500`,
      q.q ? [req.auth.merchantId, q.storeId, `%${q.q}%`] : [req.auth.merchantId, q.storeId]);
    return r.rows.map(this.shape);
  }

  @Get(':id')
  @Permissions(PERMISSIONS.INVENTORY_VIEW)
  async get(@Req() req: any, @Param('id') id: string) {
    const r = await query(`SELECT * FROM products WHERE id = $1 AND merchant_id = $2`, [id, req.auth.merchantId]);
    if (!r.rows[0]) throw new NotFoundException();
    // Verify the user has access to this product's store
    await assertStoreAccess(req.auth, r.rows[0].store_id);
    return this.shape(r.rows[0]);
  }

  @Post()
  @Permissions(PERMISSIONS.INVENTORY_EDIT)
  async create(@Req() req: any, @Body() body: unknown) {
    const p = CreateInput.parse(body);
    await assertStoreAccess(req.auth, p.storeId);
    if (p.price.currency.length !== 3) throw new BadRequestException('invalid price currency');
    const id = ulid();
    try {
      await query(
        `INSERT INTO products (id, merchant_id, store_id, sku, barcode, name, category, description,
                               price_minor, cost_minor, currency, tax_bps, stock_count, low_stock_threshold)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
        [id, req.auth.merchantId, p.storeId, p.sku, p.barcode ?? null, p.name, p.category ?? null,
         p.description ?? null, p.price.minor, p.cost?.minor ?? '0', p.price.currency, p.taxBps, p.stockCount, p.lowStockThreshold]);
    } catch (err) {
      if (String((err as Error).message).includes('duplicate key value') && String((err as Error).message).includes('sku')) {
        throw new BadRequestException('SKU already exists in this store');
      }
      throw err;
    }
    if (p.stockCount > 0) {
      // Record an opening stock movement.
      await query(
        `INSERT INTO stock_movements (id, merchant_id, store_id, product_id, type, quantity, actor_user_id, notes)
         VALUES ($1, $2, $3, $4, 'ADJUSTMENT', $5, $6, 'opening stock')`,
        [ulid(), req.auth.merchantId, p.storeId, id, p.stockCount, req.auth.userId]);
    }
    await this.audit.write({ merchantId: req.auth.merchantId, storeId: p.storeId, actorUserId: req.auth.userId,
      action: 'product.create', targetType: 'product', targetId: id, requestId: req.id, ip: req.ip,
      metadata: { sku: p.sku, name: p.name } });
    return { id };
  }

  @Post(':id/adjust-stock')
  @Permissions(PERMISSIONS.INVENTORY_EDIT)
  async adjustStock(@Req() req: any, @Param('id') id: string, @Body() body: unknown) {
    const p = AdjustStockInput.parse(body);
    if (p.delta === 0) throw new BadRequestException('delta cannot be zero');
    // Single transaction: lock product, verify, update, log movement.
    await query('BEGIN').catch(() => undefined);
    try {
      const prod = await query<{ store_id: string; stock_count: string }>(
        `SELECT store_id, stock_count FROM products WHERE id = $1 AND merchant_id = $2 FOR UPDATE`,
        [id, req.auth.merchantId]);
      if (!prod.rows[0]) throw new NotFoundException();
      await assertStoreAccess(req.auth, prod.rows[0].store_id);
      const newStock = BigInt(prod.rows[0].stock_count) + BigInt(p.delta);
      if (newStock < 0n) throw new BadRequestException('stock cannot go negative');
      await query(
        `UPDATE products SET stock_count = $1, updated_at = now() WHERE id = $2`,
        [newStock.toString(), id]);
      await query(
        `INSERT INTO stock_movements (id, merchant_id, store_id, product_id, type, quantity, actor_user_id, notes)
         VALUES ($1, $2, $3, $4, 'ADJUSTMENT', $5, $6, $7)`,
        [ulid(), req.auth.merchantId, prod.rows[0].store_id, id, p.delta, req.auth.userId, p.reason]);
      await query('COMMIT');
    } catch (e) {
      await query('ROLLBACK').catch(() => undefined);
      throw e;
    }
    await this.audit.write({ merchantId: req.auth.merchantId, actorUserId: req.auth.userId,
      action: 'product.adjust-stock', targetType: 'product', targetId: id, requestId: req.id, ip: req.ip,
      metadata: { delta: p.delta, reason: p.reason } });
    return { ok: true };
  }

  private shape = (p: any) => ({
    id: p.id, sku: p.sku, barcode: p.barcode, name: p.name, category: p.category, description: p.description,
    storeId: p.store_id,
    price: { currency: p.currency, minor: p.price_minor },
    cost: { currency: p.currency, minor: p.cost_minor },
    taxBps: p.tax_bps, stockCount: Number(p.stock_count), lowStockThreshold: Number(p.low_stock_threshold),
    isActive: p.is_active,
  });
}
