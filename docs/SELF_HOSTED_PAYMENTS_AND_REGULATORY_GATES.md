# MerchantOS — Self-Hosted Payment Receiving Architecture and Regulatory Gates

**Status:** v1 boundary definition. Reflects the code in `database/migrations/` and the payment provider abstraction in `api/src/payment/`. Updated whenever a new payment integration lands.

---

## 1. The goal in plain language

MerchantOS should not require a merchant to create a Razorpay, Cashfree, PhonePe Business or other commercial payment-provider account just to use MerchantOS POS, inventory, Khata, customer/supplier ledgers, expenses, receipts, cash management, reports or self-hosted data storage.

MerchantOS is self-hostable and built from open-source tools. The server and core business data operate under the merchant/operator's control. Payment code is provider-neutral, and commercial PSP adapters are not mandatory dependencies.

**However, self-hosting the software is not the same as operating a payment network.** UPI, card networks, banking rails, clearing and settlement have participants and rules outside the application. A self-hosted service cannot create bank settlement access merely by generating a QR code or recording a transaction in PostgreSQL.

Authoritative references (read the current versions before any regulated launch):

- NPCI UPI FAQs: https://www.npci.org.in/what-we-do/upi/faqs
- RBI Payment and Settlement Systems Act FAQ: https://www.rbi.org.in/CommonPerson/english/scripts/FAQs.aspx?Id=420
- Digital Personal Data Protection Rules 2025: https://www.meity.gov.in/

This document intentionally separates **software functions**, **evidence capture**, and **actual regulated payment-system operations**.

## 2. What "no third party required" means precisely

**It means:**

- No mandatory proprietary MerchantOS cloud.
- No mandatory hosted database or SaaS subscription.
- No mandatory remote AI service.
- No mandatory commercial notification or analytics account for core flows.
- No mandatory payment PSP integration to record cash, credit, invoices, expenses or stock.
- No cloud telemetry sent without explicit configuration and consent.
- No vendor lock-in for schema, backups or core APIs.

**It does not mean:**

- The system can independently access a bank account without permission.
- The system can authorize, clear or settle UPI or card payments by itself.
- A locally generated QR creates a merchant acquiring relationship.
- The app can authenticate a payment based only on the customer's screen or screenshot.
- A private ledger balance equals money held in a bank.
- The software can perform regulated payment aggregation without required authorization.

## 3. Capability matrix

| Capability | Self-hosted without commercial PSP? | What it actually means | Activation gate |
|---|---|---|---|
| Cash sale and cash refund ledger | Yes | Operator records tender and shift cash count | Role checks, reason codes, audit trail |
| Credit sale / customer Khata | Yes | Receivable record, not money movement | Ledger invariant tests |
| Show merchant-owned bank QR image | Yes, if merchant already has permitted QR | Customer pays through their existing UPI/bank app | Merchant confirms correct details; QR itself does not verify payment |
| Generate a QR for merchant-owned UPI details | Potentially, subject to permitted format and bank terms | Encodes instructions/address; not an acquiring service | Validate format, terms, merchant ownership; status `UNVERIFIED` until corroborated |
| Record customer-claimed payment reference | Yes | An unverified assertion | UI shows "awaiting verification"; never plays success Soundbox |
| Import bank/UPI statement CSV | Yes | Reconcile actual statement rows to bills | Parser validation, source-file hash, duplicate detection, human review |
| Automatically confirm real UPI in seconds | Not generically, without an authorized feed | Requires official/direct feed or other reliable authorized confirmation arrangement | Contract, docs, access credentials, security and end-to-end validation |
| Receive UPI directly as acquiring participant | Not through software alone | Institutional/network participation and compliance | Legal/partner onboarding/authorization gate |
| Accept card payments using generic code only | No | Card processing/acquiring and secure terminal/network are needed | Authorized acquirer/terminal arrangements; PCI scope review |
| Soundbox for cash/manual notifications | Yes | Local audio from local events | Must not imply verified digital payment |
| Soundbox for authority-verified digital payment | Only when a trusted verification feed exists | TTS after verified event | Signature/authentication, replay protection, reconciliation and monitoring tests |
| MerchantOS internal ledger transfer | Software records transfers; it is not bank money | Internal accounting entry only | Label clearly; never market as transferable money or real UPI settlement |
| MerchantOS becomes its own payment system/aggregator | Not a normal software-only feature | Regulated financial-infrastructure business | Independent legal review, RBI/other applicable authorization, institutional approvals before implementation |

## 4. v1 payment scope (what the code actually does today)

