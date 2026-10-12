# MerchantOS — HTTP API Reference

Base URL: `https://<your-host>/` (development: `http://localhost:3000`)

All authenticated endpoints require:
```
Authorization: Bearer <accessToken>
Content-Type: application/json
```

Idempotent POSTs accept an optional header:
```
Idempotency-Key: <uuid or any unique string, 8+ chars>
```

Re-sending the same `Idempotency-Key` with the same body replays the cached
response (no side effects). Re-sending with a *different* body returns 401
`IDEMPOTENCY_KEY_REUSED`.

---

## Auth (public)

### POST /auth/login
Body: `{ "email": "...", "password": "..." }`
Response: `{ "accessToken": "...", "refreshToken": "...", "user": { ... } }`
- accessToken: JWT, 15 min TTL
- refreshToken: opaque, 30 day TTL, single-use after rotation

### POST /auth/refresh
Body: `{ "refreshToken": "..." }`
Response: `{ "accessToken": "...", "refreshToken": "..." }` (rotated)

### POST /auth/logout
Body: `{ "refreshToken": "..." }`
Response: `{ "ok": true }` (revokes the token; idempotent)

### POST /auth/register
First-user-only. Returns 403 if any user already exists. Body: same as login.
**Do not enable in production without an invitation flow.**

---

## Products (authenticated)

### GET /api/products
Query: `?storeId=<id>&limit=50&offset=0`
Response: `{ "items": [Product, ...], "total": N }`

### POST /api/products
Roles: OWNER, MANAGER
Body:
```json
{
  "storeId": "01M...",
  "sku": "RICE-5KG",
  "name": "Basmati Rice 5kg",
  "description": "...",
  "category": "Grocery",
  "priceMinor": "54900",
  "currency": "INR",
  "taxBps": 500,
  "unit": "pack",
  "openingStockMinor": "5000"
}
```

### PATCH /api/products/:id
Partial update. Same role check.

### GET /api/products/:id

### DELETE /api/products/:id
Soft delete — sets `status = 'ARCHIVED'`. Stock history is preserved.

---

## Customers (authenticated)

### GET /api/customers?storeId=&q=&limit=&offset=
### POST /api/customers
Body: `{ "storeId", "name", "phone", "address", "openingBalanceMinor", "currency" }`
### GET /api/customers/:id
### PATCH /api/customers/:id
### GET /api/customers/:id/ledger
Returns ledger entries in reverse chronological order.

### POST /api/customers/:id/ledger
Body: `{ "type": "PAYMENT" | "ADJUSTMENT", "amountMinor", "currency", "description" }`

---

## Bills (authenticated)

### GET /api/bills?storeId=&from=&to=&customerId=&limit=&offset=
### POST /api/bills
Body:
```json
{
  "storeId": "01M...",
  "customerId": null,
  "lines": [
    { "productId": "01M...", "quantity": 2 }
  ],
  "taxBps": 1800,
  "currency": "INR",
  "idempotencyKey": "optional-client-key"
}
```
The server recomputes `subtotalMinor`, `taxMinor`, `totalMinor` from the line
items; client-supplied values are ignored. Stock is decremented atomically.
A `CREDIT` ledger entry is written if `customerId` is provided.

### GET /api/bills/:id
Returns the bill with `items[]`.
### GET /api/bills/:id/receipt
Returns a PDF stream (`application/pdf`).
### POST /api/bills/:id/void
Roles: OWNER, MANAGER. Reverses stock, marks bill `VOID`, writes a negative
ledger entry if there was a customer.

---

## Payments (authenticated)

### POST /api/payments/sessions
Body: `{ "billId" }`
Response: `{ "id", "qrPayload", "paymentToken", "expiresAt" }`

### GET /api/payments/sessions/:id
Returns session status and any captured events.

### POST /api/payments/sessions/:id/cancel
Owner only.

### POST /api/dev/simulate-success
**Dev only.** Returns 404 if `NODE_ENV === 'production'` or
`ENABLE_PAYMENT_SIMULATOR !== 'true'`. Used by the in-repo sandbox to mark
a session as paid.

### POST /api/webhooks/payments
Public. HMAC-SHA256 over `timestamp + body` with `PAYMENT_WEBHOOK_SECRET`.
5-minute timestamp window. Idempotent: the same `provider_ref` is not applied
twice.

---

## Shifts (authenticated)

### POST /api/shifts
Open a new shift. Body: `{ "storeId", "openingCashMinor", "currency" }`
### GET /api/shifts?storeId=&status=OPEN|CLOSED
### POST /api/shifts/:id/close
Body: `{ "closingCashMinor" }` — server computes the variance.

---

## Suppliers & Purchases (authenticated)

### GET /api/suppliers
### POST /api/suppliers
### GET /api/suppliers/:id
### GET /api/supplier-purchases?storeId=&from=&to=
### POST /api/supplier-purchases
Body: `{ "storeId", "supplierId", "invoiceNo", "items": [...], "receivedAt" }`
Creates a purchase AND stock movements of type `PURCHASE` in one transaction.

---

## Reports (authenticated, role-gated)

### GET /api/reports/sales-summary?storeId=&from=&to=
Returns: `{ totalMinor, billCount, avgTicketMinor, byDay: [{ date, totalMinor, count }] }`

### GET /api/reports/inventory?storeId=
Returns: current stock per product, last movement date, days-of-cover.

### GET /api/reports/customer-balances?storeId=
Returns: customer id, name, balance, last activity.

---

## AI (optional, auth required)

### POST /api/ai/chat
Body: `{ "conversationId": null, "message": "..." }`
Streams a response. Disabled if `ENABLE_OLLAMA !== 'true'`.

### GET /api/ai/conversations
Lists prior conversations.

---

## Error shape (RFC 7807)

Every 4xx and 5xx response has this body:
```json
{
  "error": {
    "code": "MACHINE_READABLE_CODE",
    "message": "human-readable text",
    "requestId": "req-abc123"
  }
}
```

Common codes:
- `VALIDATION_ERROR` (400) — Zod schema failure
- `UNAUTHORIZED` (401) — missing or invalid token
- `FORBIDDEN` (403) — role or membership check failed
- `NOT_FOUND` (404)
- `IDEMPOTENCY_KEY_REUSED` (401) — same key, different body
- `INSUFFICIENT_STOCK` (409) — bill line exceeds current stock
- `RATE_LIMITED` (429)
- `INTERNAL` (500) — never includes stack trace or SQL

---

## Rate limits

- `/auth/login`, `/auth/register`: 20 attempts / 15 min / IP
- All other endpoints: inherit nginx's `limit_req` (recommended 10 r/s per IP)

## Pagination

- `?limit=` default 50, max 200
- `?offset=` default 0
- Responses include `total` for total count
- For exports > 10k rows, use the report endpoints (which aggregate) or a
  future async export job.
