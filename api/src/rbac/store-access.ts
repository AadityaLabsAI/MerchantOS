// Store membership enforcement.
// Every protected endpoint that touches a store-scoped resource MUST call
// `assertStoreAccess(req.auth, storeId)` before any DB write/read.
// This prevents a user logged into store A from reading/writing store B
// even though both are in the same merchant.

import { ForbiddenException } from '@nestjs/common';
import { query } from '../db/db.js';
import type { AuthContext } from '@merchantos/shared-types';

// In-memory cache to avoid hitting the DB on every request.
// Key = userId, Value = { storeIds: Set<string>, expiresAt: number }
const CACHE_TTL_MS = 60_000;
const cache = new Map<string, { storeIds: Set<string>; expiresAt: number }>();

export function clearMembershipCache(userId?: string): void {
  if (userId) cache.delete(userId);
  else cache.clear();
}

/** Returns the set of storeIds the user has membership in. */
export async function getUserStoreIds(auth: AuthContext): Promise<Set<string>> {
  const now = Date.now();
  const cached = cache.get(auth.userId);
  if (cached && cached.expiresAt > now) return cached.storeIds;

  const r = await query<{ store_id: string }>(
    `SELECT store_id FROM store_memberships
       WHERE user_id = $1 AND merchant_id = $2 AND store_id IS NOT NULL`,
    [auth.userId, auth.merchantId],
  );
  const storeIds = new Set(r.rows.map((row) => row.store_id));
  cache.set(auth.userId, { storeIds, expiresAt: now + CACHE_TTL_MS });
  return storeIds;
}

/**
 * Asserts that the authenticated user has membership in the given store.
 * OWNER has implicit access to all stores in their merchant.
 * Throws ForbiddenException if not.
 */
export async function assertStoreAccess(auth: AuthContext, storeId: string): Promise<void> {
  if (!storeId || typeof storeId !== 'string') {
    throw new ForbiddenException('storeId required');
  }
  if (auth.role === 'OWNER') return; // OWNER bypass
  const storeIds = await getUserStoreIds(auth);
  if (!storeIds.has(storeId)) {
    throw new ForbiddenException('no access to this store');
  }
}

/**
 * Returns the list of storeIds the user can access (for list endpoints).
 */
export async function getAccessibleStoreIds(auth: AuthContext): Promise<string[]> {
  if (auth.role === 'OWNER') {
    const r = await query<{ id: string }>(
      `SELECT id FROM stores WHERE merchant_id = $1 ORDER BY name`,
      [auth.merchantId],
    );
    return r.rows.map((row) => row.id);
  }
  const storeIds = await getUserStoreIds(auth);
  return Array.from(storeIds);
}
