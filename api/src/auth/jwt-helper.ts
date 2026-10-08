// Token sign/verify helpers + typed payloads.
import { JwtService } from '@nestjs/jwt';
import type { Permission, Role } from '@merchantos/shared-types';

export interface AccessTokenPayload {
  sub: string;
  merchantId: string;
  storeId: string | null;
  role: Role;
  permissions: Permission[];
  deviceId?: string | null;
  typ: 'access';
}

export interface RefreshTokenPayload {
  sub: string;
  jti: string;
  typ: 'refresh';
}

const _signer = new JwtService({});
const _verifier = new JwtService({});

export async function signAccess(secret: string, ttl: string, payload: Omit<AccessTokenPayload, 'typ'>): Promise<string> {
  return _signer.signAsync({ ...payload, typ: 'access' }, { secret, expiresIn: ttl as any });
}

export async function signRefresh(secret: string, ttl: string, payload: Omit<RefreshTokenPayload, 'typ'>): Promise<string> {
  return _signer.signAsync({ ...payload, typ: 'refresh' }, { secret, expiresIn: ttl as any });
}

export async function verifyAccess(secret: string, token: string): Promise<AccessTokenPayload> {
  const p = await _verifier.verifyAsync<AccessTokenPayload>(token, { secret });
  if (p.typ !== 'access') throw new Error('not an access token');
  return p;
}

export async function verifyRefresh(secret: string, token: string): Promise<RefreshTokenPayload> {
  const p = await _verifier.verifyAsync<RefreshTokenPayload>(token, { secret });
  if (p.typ !== 'refresh') throw new Error('not a refresh token');
  return p;
}
