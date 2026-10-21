// Payment service: state machine + in-house provider (no third-party).
// Webhook signature is HMAC-SHA256 over `<ts>.<rawBody>`. Idempotent on (session_id, event_id).
import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { ulid, generateOpaqueSecret, verifyWebhookSignature, signWebhookBody } from '@merchantos/crypto';
import { moneyFromMinor } from '@merchantos/money';
import { canTransition, type PaymentState } from '@merchantos/payments';
import { query, withTx } from '../db/db.js';
import { loadConfig } from '../config/config.js';

interface PaymentEvent {
  eventId: string;
  type: 'payment.succeeded' | 'payment.failed' | 'payment.processing' | 'payment.expired' | 'payment.refunded' | 'payment.cancelled';
  providerSessionId: string;
  providerPaymentId?: string;
  amount: { currency: string; minor: bigint };
  occurredAt: Date;
  raw: unknown;
}

@Injectable()
export class PaymentService {
  private logger = new Logger('PaymentService');

  /**
   * Create a payment session. The amount is the authoritative total; the merchant
   * must call this with a value that matches the bill. The webhooked amount is
   * verified against the session amount to prevent tampering.
   */
  async createSession(opts: {
    merchantId: string; storeId: string; deviceId?: string;
    billId?: string; customerId?: string; amount: { currency: string; minor: bigint };
    description?: string; ttlSeconds: number;
  }): Promise<{ id: string; paymentToken: string; providerSessionId: string; expiresAt: Date; amount: { currency: string; minor: string } }> {
    if (opts.amount.minor <= 0n) throw new BadRequestException('amount must be positive');
    if (opts.amount.currency.length !== 3) throw new BadRequestException('currency must be 3-letter code');
    const cfg = loadConfig();
    const id = ulid();
    const providerSessionId = `psess_${ulid()}`;
    const paymentToken = `PAY-${generateOpaqueSecret(32)}`;
    const expiresAt = new Date(Date.now() + opts.ttlSeconds * 1000);
    await query(
      `INSERT INTO payment_sessions (id, payment_token, merchant_id, store_id, device_id, bill_id, customer_id, provider, provider_session_id, amount_minor, currency, description, state, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'local', $8, $9, $10, $11, 'CREATED', $12)`,
      [id, paymentToken, opts.merchantId, opts.storeId, opts.deviceId ?? null, opts.billId ?? null, opts.customerId ?? null,
       providerSessionId, opts.amount.minor.toString(), opts.amount.currency, opts.description ?? null, expiresAt]);
    return { id, paymentToken, providerSessionId, expiresAt,
      amount: { currency: opts.amount.currency, minor: opts.amount.minor.toString() } };
  }

  async getByToken(token: string): Promise<{
    id: string; amount: { currency: string; minor: string }; description: string | null; expiresAt: Date; state: PaymentState; merchantId: string; storeId: string;
  }> {
    // Expire unpaid sessions on access; a link never remains payable indefinitely.
    await query(
      `UPDATE payment_sessions SET state = 'EXPIRED'
        WHERE payment_token = $1 AND state IN ('CREATED', 'PENDING', 'PROCESSING') AND expires_at <= now()`,
      [token],
    );
    const r = await query(
      `SELECT id, amount_minor, currency, description, expires_at, state, merchant_id, store_id
         FROM payment_sessions WHERE payment_token = $1`, [token]);
    if (!r.rows[0]) throw new NotFoundException('payment session not found');
    const s = r.rows[0];
    return { id: s.id, amount: { currency: s.currency, minor: s.amount_minor }, description: s.description,
      expiresAt: s.expires_at, state: s.state, merchantId: s.merchant_id, storeId: s.store_id };
  }

  async getStorePaymentSettings(merchantId: string, storeId: string): Promise<{
    upiVpa: string; payeeName: string; phone: string | null;
  } | null> {
    const r = await query<{ upi_vpa: string; payee_name: string; phone: string | null }>(
      `SELECT upi_vpa, payee_name, phone
         FROM store_payment_settings
        WHERE merchant_id = $1 AND store_id = $2`,
      [merchantId, storeId],
    );
    const row = r.rows[0];
    return row ? { upiVpa: row.upi_vpa, payeeName: row.payee_name, phone: row.phone } : null;
  }

