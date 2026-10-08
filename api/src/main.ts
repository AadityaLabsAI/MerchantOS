// Entry. Fastify + Nest + global guards.
import 'reflect-metadata';
import { NestFactory, Reflector } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { JwtService } from '@nestjs/jwt';
import { AppModule, buildAuthGuard, buildPermissionsGuard } from './app.module.js';
import { loadConfig } from './config/config.js';
import { closePool } from './db/db.js';
import { clearMembershipCache } from './rbac/store-access.js';

async function bootstrap() {
  const cfg = loadConfig();

  // 1 MB body limit. Bills with many lines can be large; a few KB is typical.
  // Increase if your catalog or bills need more.
  const adapter = new FastifyAdapter({
    logger: false,
    trustProxy: true,
    bodyLimit: 2 * 1024 * 1024, // 2 MB
    // Request timeouts prevent slow-loris attacks and runaway handlers.
    requestTimeout: 30_000,
    keepAliveTimeout: 60_000,
  });

  const app = await NestFactory.create<NestFastifyApplication>(AppModule, adapter, {
    bufferLogs: true,
    abortOnError: false,
  });

  // Register a preParsing hook to capture rawBody for webhook signature verification.
  const fastify = app.getHttpAdapter().getInstance() as any;
  fastify.addHook('preParsing', async (req: any, _reply: any, payload: any) => {
    if (req.url?.startsWith('/api/webhooks/')) {
      const chunks: Buffer[] = [];
      for await (const chunk of payload) chunks.push(chunk as Buffer);
      const raw = Buffer.concat(chunks);
      req.rawBody = raw;
      const { Readable } = await import('node:stream');
      return Readable.from(raw);
    }
    return payload;
  });

  // Security headers. Helmet-equivalent, hand-rolled to avoid extra deps.
  fastify.addHook('onSend', async (req: any, reply: any, payload: any) => {
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header('X-Frame-Options', 'DENY');
    reply.header('Referrer-Policy', 'no-referrer');
    reply.header('X-DNS-Prefetch-Control', 'off');
    reply.header('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
    if (cfg.NODE_ENV === 'production') {
      reply.header('Strict-Transport-Security', 'max-age=63072000; includeSubDomains');
    }
    return payload;
  });

  const reflector = app.get(Reflector);
  const jwt = app.get(JwtService);
  app.useGlobalGuards(buildAuthGuard(reflector, jwt), buildPermissionsGuard(reflector));

  const origins = cfg.CORS_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean);
  app.enableCors({
    origin: origins.length ? origins : false,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id', 'X-MerchantOS-Signature', 'X-MerchantOS-Timestamp'],
    maxAge: 86400,
  });

  await app.listen({ port: cfg.PORT, host: '0.0.0.0' });
  console.log(`[bootstrap] MerchantOS API listening on :${cfg.PORT} (env=${cfg.NODE_ENV})`);

  // Graceful shutdown. Drain in-flight requests, then close the DB pool.
  let shuttingDown = false;
  const shutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`[shutdown] received ${signal}, draining...`);
    try {
      clearMembershipCache(); // wipe mem-cache so next boot starts fresh
      await app.close();
      await closePool();
      console.log('[shutdown] done');
      process.exit(0);
    } catch (err) {
      console.error('[shutdown] error', err);
      process.exit(1);
    }
  };
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
  // Catch unhandled rejections and uncaught exceptions so the process doesn't silently die.
  process.on('unhandledRejection', (reason) => {
    console.error('[unhandledRejection]', reason);
  });
  process.on('uncaughtException', (err) => {
    console.error('[uncaughtException]', err);
    void shutdown('uncaughtException');
  });
}

bootstrap().catch((err) => { console.error(err); process.exit(1); });
