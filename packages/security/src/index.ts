// Simple in-memory token-bucket rate limiter.
// Per-process state is acceptable here because we are single-process by design
// (the API runs as one Node process; scale via multiple instances behind a load balancer
// and put a proxy-level rate limit in front).
export interface RateLimitOpts {
  windowMs: number;
  max: number;
}
export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  resetAt: number;
}

class Bucket {
  count = 0;
  resetAt = 0;
}

const buckets = new Map<string, Bucket>();

/** Returns true if the request is allowed, false if rate-limited. */
export function rateLimit(key: string, opts: RateLimitOpts): RateLimitResult {
  const now = Date.now();
  let b = buckets.get(key);
  if (!b || now >= b.resetAt) {
    b = new Bucket();
    b.count = 0;
    b.resetAt = now + opts.windowMs;
    buckets.set(key, b);
  }
  if (b.count >= opts.max) {
    return { ok: false, remaining: 0, resetAt: b.resetAt };
  }
  b.count++;
  return { ok: true, remaining: opts.max - b.count, resetAt: b.resetAt };
}

/** Periodic cleanup of stale buckets to avoid memory growth. */
let lastSweep = Date.now();
export function sweep(): void {
  const now = Date.now();
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [k, b] of buckets) {
    if (now >= b.resetAt) buckets.delete(k);
  }
}

/** Helper: derive a key from IP + endpoint. */
export function ipKey(ip: string | undefined, scope: string): string {
  return `${ip ?? 'unknown'}:${scope}`;
}
