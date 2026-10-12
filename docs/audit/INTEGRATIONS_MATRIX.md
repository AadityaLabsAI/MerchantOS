# Integrations Matrix

**Audited:** 2026-10-10

## Payment providers

| Provider | Adapter | Capabilities | Docs version | Credentials | Sandbox status | Approval | Webhook | Reconcile | Tested |
|---|---|---|---|---|---|---|---|---|---|
| Razorpay | ❌ not implemented | — | — | — | — | — | — | — | — |
| Cashfree | ❌ not implemented | — | — | — | — | — | — | — | — |
| PhonePe | ❌ not implemented | — | — | — | — | — | — | — | — |
| PayU | ❌ not implemented | — | — | — | — | — | — | — | — |
| Internal sandbox | ⚠️ partial | simulate-success, status, session create | local | n/a | yes | n/a | n/a | n/a | ⚠️ not exercised |

**Status:** No real payment provider is integrated. The `simulate-success` endpoint exists for development but is the only "payment verification" path. **MerchantOS cannot accept real money today.** Any demo or marketing must say so.

### Required for real provider integration

1. Provider documentation, terms, and onboarding
2. Provider sandbox credentials (test API key + secret)
3. Webhook public URL registered with the provider
4. Webhook signing secret rotated and stored in env
5. Server-enforced signature verification (per provider's spec)
6. Replay window configured (default 5 min)
7. Refund API exercised end-to-end in sandbox
8. Settlement polling / fetch reconciled to bills
9. Reconciliation exceptions exported with source row references
10. Production switch gated on: provider approval, merchant onboarding, security review

## Messaging

| Provider | Adapter | Status |
|---|---|---|
| SMS (Twilio/MSG91/Plivo) | ❌ not implemented | n/a |
| WhatsApp Business API | ❌ not implemented | n/a |
| Email (SMTP/SES) | ❌ not implemented | n/a |
| Push notifications (FCM) | ❌ not implemented | n/a |

**Implication:** OTP for login, payment reminders, low-stock alerts — all currently have no delivery mechanism. Schema exists; provider wiring does not.

## Accounting / tax

| Provider | Adapter | Status |
|---|---|---|
| Tally export | ❌ not implemented | n/a |
| Zoho Books | ❌ not implemented | n/a |
| ClearTax | ❌ not implemented | n/a |
| GSTN e-invoice | ❌ not implemented | n/a |
| GSTN e-return filing | ❌ not implemented | n/a |

**Implication:** The product must NOT claim official GST filing. Accountant export (CSV/PDF) is also not implemented (BUG-201). The migration plan and prompt both say: "Never claim official filing/registration has occurred without an actual authorized filing integration and confirmation."

## Hardware

| Device class | Adapter | Status |
|---|---|---|
| Bluetooth receipt printer (ESC/POS) | ❌ not implemented | n/a |
| Network receipt printer | ❌ not implemented | n/a |
| Barcode scanner (USB-HID) | ⚠️ partial | Keyboard wedge works if SPA accepts keyboard input; no native integration |
| Cash drawer | ❌ not implemented | n/a |
| Weighing scale | ❌ not implemented | n/a |

## Identity / SSO

| Provider | Adapter | Status |
|---|---|---|
| Email/password | ✅ implemented | `api/src/auth/auth.controller.ts` |
| Phone OTP | ❌ not implemented | No SMS provider |
| OAuth (Google) | ❌ not implemented | n/a |
| SAML | ❌ not implemented | n/a |
| Passkey / WebAuthn | ❌ not implemented | n/a |
| Biometric (Android) | ❌ not implemented | n/a (no Android client yet) |

## Storage / infra

| Provider | Adapter | Status |
|---|---|---|
| Local PostgreSQL | ✅ implemented | `pg` pool |
| PGlite (in-process) | ⚠️ partial | shim exists; used by demo path |
| AWS S3 / R2 / GCS | ❌ not implemented | n/a |
| S3-compatible self-hosted (MinIO) | ❌ not implemented | n/a |

## Observability

| Tool | Adapter | Status |
|---|---|---|
| Structured logging | ✅ in-process | `request-logger.interceptor.ts` |
| Metrics (Prometheus) | ❌ not implemented | n/a |
| Tracing (OpenTelemetry) | ❌ not implemented | n/a |
| Error tracking (Sentry) | ❌ not implemented | n/a |
| Health endpoint | ✅ implemented | `health.controller.ts` |

## AI / LLM

| Provider | Adapter | Status |
|---|---|---|
| OpenAI | ❌ not implemented | controller exists; provider unwired |
| Anthropic | ❌ not implemented | n/a |
| Local model (Ollama/llama.cpp) | ❌ not implemented | n/a |
| Disabled-AI mode | ⚠️ partial | controller exists; "disabled" mode not verified |

## Honest status statement (required by the prompt)

MerchantOS is a **strong skeleton with no external integrations live**. It is suitable for:
- Local self-hosted single-merchant use, accepting only **cash and recorded manual tenders**.
- Internal accounting workflows.
- Developer exploration of the modular monolith architecture.

MerchantOS is **not** suitable for:
- Real customer-facing payment acceptance (no provider integrated).
- Production billing (no tests, no CI, no idempotency verified).
- Cross-merchant / SaaS use (no tenant isolation proven).
- Compliance claims (no GST filing, no PCI scope, no DPDP audit).

## Required for next integration

Before adding any external integration, complete Gate 1 (P0 stabilization) and Gate 2 (vertical slice with automated tests). No integration should land without:
- A typed adapter contract in the relevant package (`@merchantos/payments`, etc.)
- A sandbox test that proves the contract end-to-end
- A clearly labeled `Partner/credentials required` state in the integration UI
- No fake success path that could be confused with a real one

## Next audit doc

→ `RELEASE_BASELINE.md`
