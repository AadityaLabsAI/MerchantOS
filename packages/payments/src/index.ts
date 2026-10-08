// In-house payment state machine. No third-party gateway.
// State transitions follow the spec encoded in TRANSITIONS below.

import { Money } from '@merchantos/money';

export type PaymentState =
  | 'CREATED' | 'PENDING' | 'PROCESSING' | 'SUCCESS' | 'VERIFIED' | 'FAILED' | 'EXPIRED' | 'CANCELLED' | 'REFUNDED';

export const TRANSITIONS: Record<PaymentState, PaymentState[]> = {
  CREATED:     ['PENDING', 'EXPIRED', 'CANCELLED'],
  PENDING:     ['PROCESSING', 'FAILED', 'EXPIRED', 'CANCELLED'],
  PROCESSING:  ['SUCCESS', 'FAILED', 'EXPIRED'],
  SUCCESS:     ['VERIFIED', 'FAILED'],
  VERIFIED:    ['REFUNDED'],
  FAILED:      [],
  EXPIRED:     [],
  CANCELLED:   [],
  REFUNDED:    [],
};

export function canTransition(from: PaymentState, to: PaymentState): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export function transition(from: PaymentState, to: PaymentState): PaymentState {
  if (!canTransition(from, to)) {
    throw new Error(`illegal transition: ${from} -> ${to}`);
  }
  return to;
}

export interface PaymentEvent {
  eventId: string;
  type: 'payment.processing' | 'payment.succeeded' | 'payment.failed' | 'payment.expired' | 'payment.refunded' | 'payment.cancelled';
  providerSessionId: string;
  providerPaymentId?: string;
  amount: Money;
  occurredAt: Date;
  raw: unknown;
}

export function nowExpiry(ttlSeconds: number): Date {
  return new Date(Date.now() + ttlSeconds * 1000);
}
