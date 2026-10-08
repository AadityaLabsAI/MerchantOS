// Suppliers + purchases. Store membership enforced on every endpoint.
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
  items: z.array(z.object({ productId: z.string().min(1).max(64), quantity: z.number().int().positive(), unitCost: MoneySchema.optional() })),
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
    // Verify the supplier belongs to this store & merchant
    const supplier = await query<{ id: string; store_id: string }>(
      `SELECT id, store_id FROM suppliers WHERE id = $1 AND merchant_id = $2`,
      [supplierId, req.auth.merchantId]);
    if (!supplier.rows[0]) throw new NotFoundException('supplier not found');
    if (supplier.rows[0].store_id !== p.storeId) {
      throw new BadRequestException('supplier does not belong to the given storeId');
    }
    const id = ulid();
    await query(
      `INSERT INTO supplier_purchases (id, merchant_id, store_id, supplier_id, invoice_number, total_minor, currency, notes, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [id, req.auth.merchantId, p.storeId, supplierId, p.invoiceNumber ?? null, p.total.minor, p.total.currency, p.notes ?? null, req.auth.userId]);
    await this.audit.write({ merchantId: req.auth.merchantId, storeId: p.storeId, actorUserId: req.auth.userId,
      action: 'purchase.create', targetType: 'supplier_purchase', targetId: id, requestId: req.id, ip: req.ip,
      metadata: { supplierId, totalMinor: p.total.minor } });
    return { id };
  }
}
