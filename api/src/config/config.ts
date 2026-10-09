// Env-driven config. Validated on first access.
import { z } from 'zod';

const Schema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),

  DATABASE_URL: z.string().min(1),
  DATABASE_SSL: z.preprocess(
    (v) => v === undefined ? false : (typeof v === 'string' ? v.toLowerCase() !== 'false' && v !== '0' : v),
    z.boolean()
  ).default(false),
  DATABASE_POOL_MIN: z.coerce.number().int().nonnegative().default(1),
  DATABASE_POOL_MAX: z.coerce.number().int().positive().default(10),

  // JWT secrets must be at least 32 bytes (256 bits) — recommended for HS256.
  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be >= 32 chars'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be >= 32 chars'),
  // Refresh secret must differ from access secret. Otherwise a leaked access token = refresh.
  ...(process.env.JWT_ACCESS_SECRET === process.env.JWT_REFRESH_SECRET
    ? { __invalid: z.literal('reject') } : {}),
  JWT_ACCESS_TTL: z.string().regex(/^\d+(ms|s|m|h|d)$/, 'JWT_ACCESS_TTL must be like 15m').default('15m'),
  JWT_REFRESH_TTL: z.string().regex(/^\d+(ms|s|m|h|d)$/, 'JWT_REFRESH_TTL must be like 30d').default('30d'),

  WEBHOOK_HMAC_SECRET: z.string().min(32, 'WEBHOOK_HMAC_SECRET must be >= 32 chars'),
  WEBHOOK_TOLERANCE_SECONDS: z.coerce.number().int().nonnegative().default(300),

  API_BASE_URL: z.string().url().default('http://localhost:4000'),
  WEB_BASE_URL: z.string().url().default('http://localhost:3000'),
  CORS_ORIGINS: z.string().default(''),
  // Comma-separated exact proxy IPs/CIDRs trusted for forwarded headers. Empty means trust none.
  TRUSTED_PROXIES: z.string().default(''),

  PAYMENT_DEFAULT_TTL_SECONDS: z.coerce.number().int().positive().default(600),

  // AI defaults to OFF so the API boots cleanly without Ollama.
  // Operators explicitly opt in by setting AI_ENABLED=true in .env.
  OLLAMA_BASE_URL: z.string().url().default('http://127.0.0.1:11434'),
  OLLAMA_MODEL: z.string().default('llama3.1:8b-instruct-q5_K_M'),
  AI_ENABLED: z.preprocess(
    (v) => v === undefined ? false : (typeof v === 'string' ? v.toLowerCase() !== 'false' && v !== '0' : v),
    z.boolean()
  ).default(false),
  // AI request timeout in seconds — protects against Ollama hanging.
  AI_TIMEOUT_SECONDS: z.coerce.number().int().positive().default(20),
});

export type AppConfig = z.infer<typeof Schema>;

let _cfg: AppConfig | null = null;

export function loadConfig(): AppConfig {
  if (_cfg) return _cfg;
  const parsed = Schema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  _cfg = parsed.data;
  return _cfg;
}

/** Test-only: clear the cached config so .env changes take effect. */
export function _resetConfigForTesting(): void { _cfg = null; }