  async saveStorePaymentSettings(opts: {
    merchantId: string; storeId: string; upiVpa: string; payeeName: string; phone: string | null;
  }): Promise<{ upiVpa: string; payeeName: string; phone: string | null }> {
    const r = await query<{ upi_vpa: string; payee_name: string; phone: string | null }>(
      `INSERT INTO store_payment_settings (store_id, merchant_id, upi_vpa, payee_name, phone)
       SELECT s.id, s.merchant_id, $3, $4, $5
         FROM stores s
        WHERE s.id = $1 AND s.merchant_id = $2
       ON CONFLICT (store_id) DO UPDATE
         SET upi_vpa = EXCLUDED.upi_vpa,
             payee_name = EXCLUDED.payee_name,
             phone = EXCLUDED.phone,
             updated_at = now()
         WHERE store_payment_settings.merchant_id = EXCLUDED.merchant_id
       RETURNING upi_vpa, payee_name, phone`,
      [opts.storeId, opts.merchantId, opts.upiVpa, opts.payeeName, opts.phone],
    );
    const row = r.rows[0];
    if (!row) throw new NotFoundException('store not found for this merchant');
    return { upiVpa: row.upi_vpa, payeeName: row.payee_name, phone: row.phone };
  }

  /**
   * Idempotent webhook handler. Walks the state machine forward; never backwards.
   * Duplicate eventIds (same provider_event_id) are no-ops.
   * On VERIFIED, writes a payment row and a notification_events outbox row.
   */
  async handleWebhook(event: PaymentEvent): Promise<{ status: 'ok' | 'duplicate'; eventType: string; newState: PaymentState }> {
    return withTx(async (c) => {
      // Lock the session row so concurrent webhooks serialize.
      const sres = await c.query<{ id: string; merchant_id: string; store_id: string; amount_minor: string; currency: string; state: PaymentState }>(
        `SELECT id, merchant_id, store_id, amount_minor, currency, state
           FROM payment_sessions WHERE provider_session_id = $1 FOR UPDATE`, [event.providerSessionId]);
      if (!sres.rows[0]) throw new NotFoundException('unknown session');
      const session = sres.rows[0];

      // Idempotency check on eventId
      const dup = await c.query(`SELECT id FROM payment_events WHERE payment_session_id = $1 AND provider_event_id = $2`,
        [session.id, event.eventId]);
      if ((dup.rowCount ?? 0) > 0) {
        return { status: 'duplicate', eventType: event.type, newState: session.state };
      }

      // Authoritative amount check: webhook amount MUST equal session amount.
      if (BigInt(session.amount_minor) !== event.amount.minor || session.currency !== event.amount.currency) {
        throw new BadRequestException('amount or currency mismatch');
      }

      // Compute the target state by walking the legal transitions from the current state.
      let targetState: PaymentState = session.state;
      switch (event.type) {
        case 'payment.succeeded': {
          if (!event.providerPaymentId) throw new BadRequestException('missing provider payment id');
          for (const step of ['PENDING', 'PROCESSING', 'SUCCESS', 'VERIFIED'] as PaymentState[]) {
            if (canTransition(targetState, step)) targetState = transitionFn(targetState, step);
          }
          break;
        }
        case 'payment.processing': {
          if (canTransition(targetState, 'PROCESSING')) targetState = transitionFn(targetState, 'PROCESSING');
          break;
        }
        case 'payment.failed': {
          if (canTransition(targetState, 'FAILED')) targetState = transitionFn(targetState, 'FAILED');
          break;
        }
        case 'payment.expired': {
          if (canTransition(targetState, 'EXPIRED')) targetState = transitionFn(targetState, 'EXPIRED');
          break;
        }
        case 'payment.cancelled': {
          if (canTransition(targetState, 'CANCELLED')) targetState = transitionFn(targetState, 'CANCELLED');
          break;
        }
        case 'payment.refunded': {
          if (canTransition(targetState, 'REFUNDED')) targetState = transitionFn(targetState, 'REFUNDED');
          break;
        }
        default:
          throw new BadRequestException(`unknown event type: ${event.type}`);
      }

      // Insert payment_events row (audit log of the provider's call)
      await c.query(
        `INSERT INTO payment_events (id, payment_session_id, provider_event_id, event_type, previous_state, new_state, amount_minor, currency, raw, occurred_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [ulid(), session.id, event.eventId, event.type, session.state, targetState,
         event.amount.minor.toString(), event.amount.currency, JSON.stringify(event.raw), event.occurredAt]);

      // Update the session with state-specific fields.
      const now = new Date();
      if (event.type === 'payment.succeeded') {
        await c.query(
          `UPDATE payment_sessions SET state = $1, paid_at = COALESCE(paid_at, $2), verified_at = $2, provider_payment_id = $3, updated_at = now() WHERE id = $4`,
          [targetState, now, event.providerPaymentId, session.id]);
      } else if (event.type === 'payment.failed') {
        await c.query(
          `UPDATE payment_sessions SET state = $1, failed_at = $2, failure_reason = $3, updated_at = now() WHERE id = $4`,
          [targetState, now, 'declined by provider', session.id]);
      } else if (event.type === 'payment.expired') {
        await c.query(
          `UPDATE payment_sessions SET state = $1, updated_at = now() WHERE id = $2`,
          [targetState, session.id]);
      } else {
        await c.query(
          `UPDATE payment_sessions SET state = $1, updated_at = now() WHERE id = $2`,
          [targetState, session.id]);
      }

      // Side effects: payment row + notification outbox on VERIFIED.
      if (targetState === 'VERIFIED' && event.providerPaymentId) {
        await c.query(
          `INSERT INTO payments (id, payment_session_id, merchant_id, provider, provider_payment_id, amount_minor, currency, payment_method, paid_at, verified_at, raw_provider)
           VALUES ($1, $2, $3, 'local', $4, $5, $6, $7, $8, $8, $9)
           ON CONFLICT (payment_session_id) DO NOTHING`,
          [ulid(), session.id, session.merchant_id, event.providerPaymentId,
           event.amount.minor.toString(), event.amount.currency, 'sandbox', now, JSON.stringify(event.raw)]);
        await c.query(
          `INSERT INTO notification_events (id, merchant_id, store_id, event_type, dedup_key, payload)
           VALUES ($1, $2, $3, 'payment.verified', $4, $5) ON CONFLICT (dedup_key) DO NOTHING`,
          [ulid(), session.merchant_id, session.store_id, `payment.verified:${session.id}`,
           JSON.stringify({ amount: { currency: event.amount.currency, minor: event.amount.minor.toString() },
             sessionId: session.id, providerPaymentId: event.providerPaymentId })]);
      }
      return { status: 'ok', eventType: event.type, newState: targetState };
    });
  }

  /**
   * In-house simulator. Constructs a valid signed webhook payload for a session
   * so the dev/test runner can drive the full flow without a real provider.
   * Refuses to run in production.
   */
  async simulate(opts: { providerSessionId: string; type: 'payment.succeeded' }): Promise<{ rawBody: string; headers: Record<string, string> }> {
    if (process.env.NODE_ENV === 'production') throw new Error('simulator disabled in production');
    const cfg = loadConfig();
    const r = await query<{ id: string; merchant_id: string; store_id: string; amount_minor: string; currency: string; state: PaymentState; expires_at: Date }>(
      `SELECT id, merchant_id, store_id, amount_minor, currency, state, expires_at FROM payment_sessions WHERE provider_session_id = $1`, [opts.providerSessionId]);
    if (!r.rows[0]) throw new NotFoundException('session not found');
    const s = r.rows[0];
    if (s.state === 'EXPIRED' || new Date(s.expires_at).getTime() <= Date.now()) {
      throw new BadRequestException('payment session expired');
    }
    if (s.state === 'VERIFIED' || s.state === 'SUCCESS' || s.state === 'REFUNDED') {
      throw new BadRequestException('payment session is already completed');
    }
    const providerPaymentId = `ppay_${ulid()}`;
    const eventId = `pevt_${ulid()}`;
    const occurredAt = new Date();
    // Use canonical JSON serialization: same key order, no whitespace, so the signature
    // we sign here matches what arrives at the webhook handler.
    const body = JSON.stringify({
      id: eventId,
      type: opts.type,
      providerSessionId: opts.providerSessionId,
      providerPaymentId,
      amount: { currency: s.currency, minor: s.amount_minor },
      occurredAt: occurredAt.toISOString(),
    });
    const ts = Math.floor(Date.now() / 1000);
    const sig = signWebhookBody(body, cfg.WEBHOOK_HMAC_SECRET, ts);
    return { rawBody: body, headers: { 'x-merchantos-signature': sig, 'x-merchantos-timestamp': String(ts) } };
  }

  verifyWebhook(opts: { body: string; signature: string; timestamp: number }): { verified: boolean; failureReason?: string } {
    const cfg = loadConfig();
    return verifyWebhookSignature({
      body: opts.body, signature: opts.signature, secret: cfg.WEBHOOK_HMAC_SECRET,
      timestamp: opts.timestamp, toleranceSeconds: cfg.WEBHOOK_TOLERANCE_SECONDS,
    });
  }
}

// Local helper: throws if transition is illegal. Throws before mutating state.
function transitionFn(from: PaymentState, to: PaymentState): PaymentState {
  if (!canTransition(from, to)) throw new BadRequestException(`illegal state transition: ${from} -> ${to}`);
  return to;
}
