// In-memory sliding-window rate limiter for sensitive endpoints.
//
// Designed for a single-process api (the deployment target). State is kept
// in process memory; if you scale to multiple replicas, replace the Map
// with a Redis-backed counter (the interface is intentionally tiny).
//
// The limiter is best-effort: a hard process crash clears the counters
// and a determined attacker can rotate IPs. It is a defense against
// opportunistic credential stuffing, not a substitute for an actual
// WAF or upstream rate-limit service.
import type { Request, Response, NextFunction } from 'express';
import { loadConfig } from '../config/config.js';

type Bucket = {
  // Each entry is the wall-clock millis when a request was counted.
  // Older entries are dropped on every check.
  timestamps: number[];
};

const buckets: Map<string, Bucket> = new Map();

// Periodic cleanup so the Map does not grow unbounded when one IP makes
// a few requests and never returns. Runs every 5 minutes.
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
const cleanupTimer = setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of buckets) {
    bucket.timestamps = bucket.timestamps.filter((t) => now - t < 10 * 60 * 1000);
    if (bucket.timestamps.length === 0) buckets.delete(key);
  }
}, CLEANUP_INTERVAL_MS);
cleanupTimer.unref?.();

function clientIp(req: Request): string {
  // We do NOT trust X-Forwarded-For here. The api only honors forwarded
  // headers when the request originates from a TRUSTED_PROXIES entry,
  // which is enforced in a separate middleware. For rate limiting we
  // use the immediate peer, which is the right choice for an api that
  // sits behind a reverse proxy that already enforces per-IP fairness.
  return (req.ip || req.socket.remoteAddress || 'unknown').toString();
}

function checkAndRecord(key: string, windowMs: number, max: number): { allowed: boolean; remaining: number; resetMs: number } {
  const now = Date.now();
  let bucket = buckets.get(key);
  if (!bucket) {
    bucket = { timestamps: [] };
    buckets.set(key, bucket);
  }
  // Drop timestamps outside the window.
  bucket.timestamps = bucket.timestamps.filter((t) => now - t < windowMs);
  if (bucket.timestamps.length >= max) {
    const oldest = bucket.timestamps[0];
    return { allowed: false, remaining: 0, resetMs: Math.max(0, windowMs - (now - oldest)) };
  }
  bucket.timestamps.push(now);
  return {
    allowed: true,
    remaining: max - bucket.timestamps.length,
    resetMs: windowMs,
  };
}

/**
 * Express middleware factory: per-IP sliding-window rate limit.
 *
 * Usage:
 *   router.post('/login', rateLimit({ windowMs: 60_000, max: 10 }), handler);
 */
export function rateLimit(opts: { windowMs: number; max: number; name?: string }) {
  const { windowMs, max, name = 'default' } = opts;
  return function rateLimitMiddleware(req: Request, res: Response, next: NextFunction) {
    const cfg = loadConfig();
    if (!cfg.RATE_LIMIT_ENABLED) return next();
    const ip = clientIp(req);
    const key = `${name}:${ip}`;
    const result = checkAndRecord(key, windowMs, max);
    res.setHeader('X-RateLimit-Limit', String(max));
    res.setHeader('X-RateLimit-Remaining', String(result.remaining));
    res.setHeader('X-RateLimit-Reset', String(Math.ceil(result.resetMs / 1000)));
    if (!result.allowed) {
      res.setHeader('Retry-After', String(Math.ceil(result.resetMs / 1000)));
      return res.status(429).json({
        statusCode: 429,
        error: 'Too Many Requests',
        message: 'Rate limit exceeded. Try again in a few seconds.',
      });
    }
    next();
  };
}

/**
 * Convenience: rate-limit for /auth/login and /auth/refresh using the
 * config-driven defaults. 10 per minute per IP is enough for a
 * forgetful operator and a normal cashier, but not enough to brute
 * force a 6-character password offline.
 */
export function rateLimitAuth() {
  const cfg = loadConfig();
  return rateLimit({
    name: 'auth',
    windowMs: cfg.RATE_LIMIT_AUTH_WINDOW_SECONDS * 1000,
    max: cfg.RATE_LIMIT_AUTH_MAX_REQUESTS,
  });
}

/** Tighter limit for /auth/register. */
export function rateLimitRegister() {
  const cfg = loadConfig();
  return rateLimit({
    name: 'auth-register',
    windowMs: cfg.RATE_LIMIT_AUTH_WINDOW_SECONDS * 1000,
    max: cfg.RATE_LIMIT_REGISTER_MAX_REQUESTS,
  });
}

/** Test-only: clear all counters. */
export function _resetRateLimitForTesting(): void {
  buckets.clear();
}
