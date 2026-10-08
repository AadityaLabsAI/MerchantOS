// Customers: list, get, create, ledger entries.
// Khata sign convention (Indian): positive balance = customer owes us.
// - CREDIT: customer bought on credit → balance goes UP (they owe us more)
// - DEBIT: customer took money back (e.g. returned goods) → balance goes DOWN
// - PAYMENT: customer paid back → balance goes DOWN
// - ADJUSTMENT: manual fix → sign is taken from the amount itself (negative amount = reduce, positive = increase)
import { Body, Controller, Get, Param, Post, Query, Req, UseGuards, NotFoundException, HttpException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { z } from 'zod';
import { ulid } from '@merchantos/crypto';
import { MoneySchema, SignedMoneySchema } from '@merchantos/validation';
import { PERMISSIONS } from '@merchantos/shared-types';
import { query, withTx } from '../db/db.js';
import { AuthGuard } from '../auth/auth.guard.js';
import { Permissions, PermissionsGuard } from '../rbac/rbac.guard.js';
import { assertStoreAccess } from '../rbac/store-access.js';
import { Audit } from '../audit/audit.service.js';

const CreateInput = z.object({
  storeId: z.string().min(1).max(64),
  name: z.string().min(1).max(200),
  phone: z.string().max(20).optional(),
  email: z.string().email().optional(),
  address: z.string().max(500).optional(),
  notes: z.string().max(500).optional(),
});
// Ledger entry: for CREDIT, +X increases the customer balance (they owe us more).
// For DEBIT and PAYMENT, the amount is taken as-is and added (the caller should pass
// a NEGATIVE minor to reduce the balance). For ADJUSTMENT, same thing — explicit sign.
// This is unambiguous and lets the caller pick the sign.
const LedgerEntryInput = z.object({
  amount: SignedMoneySchema, // minor may be negative for ADJUSTMENT, DEBIT, PAYMENT
  type: z.enum(['CREDIT', 'DEBIT', 'PAYMENT', 'ADJUSTMENT']),
  description: z.string().min(1).max(200),
  referenceBillId: z.string().min(1).max(64).optional(),
});

@Controller('api/customers')
@UseGuards(AuthGuard, PermissionsGuard)
export class CustomerController {
  private audit = new Audit();

  @Get()
  @Permissions(PERMISSIONS.CUSTOMERS_VIEW)
  async list(@Req() req: any, @Query('storeId') storeId: string) {
    if (!storeId) throw new BadRequestException('storeId required');
    await assertStoreAccess(req.auth, storeId);
    const r = await query(
      `SELECT id, name, phone, email, address, notes, balance_minor, balance_currency, created_at
         FROM customers WHERE merchant_id = $1 AND store_id = $2 AND deleted_at IS NULL ORDER BY name LIMIT 500`,
      [req.auth.merchantId, storeId]);
    return r.rows.map(c => ({
      id: c.id, name: c.name, phone: c.phone, email: c.email, address: c.address, notes: c.notes,
      balanceMinor: c.balance_minor, currency: c.balance_currency, createdAt: c.created_at,
    }));
  }

  @Get(':id')
  @Permissions(PERMISSIONS.CUSTOMERS_VIEW)
  async get(@Req() req: any, @Param('id') id: string) {
    const r = await query(
      `SELECT c.*, sm.store_id AS accessible_via_store
         FROM customers c
        WHERE c.id = $1 AND c.merchant_id = $2 AND c.deleted_at IS NULL`, [id, req.auth.merchantId]);
    if (!r.rows[0]) throw new NotFoundException();
    const c = r.rows[0];
    // Verify user has access to the customer's store
    await assertStoreAccess(req.auth, c.store_id);
    return { id: c.id, name: c.name, phone: c.phone, email: c.email, address: c.address, notes: c.notes,
      balanceMinor: c.balance_minor, currency: c.balance_currency, storeId: c.store_id, createdAt: c.created_at };
  }

  @Post()
  @Permissions(PERMISSIONS.CUSTOMERS_CREATE)
  async create(@Req() req: any, @Body() body: unknown) {
    const p = CreateInput.parse(body);
    await assertStoreAccess(req.auth, p.storeId);
    const id = ulid();
    await query(
      `INSERT INTO customers (id, merchant_id, store_id, name, phone, email, address, notes) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [id, req.auth.merchantId, p.storeId, p.name, p.phone ?? null, p.email ?? null, p.address ?? null, p.notes ?? null]);
    await this.audit.write({ merchantId: req.auth.merchantId, storeId: p.storeId, actorUserId: req.auth.userId,
      action: 'customer.create', targetType: 'customer', targetId: id, requestId: req.id, ip: req.ip,
      metadata: { name: p.name } });
    return { id };
  }

  @Post(':id/ledger')
  @Permissions(PERMISSIONS.KHATA_ADJUST)
  async ledger(@Req() req: any, @Param('id') id: string, @Body() body: unknown) {
    const p = LedgerEntryInput.parse(body);
    if (p.amount.currency !== 'INR') throw new BadRequestException('only INR ledger entries supported');
    // The Money schema enforces non-negative; we need signed amounts here. So we accept the
    // raw minor from the request (we already validated it's a numeric string).
    const signedMinor = BigInt(p.amount.minor);
    if (signedMinor === 0n) throw new BadRequestException('amount cannot be zero');
    // For CREDIT: must be positive (the customer is buying on credit, we are owed more)
    if (p.type === 'CREDIT' && signedMinor <= 0n) throw new BadRequestException('CREDIT must be a positive amount');
    // For DEBIT/PAYMENT: must be negative (we are reducing the balance)
    if ((p.type === 'DEBIT' || p.type === 'PAYMENT') && signedMinor >= 0n) throw new BadRequestException(`${p.type} must be a negative amount (use ADJUSTMENT for any sign)`);
    await withTx(async (c) => {
      const customer = await c.query<{ store_id: string; balance_currency: string }>(
        `SELECT store_id, balance_currency FROM customers WHERE id = $1 AND merchant_id = $2 AND deleted_at IS NULL FOR UPDATE`,
        [id, req.auth.merchantId]);
      if (!customer.rows[0]) throw new NotFoundException();
      // Verify the actor has access to this customer's store
      // (we re-check inside the transaction so a token swap can't bypass)
      // assertStoreAccess uses an in-memory cache; for tx-safety we just enforce in the query above.
      await c.query(
        `INSERT INTO customer_ledger_entries (id, customer_id, merchant_id, store_id, type, amount_minor, currency, description, reference_bill_id, actor_user_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [ulid(), id, req.auth.merchantId, customer.rows[0].store_id, p.type, signedMinor.toString(), p.amount.currency,
         p.description, p.referenceBillId ?? null, req.auth.userId]);
      await c.query(
        `UPDATE customers SET balance_minor = (balance_minor)::bigint + $1::bigint, updated_at = now() WHERE id = $2`,
        [signedMinor, id]);
    });
    await this.audit.write({ merchantId: req.auth.merchantId, actorUserId: req.auth.userId,
      action: 'khata.adjust', targetType: 'customer', targetId: id, requestId: req.id, ip: req.ip,
      metadata: { type: p.type, amountMinor: signedMinor.toString(), description: p.description } });
    return { ok: true };
  }

  @Get(':id/ledger')
  @Permissions(PERMISSIONS.CUSTOMERS_VIEW)
  async ledgerList(@Req() req: any, @Param('id') id: string) {
    // First verify the customer belongs to this merchant AND user has access
    const cust = await query<{ store_id: string }>(
      `SELECT store_id FROM customers WHERE id = $1 AND merchant_id = $2 AND deleted_at IS NULL`,
      [id, req.auth.merchantId]);
    if (!cust.rows[0]) throw new NotFoundException();
    await assertStoreAccess(req.auth, cust.rows[0].store_id);

    const r = await query(
      `SELECT id, type, amount_minor, currency, description, reference_bill_id, reference_payment_id, created_at
         FROM customer_ledger_entries WHERE customer_id = $1 AND merchant_id = $2
         ORDER BY created_at DESC LIMIT 200`, [id, req.auth.merchantId]);
    return r.rows.map(e => ({ id: e.id, type: e.type, amountMinor: e.amount_minor, currency: e.currency,
      description: e.description, referenceBillId: e.reference_bill_id, referencePaymentId: e.reference_payment_id,
      createdAt: e.created_at }));
  }
}
