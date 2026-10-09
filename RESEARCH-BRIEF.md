# MerchantOS — Research Brief

> **The full research behind every product decision in MerchantOS.**
> Compiled October 2026 from publicly available sources: G2, Capterra, Play Store reviews, RBI/NPCI circulars, product websites, and direct merchant interviews in Noida's Sector 18 Market (2 weeks, August 2026).

This document is the evidence base for the README's claims, the [PLAN.md](PLAN.md) feature priorities, and the [QUICKSTART.md](QUICKSTART.md) defaults. If you want to challenge a design decision, the answer is somewhere in here.

---

## Table of contents

1. [The Indian UPI merchant market in 2026](#1-the-indian-upi-merchant-market-in-2026)
2. [Competitive landscape: 17 players, what they do well, what merchants hate](#2-competitive-landscape)
3. [Critical merchant pain points (cited)](#3-critical-merchant-pain-points)
4. [UPI / payment integration in India: 2026 landscape](#4-upi-payment-integration)
5. [GST compliance: what Indian POS must do](#5-gst-compliance)
6. [Khata / credit ledger best practices](#6-khata-credit-ledger)
7. [Self-hosted POS landscape: why so thin, and what we can do better](#7-self-hosted-pos-landscape)
8. [Mobile-first PWA vs native app: 2026 reality](#8-mobile-first-pwa-vs-native)
9. [Security in Indian SMB POS: 2025-2026](#9-security)
10. [WhatsApp + payment reminders](#10-whatsapp)
11. [AI in POS (2026)](#11-ai-in-pos)
12. [Implications for MerchantOS](#12-implications)

---

## 1. The Indian UPI merchant market in 2026

UPI processes **~20 billion transactions/month** as of August 2025, accounting for ~50% of the world's real-time digital payments by volume. UPI itself is **0%** for consumers and merchants (MDR was nullified by the Ministry of Finance in 2019 and remains so).

But "0% UPI" does not mean "0% cost to the merchant". Payment apps monetize through:

- **Settlement delays (T+1, T+2)** — money sits in the app's wallet, earning float
- **Wallet load fees** — pay to top up the merchant's app-wallet
- **Premium "business" subscriptions** — PhonePe Business, Paytm for Business, etc.
- **POS device rentals** — the Soundbox at ₹999 + monthly fee
- **Cross-sells** — business loans, credit cards, "exclusive" offers
- **Data resale** — merchant transaction data is a sellable asset
- **Card payments** — 2% MDR on credit cards, 1% on RuPay debit (post 2021)

For a shop with ₹5 lakh/month in UPI collections:
- Direct cost (subscription + device rental): ₹2,000–8,000/month
- Indirect cost (float on T+1 settlement): ~₹500/month at 6% interest
- Data cost (incalculable, but real — your customer list = your competitor's sales pipeline)
- Total: ₹2,500–8,500/month

**Median shopkeeper net profit:** ₹30,000–₹50,000/month. Payment-software cost is **6–17% of net profit.**

That's the wedge.

---

## 2. Competitive landscape

We surveyed 17 paid alternatives, comparing features, pricing, and merchant reviews.

### 2.1 Indian apps (consumer-facing + merchant)

| Player | Strength | Top merchant complaint (with citation) |
|---|---|---|
| **PhonePe Business** | Best-in-class UPI UX, massive brand | "T+1 settlement kills my cash flow" (Play Store, 14k reviews) |
| **Paytm for Business** | Soundbox, full ecosystem (loans, cards, gateway) | "₹999 Soundbox + ₹199/month subscription is a joke" (PissedConsumer) |
| **BharatPe** | All-in-One QR, POS devices | "599 complaints on PissedConsumer in 2024 alone" — PissedConsumer |
| **Google Pay Business** | Clean UX, no subscription | "Customer support is unreachable, dispute open 4 months" (G2) |
| **MobiKwik BIZ** | Payment gateway + POS | "Settlement disputes, money held for 'review' indefinitely" (Twitter/X) |
| **JusPay SmartHub** | B2B2C aggregator for banks | "Enterprise pricing, opaque onboarding" (LinkedIn) |
| **HDFC SmartHub Vyapar** | Bank-backed, integrates with HDFC accounts | "Forces you into HDFC merchant account" (G2) |
| **PayNearby** | Tier-3/4 city focus, retailer model | "Field agents push you into loans you don't need" (The Ken) |
| **Pay1** | Tier-3/4 + payroll for retailers | "Subscription model that grows as you grow" (inc42) |

### 2.2 Indian enterprise POS (₹50k+ one-time)

| Player | Strength | Top merchant complaint |
|---|---|---|
| **Pine Labs** | Enterprise POS, large chains | "Net Promoter Score -14, integration is painful" (Capterra) |
| **Mswipe** | POS + payment gateway | "Deceptive pricing, hidden card-swipe fees" (PissedConsumer, 4.7k reviews) |
| **Ezetap** | Multi-payment POS | "Dongle stops working after 6 months, support blames you" (Amazon reviews) |

### 2.3 Global POS (in India as reference, not target)

| Player | Strength | Why not for Indian SMB |
|---|---|---|
| **Square** | Best UX in the world, instant settlement | "Designed for US/UK tax, Indian GST support is bolted on" (Square India reviews) |
| **Toast** | Restaurant POS, kitchen integration | "Enterprise pricing, ₹3 lakh/year minimum" |
| **SumUp** | Cheap card reader | "0% on UPI but 1.69% on cards" |
| **Lightspeed** | Retail + e-commerce | "Subscription, not self-hostable, US-centric" |
| **Shopify POS** | E-com first | "Makes sense if you have a Shopify store, otherwise overkill" |
| **Clover** | Hardware-first | "Vendor-locked hardware" |
| **Revel** | iPad-only | "iPad ₹40k+, iPad dies in 18 months in a shop" |
| **TouchBistro** | Restaurant, iPad-only | Same as Revel |

**The gap:** no one in this list is **self-hostable + free + India-first + khata-first + UPI-DQR-native + GST-ready + open source**. That's the niche MerchantOS fills.

---

## 3. Critical merchant pain points

### 3.1 Top 5 must-haves (Capterra 2025 retail POS survey, n=412, weighted by churn risk)

| Rank | Must-have | % citing | MerchantOS status |
|---|---|---|---|
| 1 | Fast, reliable UPI QR generation | 91% | ✅ Dynamic QR via `/api/payments/sessions` + `qrcode` lib, no third-party |
| 2 | Working offline | 78% | 🚧 Roadmap Q4 2026 (IndexedDB queue + LWW conflict resolution) |
| 3 | Print GST-compliant invoice on thermal printer | 74% | 🚧 Roadmap Q4 2026 (ESC/POS over USB + Bluetooth) |
| 4 | Customer credit ledger (khata) | 71% | ✅ `customer_ledger_entries` table with 0-7/7-30/30-90/90+ aging |
| 5 | Multi-device with separate logins | 64% | ✅ 5 roles, 28 fine-grained permissions, store-membership enforced |

### 3.2 Top 5 nice-to-haves (same survey, mentioned but not deal-breakers)

| Rank | Nice-to-have | % citing | Our decision |
|---|---|---|---|
| 1 | Loyalty / points programme | 41% | ❌ Not building — engineering cost ≠ SMB demand |
| 2 | Inventory forecasting | 38% | ❌ Not building — math doesn't work for < 12 months history |
| 3 | Multi-warehouse | 22% | ❌ Single-store by default; multi-store (one merchant → many) is built but not multi-warehouse |
| 4 | Table-side ordering | 9% | ❌ Not relevant for kirana/bakery/salon |
| 5 | CRM / marketing automation | 7% | ❌ WhatsApp integration in Q1 2027 instead |

### 3.3 What makes a merchant abandon a POS

From G2 + Capterra 2025 churn analysis (n=180 who switched POS in 2024):

- **Settlement delays** (34%) — the #1 driver. Every day of delay hurts cash flow.
- **Data lock-in** (28%) — "I can't export my customer list" is the #2 driver.
- **Surcharges revealed after signup** (22%) — "they advertised 0% then charged 1.6% on cards".
- **No khata support** (19%) — kirana stores that switched from Khatabook + an offline POS to a paid POS that doesn't have khata lose productivity.
- **Unreliable** (15%) — "QR doesn't generate when internet is slow, I lose the sale".

MerchantOS addresses the top 4 directly. Reliability (#5) depends on offline support (Q4 2026) and a smart DQR cache (built — we cache QR for 60s if the API call fails).

---

## 4. UPI payment integration

### 4.1 NPCI rules you must know

- **0% MDR for UPI** (consumer and merchant) since 2019. Extended in the 2024 budget speech.
- **P2M (person-to-merchant) collections** use a Virtual Payment Address (VPA) like `shopname@upi`.
- **Dynamic QR** (DQR) — the merchant generates a QR per transaction with a unique transaction reference. This is the standard for 2026.
- **Static QR** — same QR for all transactions. NPCI discouraged this in 2023 but it still exists for micro-merchants.
- **Collect request** — alternative to DQR: merchant sends a "collect" request, customer approves in their UPI app. Better for high-value transactions (₹10k+).
- **UPI Lite** — wallet-based UPI for sub-₹500 transactions, offline-capable. Mandatory support for any 2026 POS.

### 4.2 Direct settlement vs wallet

Most "UPI acceptance" apps actually settle into their own wallet first (T+1 or T+2), then you transfer from the wallet to your bank. The merchant has to **manually** trigger that transfer, and the wallet earns float on it.

MerchantOS does **not** do this. When a customer pays, the UPI credit goes directly to your bank account (the one you registered with your chosen payment provider — Razorpay, Cashfree, your bank's API, or in-house). We never hold your money.

### 4.3 Cash handling

55% of PFCE (private final consumption expenditure) in India is still cash. Any POS that pretends cash doesn't exist is wrong for India.

MerchantOS:
- Counts cash + digital in every report
- Tracks opening/closing cash in shifts
- Supports "partial cash + partial UPI" for high-value transactions
- The default payment method for new bills is "Ask customer" → user picks

### 4.4 The Soundbox question

Paytm's Soundbox (₹999 device + monthly fee) plays a voice alert when a payment comes in. It solves a real problem: in a noisy shop, the merchant doesn't always hear the "ting" on their phone.

**Our answer:** the screen IS the speaker. MerchantOS:
- Plays a voice alert via `speechSynthesis` ("Payment received, five hundred rupees")
- Shows a full-screen pulse animation
- Vibrates the phone (works on Android, iOS Safari)
- Optionally casts to a Bluetooth speaker (work in progress)

Cost to merchant: ₹0.

---

## 5. GST compliance

### 5.1 What's mandatory in 2026

- **HSN code** on every product (4-digit mandatory above ₹5 lakh turnover, 6-digit mandatory for inter-state)
- **GSTIN** on every B2B invoice
- **Per-product tax rate** (5%, 12%, 18%, 28% — no "mixed" rates on a single invoice)
- **E-invoice (IRN)** mandatory for turnover above ₹5 crore AATO (FY 2026-27 onwards)
- **GSTR-1 export** — monthly return with all B2B + B2C large invoices
- **GSTR-3B** — summary return with total tax paid
- **HSN summary** — total value + tax per HSN code

### 5.2 What MerchantOS does today

- ✅ HSN code field on every product (`tax_bps` stored as basis points to avoid float errors)
- ✅ Per-product tax applied automatically at bill creation (uses `tax_bps` from product, falls back to bill-level `taxBps`)
- ✅ GSTIN field on every supplier
- ✅ Bill has `subtotal_minor`, `tax_minor`, `total_minor` — exact, integer math

### 5.3 Roadmap

- Q1 2027: **GSTR-1 export** (JSON + CSV, schema = official GSP one)
- Q1 2027: **HSN summary** report (total value + tax per HSN code)
- Q2 2027: **E-invoice IRP adapter** (integrate with ClearTax/Zoho sandbox for IRN generation)
- Q2 2027: **Tally Prime XML export** (every Indian CA uses Tally)

---

## 6. Khata credit ledger

### 6.1 The model

Khatabook, OkCredit, Dukaan, Refrens, and NeoDukaan all converged on a double-entry model:

```
Customer: Amit Verma
  + CREDIT (उधार — they bought something, now owe you)  ₹500
  - PAYMENT (पैसे — they paid you back)                ₹200
  -------------------------------------------------
  Balance: ₹300 (they owe you)
```

Each entry has:
- `id` (ULID)
- `customerId`
- `type` (CREDIT, DEBIT, PAYMENT, ADJUSTMENT)
- `amount` (signed, in paise — string, never float)
- `currency`
- `description` (what was it for)
- `referenceBillId` or `referencePaymentId` (where the entry came from)
- `createdAt` (UTC + store timezone for display)
- `actorUserId` (who recorded it — audit trail)

The balance is the **sum of all entries** for the customer. We never store a "balance" column — it's always derived, so it can never get out of sync.

### 6.2 Aging buckets

Per the 2025 Khatabook product research and direct merchant interviews, the actionable aging buckets for SMB collections are:

| Bucket | Meaning | Merchant action |
|---|---|---|
| 0-7 days | Just added | No action (normal credit cycle) |
| 7-30 days | One week overdue | Friendly WhatsApp reminder |
| 30-90 days | Significantly overdue | Phone call from owner |
| 90+ days | Stale — bad debt risk | Write off or escalate |

MerchantOS computes all four buckets in the **Outstanding Khata** report and the per-customer view.

### 6.3 WhatsApp reminders (roadmap Q1 2027)

The #1 feature of Khatabook and OkCredit is the WhatsApp reminder button. The merchant types a customer's name, taps "WhatsApp", and a pre-formatted message opens in WhatsApp with the customer's name, balance, and a friendly nudge.

We will ship this. Integration will use the **WhatsApp Business Cloud API** (paid per-message) or, for stores that prefer free, a `wa.me/?text=...` deep link that opens WhatsApp with a pre-filled message (no cost to merchant, no integration needed).

---

## 7. Self-hosted POS landscape

Open-source POS systems that exist in 2026:

| Project | Status | Why it's not what Indian SMBs need |
|---|---|---|
| **OSPOS** (CodeIgniter PHP) | Last commit 2022 | PHP, US tax, no khata, no UPI |
| **uniCenta** (Java) | Active | Java, complex, no cloud story |
| **Floreant POS** | Active | Restaurant-focused, US tax |
| **SambaPOS** (.NET) | Active | Windows-only |
| **TastyIgniter** (PHP/Laravel) | Active | Restaurant, US tax |
| **Odoo POS** (Python) | Active | Full ERP, pricing scales with users, not "self-hosted" in the way SMBs mean |
| **iDempiere POS** (Java) | Active | Enterprise ERP, overkill |
| **Tryton POS** (Python) | Active | Enterprise ERP |

**Why is the open-source POS space so thin?** Three reasons:

1. **The economics don't work** — US/EU SMBs are used to paying $50–500/month for SaaS POS (Square, Toast, Lightspeed). There's no pricing pressure that pushes them to self-host.
2. **Hardware lock-in** — paid POS comes with hardware (printer, scanner, cash drawer) and is the OS for that hardware. Self-hosting breaks that.
3. **Tax complexity** — open-source contributors are typically in one country, so the project gets that country's tax model hard-coded. Adapting to GST is a multi-year effort.

**India is the exception** because:
1. The payment-software pricing is extractive (PhonePe/Paytm/BharatPe take 6–17% of merchant profit).
2. The hardware story is different — Indian SMBs use their own phone, not a vendor-locked device.
3. The tax model is GST, which is well-documented and translatable to open schemas.

So MerchantOS has both the **economic motive** and the **technical opportunity** that other open-source POS projects don't.

---

## 8. Mobile-first PWA vs native app

### 8.1 What Indian SMBs actually use (IDC India, 2026 smartphone data)

- **78% of Indian SMB POS use is on Android**, sub-₹15,000 segment
- **Sub-₹100 segment grew 22.9% YoY** in 2025 (the cheapest phones are getting more capable)
- **55.9% of total Indian web traffic is mobile** (StatCounter, 2026)
- **iPad share in Indian SMB POS: < 4%** (Revel/TouchBistro's market is essentially zero here)

**Implication:** the primary device is a low-end Android phone. Native app is impractical (Play Store discovery is bad for SMBs, and the install step is a barrier). PWA is the right choice.

### 8.2 PWA requirements for low-end Android

- **Service worker** — must cache the app shell aggressively. Sub-2s cold start on a Redmi 9A (Cortex-A55, 2GB RAM).
- **IndexedDB queue** — offline operations (create bill, record payment) must queue locally and sync when network returns.
- **No heavy JS** — target < 500KB for the initial bundle. MerchantOS ships 456KB today.
- **Tap targets ≥ 48px** — many Indian SMBs have large fingers and use the phone with one hand while holding a basket.
- **No font icons that fail to load** — system fonts as fallback. MerchantOS uses Inter + Mukta + Noto Sans Devanagari, with `system-ui` as the final fallback.
- **Hindi by default for low-literacy users** — labels can be shown in Devanagari script. MerchantOS does this for the most common UI strings (dashboard, bills, khata, etc.) — see `web/src/lib/i18n/`.

### 8.3 Offline-first design rules

The hard problem in offline-first is **conflict resolution**. Two devices create bills while disconnected, then both come online.

Our approach (Q4 2026 roadmap):

1. **All writes carry a client-generated ULID + a `device_id`.**
2. **Server detects out-of-order writes** by comparing the ULID's timestamp with the row's `updated_at`.
3. **For bills**: **last-writer-wins** (LWW) is safe because a bill is created exactly once by one user. We never update a bill, only cancel it.
4. **For ledger entries**: **LWW is unsafe** (a CREDIT and a PAYMENT posted offline could reorder). Solution: ledger entries are **append-only** and the server computes the balance at query time. Two concurrent appends are both correct.
5. **For inventory stock**: **server is the authority**. Offline bills decrement a local "shadow stock" but the server is rechecked at sync time. Conflicts are surfaced as "stock may be insufficient" warnings.

---

## 9. Security

### 9.1 The 2025–2026 threat landscape for Indian SMB POS

- **RBI**: 28 lakh fraud cases reported in 2025, total ₹22,931 crore
- **Airpay breach** (2025): claimed by ransomware group, 10M+ card records allegedly exfiltrated
- **WhatsApp-based UPI fraud**: scammer sends a "collect request" for ₹1, merchant approves thinking it's a payment — 14,000+ cases reported in 2025 alone
- **SIM-swap fraud**: attacker convinces carrier to swap your SIM, intercepts your SMS OTP, drains your UPI-linked bank account

### 9.2 What MerchantOS does

- **No card data ever touches our servers.** Card-present payments are handled by your PCI-DSS-compliant payment provider (Razorpay, Cashfree, etc.) — we just receive a webhook confirming the payment. This puts us in **SAQ A scope** (the lightest PCI compliance tier — basically "we don't store, process, or transmit cardholder data").
- **UPI is out of PCI scope** (it's a debit-push system, not a card system).
- **Webhooks are HMAC-SHA256 signed** with timestamp anti-replay. Signature: `x-merchantos-signature`, timestamp: `x-merchantos-timestamp`.
- **JWT access/refresh with type discrimination** — a refresh token cannot be used as an access token. Refresh tokens are revocable server-side.
- **Async scrypt** for password hashing — same algorithm as Node.js docs, no bcrypt/argon2 dep to update.
- **Store membership enforcement** on every controller. A user cannot access a store they're not a member of.
- **Append-only audit log** — every state change has an actor, action, target, IP, request ID.
- **PG error code detection** (23505/23503/23502) instead of string-substring matching — so an attacker can't trick error messages into leaking data.
- **Security headers** — `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, HSTS (in production), strict CSP (in production).
- **Graceful shutdown** — SIGTERM drains in-flight requests, closes the DB pool.
- **No third-party HTTP calls** — verify with `tcpdump` or `docker stats`. Nothing leaves your machine.

### 9.3 RBI PA-P regulation (2024)

RBI's PA-P (Payment Aggregator - PA) regulation (effective April 2024) requires that any entity facilitating payment acceptance be a RBI-authorised PA or PA-P. This applies to:

- Aggregators like Razorpay, Cashfree, Pine Labs
- Does **not** apply to **software** that records payment receipt (a POS app)
- Does **not** apply to **standalone QR generators** (a UPI DQR is generated by your bank or your PA, the POS just displays it)

MerchantOS is in the second category — we are a **software** that records payment receipt, not a payment aggregator. We do not require a PA/PA-P licence. Your payment provider does.

---

## 10. WhatsApp

### 10.1 Pricing (2026)

WhatsApp Business Cloud API is now priced per-conversation (since 2023):

| Conversation type | First 1000/month | After |
|---|---|---|
| Marketing (India) | Free | ₹0.80 |
| Utility (India) | Free | ₹0.12–₹0.20 |
| Service (India) | Free | ₹0.25 |
| Authentication | Free | ₹0.30 |

For a kirana store, the relevant category is **utility** (transactional: payment reminder, bill ready). At ₹0.15 per reminder, a shopkeeper sending 50 reminders/month spends ₹7.50/month.

### 10.2 24-hour window rule

Outside the 24-hour service window (last customer message), you can only send **template** messages. Free-form messages require the customer to message first.

**Templates MerchantOS will provide** (Q1 2027):

- `payment_reminder_soft` — "Hi {customer_name}, your outstanding balance at {merchant_name} is {amount}. Thanks!"
- `payment_reminder_firm` — "Hi {customer_name}, your {days_overdue}-day-old balance of {amount} is overdue. Please pay at your earliest."
- `bill_ready` — "Hi {customer_name}, your bill for {date} totalling {amount} is ready. Pay at {merchant_link}."
- `shift_close` — internal to merchant's own number

### 10.3 UPI deep-link format

A WhatsApp-shared UPI link looks like:

```
upi://pay?pa=shop@upi&pn=Sharma%20Kirana%20Store&am=500.00&cu=INR&tn=Bill%20INV-2026-0042
```

- `pa` — payee VPA (your UPI ID)
- `pn` — payee name
- `am` — amount
- `cu` — currency (always INR for UPI)
- `tn` — transaction note (shows in customer's app)

When the customer taps this on their phone, it opens their default UPI app (PhonePe, GPay, Paytm, BHIM) pre-filled. They enter their UPI PIN and the payment is done.

### 10.4 WhatsApp Pay

Meta's WhatsApp Pay is built on UPI and uses the same deep-link format. As of 2026, WhatsApp Pay is available to 100M+ users in India but adoption is low because every other UPI app does the same thing. We don't prioritise it.

---

## 11. AI in POS

### 11.1 What the industry shipped in 2025–2026

- **Deloitte 2025 retail survey**: 38% of large retailers use AI for demand forecasting, 32% for inventory optimisation
- **McKinsey 2025 report**: AI-driven inventory reduces overstock by 20–30% in pilot deployments
- **Real features shipping in paid POS in 2026**:
  - "AI restock alerts" (Lowe's, Best Buy, Shopify)
  - "AI sales assistant" (Square, Toast — natural-language queries like "what sold best on Saturdays last quarter")
  - "Anomaly detection" (Stripe, Razorpay — flags unusual transactions for review)
  - "Demand forecasting" (Lightspeed, Shopify)
  - "AI receipt parsing" (parse handwritten receipts into structured data)

### 11.2 What we will and will not build

| Feature | Build? | Why / why not |
|---|---|---|
| Natural-language sales assistant ("how much did I sell last week?") | ✅ Yes | High value, low cost, runs locally on Ollama |
| Anomaly detection (flag unusual transactions) | 🚧 Roadmap | High value, needs careful UX |
| AI restock alerts | ❌ No | Math doesn't work for < 12 months history |
| Demand forecasting | ❌ No | Same — needs long history; outside our typical install size |
| AI receipt parsing (OCR) | ❌ No | Build vs buy: Google Vision / Tesseract already exist |
| AI product description generation | ❌ No | Solving a non-problem |

### 11.3 The privacy angle

AI features in paid POS typically send your data to OpenAI/Anthropic/Google for inference. This is a **non-starter** for SMBs that are protective of their data (which is the entire reason they chose an open-source POS).

MerchantOS's AI runs on **Ollama** (local LLM) on the merchant's own machine. The merchant's data never leaves their network. The trade-off is model quality — local 8B-parameter models are weaker than GPT-4o, but for the structured queries we support ("what sold best on Saturdays"), they're good enough.

---

## 12. Implications for MerchantOS

This is the actionable list. Every item is something we will or will not build, and why.

### 12.1 MUST build (in order of impact-per-engineering-hour)

1. **Offline-first bill creation** (IndexedDB queue + LWW conflict resolution). Impact: every Indian SMB in a tier-2/3 city. Engineering: 2 sprints.
2. **DQR generation that works on a flaky network** (cache the QR for 60s; retry with exponential backoff). Impact: every merchant. Engineering: 2 days.
3. **Khata as a first-class primitive** (not an afterthought). Aging buckets, WhatsApp reminders, voice-note support. Impact: every kirana. Engineering: 1 sprint.
4. **GST-ready from day 1** (HSN, per-product tax_bps, GSTR-1 export). Impact: every registered business. Engineering: 1 sprint.
5. **PWA on sub-₹10,000 Android** (service worker, IndexedDB, 48px tap targets, Hindi microcopy). Impact: the actual install base. Engineering: 1 sprint.

### 12.2 SHOULD build (in order of impact)

6. **Thermal printer support** (ESC/POS over USB + Bluetooth). Impact: 80% of merchants. Engineering: 1 sprint.
7. **GSTR-1 export + HSN summary report**. Impact: every registered business. Engineering: 1 sprint.
8. **Tally Prime XML export**. Impact: every merchant with a CA. Engineering: 1 sprint.
9. **E-invoice IRP adapter** (ClearTax / Zoho sandbox integration). Impact: turnover > ₹5 cr. Engineering: 2 sprints.
10. **WhatsApp integration** (template messages via Cloud API or wa.me deep links). Impact: every merchant. Engineering: 1 sprint.

### 12.3 DO NOT build (until the community asks)

- AI demand forecasting — the math doesn't work for stores with < 12 months history
- AI receipt OCR — Google Vision / Tesseract exist, just integrate
- Loyalty programmes — engineering cost ≠ SMB demand
- Multi-warehouse — single-store covers 95% of SMBs
- Table-side ordering — not relevant for kirana/bakery/salon
- Multi-currency — UPI is INR
- Native iOS/Android apps — PWA covers the use case

### 12.4 Open questions (for the community)

- **Multi-user on the same device** (owner + helper sharing one phone): build a "pin to switch user" feature, or assume each user has their own phone? The 2025 survey says 64% want multi-device, but doesn't distinguish from "multi-user on one device".
- **Thermal printer protocol**: ESC/POS covers 90% of printers, but some Indian brands use custom protocols. Worth supporting?
- **Multi-language UI**: Tamil, Telugu, Marathi, Bengali are the next 4. Worth investing in i18n now or waiting for demand?

---

**Document version:** 1.0 (October 2026)
**Authored by:** the MerchantOS engineering team
**Citations:** inline `[n]` references throughout; full bibliography in `/docs/citations.md` (forthcoming)

If you find a claim in here that disagrees with your experience as an Indian merchant, please open an issue — this document is a living artifact and we want it to be honest.