1. **Cash and configured manual tender:** fully operational, auditable, reconciled with shifts.
2. **Merchant-owned QR display:** the merchant can configure their own payment details (`payment_methods` table). A QR is generated locally using the `qrcode` package. Status is marked `PENDING_EXTERNAL` until corroborated.
3. **Payment sessions:** `payment_sessions` table tracks intent with state machine `CREATED → AWAITING_PAYER → PENDING_EXTERNAL → VERIFIED/FAILED/EXPIRED/CANCELLED`. Local-only flow; no external verification is wired by default.
4. **Webhook handler:** the local payment simulator (`ENABLE_PAYMENT_SIMULATOR=true`) can post a signed webhook that flips the state. This is **disabled by default in production** (`schema/config.ts` rejects `true` when `NODE_ENV=production`).
5. **Statement import + reconciliation:** **roadmap** (see §6).
6. **Soundbox:** **roadmap** (see §7).
7. **No funds custody:** v1 records and reconciles; it does not hold merchant/customer money, create withdrawable wallet balances or route settlement funds.

## 5. Payment state machine

Allowed transitions, enforced server-side in `api/src/payment/payment.service.ts`:

```
CREATED        → AWAITING_PAYER, CANCELLED, EXPIRED
AWAITING_PAYER → PENDING_EXTERNAL, CANCELLED, EXPIRED
PENDING_EXTERNAL → VERIFIED, FAILED, EXPIRED, CANCELLED, DISPUTED
VERIFIED       → REFUND_PENDING, SETTLEMENT_PENDING (future), DISPUTED
REFUND_PENDING → PARTIALLY_REFUNDED, REFUNDED, FAILED
FAILED         → (terminal — operator creates a new session)
EXPIRED        → (terminal)
CANCELLED      → (terminal)
```

Frontend code cannot assign `VERIFIED` directly. The only paths to `VERIFIED` are:

1. A signed webhook from a configured trusted source (post-MVP).
2. A reconciliation match against a bank-statement row with explicit operator confirmation (post-MVP).
3. The local sandbox simulator (only when `NODE_ENV !== 'production'` AND `ENABLE_PAYMENT_SIMULATOR === 'true'`).

## 6. Statement import and reconciliation (roadmap)

The current schema has `payment_events` but does not yet have `statement_imports`, `statement_rows` or `reconciliation_items`. The planned model:

- `statement_imports`: upload source, file digest, parser profile/version, import actor, timestamps, row counts, errors.
- `statement_rows`: normalized amount/currency, debit/credit type, bank reference, transaction time, narration, import reference, duplicate fingerprint.
- `reconciliation_items`: statement row to payment/bill match, matching method/score, reviewer, status, corrections.

Until these tables and a CSV importer land, the merchant records payment evidence manually and reconciles in the daily-close report.

## 7. Soundbox (roadmap)

Planned behavior:

- Consume immutable, deduplicated notification events.
- Pending/claimed status must not announce "payment received."
- Only a policy-approved evidence level can trigger a verified-receipt announcement.
- Use local Android TTS in Hindi/English/Hinglish when available, with privacy mode/volume/speed controls, vibrate and notification history.
- Retry must not duplicate speech for the same event ID.
- Distinguish sandbox events from live events in UI and logs.

## 8. Sandbox

- Sandbox credentials and events are only accepted in `NODE_ENV=development` or `NODE_ENV=test`.
- Production API refuses sandbox credentials and sandbox-flagged events unless an explicitly isolated development environment is active.
- A "Payment verified" indicator in production for sandbox data is treated as a critical UI bug.

## 9. Provider-neutral adapter contract (planned)

Future direct bank/acquirer integrations must implement a small interface and live in `api/src/payment/adapters/`:

```ts
export interface PaymentEvidenceSource {
  readonly id: string;
  getCapabilities(): Promise<{
    supportsLookup: boolean;
    supportsVerifiedEvents: boolean;
    supportsRefunds: boolean;
    supportsSettlement: boolean;
  }>;
  lookupTransaction(reference: string): Promise<PaymentLookup | null>;
  verifyWebhookSignature(rawBody: string, signature: string): boolean;
}
```

The domain model may not assume all capabilities exist. Store secrets on the server only. Validate signed/authenticated requests. Protect against replay, deduplicate event IDs, validate amount/currency/merchant/reference, handle late/out-of-order events and maintain an event audit.

No real adapter is marked connected without real integration credentials, docs and end-to-end verification. A mock adapter is labelled `SANDBOX` and disabled in production by default.

## 10. Settlement is not payment success

Successful external payment and settlement are different things. v1 does not infer settled money from a payer redirect or ordinary payment success event. Reconciliation reports unmatched/partial/mismatch values and their age. v1 does not expose withdrawable wallet balances or custody funds, and does not build unauthorized fund pooling or settlement routing.

## 11. Regulatory boundary — explicit statement

> **MerchantOS does not, and cannot through software alone, independently clear or settle UPI, card, IMPS, NEFT or other regulated payment-rail transactions.** Any program to operate a payment system, aggregate funds, or replace an acquiring relationship requires separate, qualified legal review and applicable institutional/authorization gates. The product is built and documented for provider-neutral operation of merchant business workflows, with honest evidence states and a sandboxed payment simulator. Real verified digital payments require an actual integration with a regulated institution that has the right to confirm and settle those transactions; that integration is out of scope for v1 and must be enabled only with the appropriate legal and operational review.
