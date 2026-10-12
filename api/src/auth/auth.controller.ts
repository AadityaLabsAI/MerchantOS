// Auth endpoints: login, refresh, register, me.
// Passwords hashed with scrypt (Node built-in, @merchantos/crypto).
import { Body, Controller, Get, HttpException, Post, Req, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { LoginInput, RegisterInput } from '@merchantos/validation';
import { ulid, hashPasswordAsync, verifyPasswordAsync } from '@merchantos/crypto';
import { rateLimit, ipKey, sweep as sweepRate } from '@merchantos/security';
import { ROLE_PERMISSIONS, type Role } from '@merchantos/shared-types';
import { query, withTx } from '../db/db.js';
import { loadConfig } from '../config/config.js';
import { signAccess, signRefresh, verifyRefresh } from './jwt-helper.js';
import { AuthGuard, Public } from './auth.guard.js';
import { PermissionsGuard } from '../rbac/rbac.guard.js';
import { Audit } from '../audit/audit.service.js';

const RefreshInput = z.object({ refreshToken: z.string().min(1) });

function ttlToMs(ttl: string): number {
  const match = /^(\d+)(ms|s|m|h|d)$/.exec(ttl);
  if (!match) throw new Error('invalid configured TTL');
  const n = Number(match[1]);
  const multiplier = match[2] === 'ms' ? 1 : match[2] === 's' ? 1000 : match[2] === 'm' ? 60_000 : match[2] === 'h' ? 3_600_000 : 86_400_000;
  return n * multiplier;
}

@Controller('auth')
@UseGuards(AuthGuard, PermissionsGuard)
export class AuthController {
  private audit = new Audit();

  @Public()
  @Post('login')
  async login(@Req() req: any, @Body() body: unknown) {
    sweepRate();
    const ip = (req?.ip || req?.headers?.['x-forwarded-for'] || '').toString().split(',')[0].trim();
    const email = (((body as any)?.email) || '').toString().toLowerCase();
    if (!rateLimit(ipKey(ip, 'login:ip'), { windowMs: 60_000, max: 30 }).ok) {
      throw new HttpException({ code: 'RATE_LIMITED', message: 'too many requests' }, 429);
    }
    if (!rateLimit(ipKey(email, 'login:email'), { windowMs: 60_000, max: 10 }).ok) {
      throw new HttpException({ code: 'RATE_LIMITED', message: 'too many requests' }, 429);
    }
    const parsed = LoginInput.parse(body);
    const cfg = loadConfig();
    const r = await query<{ id: string; merchant_id: string; password_hash: string; display_name: string; role: string; is_active: boolean }>(
      `SELECT u.id, u.merchant_id, u.password_hash, u.name as display_name, u.is_active, m.role
         FROM users u
         LEFT JOIN LATERAL (
           SELECT role FROM store_memberships
           WHERE user_id = u.id AND merchant_id = u.merchant_id
           ORDER BY created_at ASC LIMIT 1
         ) m ON true
       WHERE u.email = $1`,
      [parsed.email],
    );
    const u = r.rows[0];
    if (!u || !u.is_active || !(await verifyPasswordAsync(parsed.password, u.password_hash))) {
      // Constant-time to avoid user enumeration
      await new Promise((r) => setTimeout(r, 100));
      throw new HttpException({ code: 'INVALID_CREDENTIALS', message: 'invalid email or password' }, 401);
    }
    const stores = await query<{ store_id: string }>(
      `SELECT store_id FROM store_memberships WHERE user_id = $1`, [u.id]);
    const allowedStoreIds = stores.rows.map((s) => s.store_id);
    const effectiveStore = parsed.storeId && allowedStoreIds.includes(parsed.storeId)
      ? parsed.storeId
      : (allowedStoreIds[0] ?? null);
    if (!effectiveStore) throw new HttpException({ code: 'NO_STORE', message: 'user has no store membership' }, 403);
    const role = (u.role ?? 'CASHIER') as Role;
    const permissions = ROLE_PERMISSIONS[role] ?? [];
    const accessToken = await signAccess(cfg.JWT_ACCESS_SECRET, cfg.JWT_ACCESS_TTL, {
      sub: u.id, merchantId: u.merchant_id, storeId: effectiveStore, role, permissions,
    });
    const jti = ulid();
    const refreshToken = await signRefresh(cfg.JWT_REFRESH_SECRET, cfg.JWT_REFRESH_TTL, { sub: u.id, jti, storeId: effectiveStore });
    await query(
      `INSERT INTO refresh_tokens (jti, user_id, expires_at) VALUES ($1, $2, now() + ($3::bigint * interval '1 millisecond'))`,
      [jti, u.id, ttlToMs(cfg.JWT_REFRESH_TTL)]);
    await query(`UPDATE users SET last_login_at = now() WHERE id = $1 AND merchant_id = $2`, [u.id, u.merchant_id]);
    await this.audit.write({
      merchantId: u.merchant_id, storeId: effectiveStore, actorUserId: u.id,
      action: 'auth.login', targetType: 'user', targetId: u.id,
      requestId: req.id, ip: req.ip,
    });
    return {
      accessToken, refreshToken, expiresIn: cfg.JWT_ACCESS_TTL,
      user: { id: u.id, name: u.display_name, email: parsed.email, role, permissions },
      merchantId: u.merchant_id, storeId: effectiveStore, allowedStoreIds,
    };
  }

  @Public()
  @Post('refresh')
  async refresh(@Body() body: unknown) {
    const parsed = RefreshInput.parse(body);
    const cfg = loadConfig();
    const claims = await verifyRefresh(cfg.JWT_REFRESH_SECRET, parsed.refreshToken);

    // Lock and rotate the token in one transaction. A concurrent replay sees the
    // old row revoked and cannot mint another access/refresh-token pair.
    return withTx(async (c) => {
      const stored = await c.query<{ revoked_at: Date | null; expires_at: Date }>(
        `SELECT revoked_at, expires_at FROM refresh_tokens WHERE jti = $1 FOR UPDATE`, [claims.jti]);
      if (!stored.rows[0] || stored.rows[0].revoked_at || new Date(stored.rows[0].expires_at).getTime() <= Date.now()) {
        throw new HttpException({ code: 'REFRESH_REVOKED', message: 'refresh token revoked or expired' }, 401);
      }

      const userRes = await c.query<{ id: string; merchant_id: string; is_active: boolean }>(
        `SELECT id, merchant_id, is_active FROM users WHERE id = $1`, [claims.sub]);
      const user = userRes.rows[0];
      if (!user || !user.is_active) throw new HttpException({ code: 'USER_INACTIVE', message: 'user inactive' }, 401);

      const stores = await c.query<{ store_id: string; role: string; is_default: boolean }>(
        `SELECT store_id, role, is_default FROM store_memberships
          WHERE user_id = $1 AND merchant_id = $2
          ORDER BY (store_id = $3) DESC, is_default DESC, created_at ASC`,
        [user.id, user.merchant_id, claims.storeId ?? '']);
      if (!stores.rows[0]) throw new HttpException({ code: 'NO_STORE', message: 'user has no active store membership' }, 403);
      const selected = stores.rows[0];
      const role = selected.role as Role;
      const permissions = ROLE_PERMISSIONS[role] ?? [];
      const accessToken = await signAccess(cfg.JWT_ACCESS_SECRET, cfg.JWT_ACCESS_TTL, {
        sub: user.id, merchantId: user.merchant_id, storeId: selected.store_id, role, permissions,
      });

      const newJti = ulid();
      const refreshToken = await signRefresh(cfg.JWT_REFRESH_SECRET, cfg.JWT_REFRESH_TTL, {
        sub: user.id, jti: newJti, storeId: selected.store_id,
      });
      await c.query(`UPDATE refresh_tokens SET revoked_at = now() WHERE jti = $1`, [claims.jti]);
      await c.query(
        `INSERT INTO refresh_tokens (jti, user_id, expires_at)
         VALUES ($1, $2, now() + ($3::bigint * interval '1 millisecond'))`,
        [newJti, user.id, ttlToMs(cfg.JWT_REFRESH_TTL)],
      );
      return { accessToken, refreshToken, expiresIn: cfg.JWT_ACCESS_TTL };
    });
  }

  @Public()
  @Post('logout')
  async logout(@Body() body: unknown) {
    const parsed = RefreshInput.parse(body);
    try {
      const claims = await verifyRefresh(loadConfig().JWT_REFRESH_SECRET, parsed.refreshToken);
      await query(`UPDATE refresh_tokens SET revoked_at = now() WHERE jti = $1 AND revoked_at IS NULL`, [claims.jti]);
    } catch { /* invalid token: idempotent logout */ }
    return { ok: true };
  }

  /**
   * Public registration is allowed ONLY for the first user of a merchant, and
   * the role is forced to OWNER. Subsequent users must be created by an OWNER
   * via the bin/create-user.js script (or a future admin endpoint).
   * This prevents an attacker from creating arbitrary accounts in a known merchant.
   */
  @Public()
  @Post('register')
  async register(@Body() body: unknown) {
    const parsed = RegisterInput.parse(body);
    const id = ulid();
    const hash = await hashPasswordAsync(parsed.password);
    const result = await withTx(async (c) => {
      // Check if any user already exists for this merchant.
      const existing = await c.query<{ count: string }>(
        `SELECT count(*)::text FROM users WHERE merchant_id = $1`, [parsed.merchantId]);
      const userCount = parseInt(existing.rows[0]?.count ?? '0', 10);
      // Force OWNER for first user; reject otherwise (use create-user.js for additional users).
      const role = userCount === 0 ? 'OWNER' : 'CASHIER';
      if (userCount > 0) {
        throw new HttpException({ code: 'REGISTRATION_CLOSED', message: 'public registration closed; use bin/create-user.js to add users' }, 403);
      }
      // First user must be OWNER.
      if (parsed.role !== 'OWNER') {
        throw new HttpException({ code: 'FIRST_USER_MUST_BE_OWNER', message: 'first user of a merchant must be OWNER' }, 400);
      }
      const r = await c.query<{ id: string }>(
        `INSERT INTO users (id, merchant_id, email, name, password_hash) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (merchant_id, email) DO NOTHING RETURNING id`,
        [id, parsed.merchantId, parsed.email, parsed.name, hash]);
      if (!r.rows[0]) throw new HttpException({ code: 'EMAIL_TAKEN', message: 'email already exists' }, 409);
      await c.query(
        `INSERT INTO store_memberships (id, user_id, store_id, merchant_id, role, is_default) VALUES ($1, $2, $3, $4, $5, true)`,
        [ulid(), id, parsed.storeId, parsed.merchantId, role]);
      return r.rows[0];
    });
    return { id: result.id };
  }

  @UseGuards(AuthGuard, PermissionsGuard)
  @Get('me')
  async me(@Req() req: any) { return req.auth; }
}
