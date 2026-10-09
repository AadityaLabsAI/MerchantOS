// Payment endpoints: session create, public pay page, webhook receiver.
import { Body, Controller, Get, Header, Module, Param, Post, Query, Req, Res, HttpException, BadRequestException, HttpCode, UseGuards } from '@nestjs/common';
import { CreatePaymentSessionInput } from '@merchantos/validation';
import { z } from 'zod';
import { PERMISSIONS } from '@merchantos/shared-types';
import { query } from '../db/db.js';
import { AuthGuard, Public } from '../auth/auth.guard.js';
import { Permissions, PermissionsGuard } from '../rbac/rbac.guard.js';
import { assertStoreAccess } from '../rbac/store-access.js';
import { loadConfig } from '../config/config.js';
import { PaymentService } from './payment.service.js';

const PaymentWebhookInput = z.object({
  id: z.string().min(1).max(200),
  type: z.enum(['payment.succeeded', 'payment.failed', 'payment.processing', 'payment.expired', 'payment.refunded', 'payment.cancelled']),
  providerSessionId: z.string().min(1).max(200),
  providerPaymentId: z.string().min(1).max(200).optional(),
  amount: z.object({ currency: z.string().length(3), minor: z.string().regex(/^\d+$/) }).strict(),
  occurredAt: z.string().datetime(),
}).strict();

@Controller('api/payments')
@UseGuards(AuthGuard, PermissionsGuard)
export class PaymentController {
  constructor(private readonly svc: PaymentService) {}

  @Post('sessions')
  @Permissions(PERMISSIONS.BILLING_CREATE)
  async create(@Req() req: any, @Body() body: unknown) {
    const p = CreatePaymentSessionInput.parse(body);
    // The session is created in the user's active store (from JWT). If the caller
    // wants a different store, they must switch stores via re-login.
    const storeId = req.auth.storeId;
    if (!storeId) throw new BadRequestException('no active store for this user');
    await assertStoreAccess(req.auth, storeId);
    const cfg = loadConfig();
    const result = await this.svc.createSession({
      merchantId: req.auth.merchantId, storeId, deviceId: p.deviceId,
      billId: p.billId, customerId: p.customerId, amount: { currency: p.amount.currency, minor: BigInt(p.amount.minor) },
      description: p.description, ttlSeconds: p.ttlSeconds ?? cfg.PAYMENT_DEFAULT_TTL_SECONDS,
    });
    return { id: result.id, paymentToken: result.paymentToken, expiresAt: result.expiresAt,
      amount: { currency: result.amount.currency, minor: result.amount.minor } };
  }
}

