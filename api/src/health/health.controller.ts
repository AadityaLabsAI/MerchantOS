// Liveness + readiness. Public, no auth.
import { Controller, Get, Module } from '@nestjs/common';
import { Public } from '../auth/auth.guard.js';
import { query } from '../db/db.js';

@Controller('healthz')
export class HealthController {
  @Public()
  @Get()
  async health() {
    let db = false;
    try { await query('SELECT 1'); db = true; } catch {}
    return { status: db ? 'ok' : 'degraded', db, time: new Date().toISOString() };
  }
}
