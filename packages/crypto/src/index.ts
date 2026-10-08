// Local-only crypto helpers. Uses Node 20 built-ins (crypto, zlib).
// Zero third-party deps. HMAC-SHA256 webhook signatures, ULID, password hashing via scrypt.

import { createHmac, randomBytes, scrypt, scryptSync, timingSafeEqual, createHash } from 'node:crypto';

// --- ULID ------------------------------------------------------------------

const ENCODING = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const ENCODING_LEN = ENCODING.length;
const TIME_LEN = 10;
const RANDOM_LEN = 16;

function encodeTime(now: number): string {
  let mod: number;
  let time = now;
  let str = '';
  for (let i = TIME_LEN; i > 0; i--) {
    mod = time % ENCODING_LEN;
    str = ENCODING.charAt(mod) + str;
    time = (time - mod) / ENCODING_LEN;
  }
  return str;
}

function encodeRandom(len: number): string {
  let str = '';
  const bytes = randomBytes(len);
  for (let i = 0; i < len; i++) {
    str += ENCODING.charAt(bytes[i] % ENCODING_LEN);
  }
  return str;
}

export function ulid(): string {
  return encodeTime(Date.now()) + encodeRandom(RANDOM_LEN);
}

export function ulidFromTimestamp(timestamp: number): string {
  return encodeTime(timestamp) + encodeRandom(RANDOM_LEN);
}

// --- HMAC-SHA256 webhook signature ----------------------------------------

export function signWebhookBody(body: string, secret: string, ts: number): string {
  const payload = `${ts}.${body}`;
  return createHmac('sha256', secret).update(payload).digest('hex');
}

export function verifyWebhookSignature(opts: {
  body: string;
  signature: string;
  secret: string;
  timestamp: number;
  toleranceSeconds?: number;
}): { verified: boolean; failureReason?: string } {
  const tol = opts.toleranceSeconds ?? 300;
  const skew = Math.abs(Math.floor(Date.now() / 1000) - opts.timestamp);
  if (skew > tol) return { verified: false, failureReason: `timestamp skew ${skew}s > ${tol}s tolerance` };
  const expected = signWebhookBody(opts.body, opts.secret, opts.timestamp);
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(opts.signature, 'utf8');
  if (a.length !== b.length) return { verified: false, failureReason: 'length mismatch' };
  return { verified: timingSafeEqual(a, b), failureReason: undefined };
}

// --- Password hashing via scrypt (Node built-in, no external lib) ---------

const SCRYPT_KEYLEN = 64;
const SCRYPT_COST = 16384;
const SCRYPT_BLOCK = 8;
const SCRYPT_PARALLEL = 1;

export function hashPassword(plain: string): string {
  // Synchronous scrypt blocks the event loop. Use the async variant.
  // We provide a sync wrapper for backwards compatibility, but the recommended path
  // is hashPasswordAsync (used by the auth controller).
  const salt = randomBytes(16);
  const hash = scryptSync(plain, salt, SCRYPT_KEYLEN, { N: SCRYPT_COST, r: SCRYPT_BLOCK, p: SCRYPT_PARALLEL });
  return `scrypt$${SCRYPT_COST}$${SCRYPT_BLOCK}$${SCRYPT_PARALLEL}$${salt.toString('base64')}$${hash.toString('base64')}`;
}

export async function hashPasswordAsync(plain: string): Promise<string> {
  const salt = randomBytes(16);
  return new Promise((resolve, reject) => {
    scrypt(plain, salt, SCRYPT_KEYLEN, { N: SCRYPT_COST, r: SCRYPT_BLOCK, p: SCRYPT_PARALLEL }, (err, derivedKey) => {
      if (err) return reject(err);
      resolve(`scrypt$${SCRYPT_COST}$${SCRYPT_BLOCK}$${SCRYPT_PARALLEL}$${salt.toString('base64')}$${derivedKey.toString('base64')}`);
    });
  });
}

export function verifyPassword(plain: string, stored: string): boolean {
  // Synchronous; only used for non-blocking call sites (CLI, tests).
  try {
    const parts = stored.split('$');
    if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
    const N = Number(parts[1]);
    const r = Number(parts[2]);
    const p = Number(parts[3]);
    const salt = Buffer.from(parts[4], 'base64');
    const expected = Buffer.from(parts[5], 'base64');
    const got = scryptSync(plain, salt, expected.length, { N, r, p });
    return got.length === expected.length && timingSafeEqual(got, expected);
  } catch {
    return false;
  }
}

export async function verifyPasswordAsync(plain: string, stored: string): Promise<boolean> {
  try {
    const parts = stored.split('$');
    if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
    const N = Number(parts[1]);
    const r = Number(parts[2]);
    const p = Number(parts[3]);
    const salt = Buffer.from(parts[4], 'base64');
    const expected = Buffer.from(parts[5], 'base64');
    return new Promise((resolve, reject) => {
      scrypt(plain, salt, expected.length, { N, r, p }, (err, derivedKey) => {
        if (err) return reject(err);
        if (derivedKey.length !== expected.length) return resolve(false);
        resolve(timingSafeEqual(derivedKey, expected));
      });
    });
  } catch {
    return false;
  }
}

// --- API key generation ---------------------------------------------------

export function generateApiKey(): string { return 'mko_' + randomBytes(24).toString('base64url'); }
export function hashApiKey(key: string): string { return createHash('sha256').update(key).digest('hex'); }

// --- Random token for public payment URLs ---------------------------------

export function randomToken(groups = 4, groupLen = 4, sep = '-'): string {
  const out: string[] = [];
  for (let i = 0; i < groups; i++) {
    let g = '';
    const bytes = randomBytes(groupLen);
    for (let j = 0; j < groupLen; j++) g += ENCODING.charAt(bytes[j] % ENCODING_LEN);
    out.push(g);
  }
  return out.join(sep);
}

export function generateOpaqueSecret(bytes = 32): string { return randomBytes(bytes).toString('base64url'); }