const PAY_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Pay · MerchantOS</title>
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body { margin: 0; font: 15px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
         color: #e9ecf8;
         background: radial-gradient(1000px 600px at 0% 0%, #1b2356 0%, transparent 60%),
                     radial-gradient(900px 500px at 100% 100%, #1b2756 0%, transparent 60%), #0b1020;
         min-height: 100vh; display: grid; place-items: center; padding: 20px; }
  .card { background: rgba(20,26,54,0.7); backdrop-filter: blur(8px); border: 1px solid #2a3360; border-radius: 18px; padding: 32px; max-width: 420px; width: 100%; text-align: center; box-shadow: 0 12px 40px -12px rgba(0,0,0,0.6); }
  .brand { display: inline-flex; align-items: center; gap: 8px; padding: 6px 12px; background: rgba(124,92,255,0.12); border: 1px solid rgba(124,92,255,0.3); border-radius: 999px; font-size: 12px; color: #a78bfa; margin-bottom: 20px; font-weight: 600; }
  .amt { font-size: 56px; font-weight: 800; margin: 8px 0 4px; background: linear-gradient(135deg, #7c5cff, #22d3ee); -webkit-background-clip: text; background-clip: text; color: transparent; letter-spacing: -0.02em; line-height: 1; }
  .desc { color: #98a0c5; font-size: 14px; margin-bottom: 20px; }
  .state { display: inline-block; padding: 6px 14px; border-radius: 999px; font-size: 12px; font-weight: 700; margin: 8px 0 24px; text-transform: uppercase; letter-spacing: 0.05em; }
  .state.pending { background: rgba(245,158,11,0.12); color: #f59e0b; border: 1px solid rgba(245,158,11,0.3); }
  .state.verified { background: rgba(34,197,94,0.12); color: #22c55e; border: 1px solid rgba(34,197,94,0.3); }
  .state.failed, .state.cancelled, .state.expired { background: rgba(239,68,68,0.12); color: #ef4444; border: 1px solid rgba(239,68,68,0.3); }
  .state.processing { background: rgba(34,211,238,0.12); color: #22d3ee; border: 1px solid rgba(34,211,238,0.3); }
  button { width: 100%; padding: 14px; border: 0; border-radius: 12px; background: linear-gradient(135deg, #7c5cff 0%, #5a3ee0 100%); color: white; font-size: 15px; font-weight: 700; cursor: pointer; box-shadow: 0 8px 20px -8px rgba(124,92,255,0.6); transition: transform .1s; }
  button:hover { transform: translateY(-1px); }
  button:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }
  .info { font-size: 12px; color: #6f779e; margin-top: 16px; }
  .secure { display: inline-flex; align-items: center; gap: 4px; font-size: 11px; color: #6f779e; margin-top: 12px; }
</style>
</head>
<body>
<div class="card">
  <div class="brand">💼 MerchantOS · SANDBOX DEMO</div>
  <div id="statePill" class="state pending">Loading...</div>
  <div class="amt" id="amt">—</div>
  <div class="desc" id="desc"></div>
  <button id="btn" disabled>Pay now</button>
  <div class="info" id="info"></div>
  <div class="secure">DEMO ONLY · No real payment is collected</div>
</div>
<script>
const token = location.pathname.split('/').pop();

async function load() {
  try {
    const r = await fetch('/pay/' + token, { headers: { 'Accept': 'application/json' }});
    if (!r.ok) { document.getElementById('statePill').className = 'state failed'; document.getElementById('statePill').textContent = 'Not found'; return; }
    const p = await r.json();
    const minor = Number(p.amount.minor);
    document.getElementById('amt').textContent = '₹' + (minor/100).toLocaleString('en-IN', { minimumFractionDigits: 2 });
    document.getElementById('desc').textContent = p.description || 'Payment to merchant';
    const stateMap = { CREATED: ['pending','Awaiting payment'], PENDING: ['pending','Pending'], PROCESSING: ['processing','Processing'], SUCCESS: ['verified','Paid'], VERIFIED: ['verified','Payment verified'], FAILED: ['failed','Failed'], EXPIRED: ['expired','Expired'], REFUNDED: ['expired','Refunded'], CANCELLED: ['cancelled','Cancelled'] };
    const [cls, label] = stateMap[p.state] || ['pending', p.state];
    const pill = document.getElementById('statePill');
    pill.className = 'state ' + cls;
    pill.textContent = label;
    const btn = document.getElementById('btn');
    if (p.state === 'VERIFIED' || p.state === 'SUCCESS') { btn.textContent = '✓ Paid'; btn.disabled = true; }
    else if (p.state === 'CREATED' || p.state === 'PENDING') { btn.textContent = 'Simulate demo payment'; btn.disabled = false; btn.onclick = simulate; }
    else { btn.textContent = '—'; btn.disabled = true; }
    const exp = new Date(p.expiresAt);
    document.getElementById('info').textContent = (p.state === 'CREATED' || p.state === 'PENDING') ? 'Expires ' + exp.toLocaleString() : '';
  } catch (e) {
    document.getElementById('statePill').className = 'state failed';
    document.getElementById('statePill').textContent = 'Error';
  }
}

async function simulate() {
  const btn = document.getElementById('btn');
  btn.disabled = true; btn.textContent = 'Verifying...';
  try {
    const r = await fetch('/api/dev/simulate-success?token=' + token, { method: 'POST' });
    if (r.ok) { setTimeout(load, 500); }
    else { btn.textContent = 'Try again'; btn.disabled = false; }
  } catch { btn.textContent = 'Network error'; btn.disabled = false; }
}

load();
setInterval(load, 4000);
</script>
</body>
</html>`;

@Controller('pay')
export class PayPageController {
  constructor(private readonly svc: PaymentService) {}

  // Public pay page. Returns HTML for browsers, JSON for API clients.
  @Public()
  @Get(':token')
  async getByToken(@Param('token') token: string, @Req() req: any, @Res({ passthrough: true }) res: any) {
    const p = await this.svc.getByToken(token);
    const accept = (req?.headers?.accept || '').toLowerCase();
    if (accept.includes('text/html')) {
      res.header('content-type', 'text/html; charset=utf-8');
      return PAY_HTML;
    }
    return { amount: p.amount, description: p.description, expiresAt: p.expiresAt, state: p.state };
  }
}

@Controller('api/webhooks/payments')
export class WebhookController {
  constructor(private readonly svc: PaymentService) {}

  @Public()
  @Post()
  @HttpCode(200)
  async handle(@Req() req: any) {
    const sig = req.headers['x-merchantos-signature'];
    const ts = Number(req.headers['x-merchantos-timestamp']);
    if (!sig || !ts) throw new HttpException({ code: 'MISSING_SIGNATURE', message: 'missing webhook signature or timestamp' }, 401);
    const body = (req.rawBody ?? Buffer.alloc(0)).toString('utf8');
    const verify = this.svc.verifyWebhook({ body, signature: String(sig), timestamp: ts });
    if (!verify.verified) throw new HttpException({ code: 'INVALID_SIGNATURE', message: `signature invalid: ${verify.failureReason}` }, 401);
    let decoded: unknown;
    try { decoded = JSON.parse(body); }
    catch { throw new BadRequestException('invalid webhook JSON'); }
    const payload = PaymentWebhookInput.parse(decoded);
    const result = await this.svc.handleWebhook({
      eventId: payload.id,
      type: payload.type,
      providerSessionId: payload.providerSessionId,
      providerPaymentId: payload.providerPaymentId,
      amount: { currency: payload.amount.currency, minor: BigInt(payload.amount.minor) },
      occurredAt: new Date(payload.occurredAt),
      raw: payload,
    });
    return { received: true, status: result.status, newState: result.newState };
  }
}

/** Dev-only simulator. Refuses to run in production. */
@Controller('api/dev')
export class DevSimulateController {
  constructor(private readonly svc: PaymentService) {}

  @Public()
  @Post('simulate-success')
  async simulate(@Query('token') token: string) {
    const cfg = loadConfig();
    if (cfg.NODE_ENV === 'production' || !cfg.ENABLE_PAYMENT_SIMULATOR) {
      throw new HttpException({ code: 'SIMULATOR_DISABLED', message: 'sandbox payment simulation is disabled' }, 404);
    }
    if (!token) throw new BadRequestException('token required');
    const r = await query<{ provider_session_id: string; store_id: string; merchant_id: string }>(
      `SELECT provider_session_id, store_id, merchant_id FROM payment_sessions WHERE payment_token = $1`, [token]);
    if (!r.rows[0]) throw new HttpException({ code: 'NOT_FOUND', message: 'session not found' }, 404);
    const sim = await this.svc.simulate({ providerSessionId: r.rows[0].provider_session_id, type: 'payment.succeeded' });
    const url = `${loadConfig().API_BASE_URL}/api/webhooks/payments`;
    const resp = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', ...sim.headers }, body: sim.rawBody });
    await resp.text().catch(() => undefined);
    return { ok: resp.ok, status: resp.status };
  }
}

@Module({
  controllers: [PaymentController, PayPageController, WebhookController, DevSimulateController],
  providers: [PaymentService],
  exports: [PaymentService],
})
export class PaymentModule {}
