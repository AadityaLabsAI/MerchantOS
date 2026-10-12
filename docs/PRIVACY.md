# MerchantOS Privacy Policy

**Applies to:** the MerchantOS software (this repository), when self-hosted by a merchant or operator.
**Does not apply to:** any third-party payment gateway, AI service, hosting provider, or other external integration that the operator may choose to enable. Those are governed by their own privacy policies.

---

## 1. What MerchantOS collects

MerchantOS is **self-hosted software**. The data it stores lives on the operator's own server, in the operator's own PostgreSQL database. MerchantOS does not transmit business data to any third party, to the MerchantOS authors, or to any other service, except:

- **Explicitly configured outbound webhooks** the operator may register for their own integrations.
- **AI features**, which are **off by default**. If the operator enables AI (`AI_ENABLED=true` in `.env`), the chosen AI backend (default: local Ollama) is called with the user's prompt. Local Ollama does not transmit data externally. If the operator instead configures a remote AI provider, that provider's privacy policy applies to the prompt contents.

There is no telemetry, no usage analytics, no error reporting, no remote crash dump, and no "phone home" in the default build. The codebase has no third-party analytics SDKs and no remote beacon.

## 2. Data stored by MerchantOS

| Category | Examples | Where stored | Retention |
|---|---|---|---|
| Account data | email, name, scrypt password hash, role | `users` table | until account is deleted |
| Store/business data | products, customers, suppliers, bills, ledger entries | business tables | until operator deletes |
| Payment records | sessions, events, evidence | `payment_sessions`, `payment_events` | until operator deletes |
| Audit log | who did what when | `audit_log` | until operator deletes (default: retained indefinitely) |
| Device data | device name, API key hash, last seen | `devices` table | until device is removed |
| Tokens | JWT access token (stateless, signed), refresh token (hashed) | refresh token table | access: 15 minutes; refresh: 30 days |
| Files | uploaded receipts, attachments | `uploads/` directory (operator-managed) | until operator deletes |
| Logs | application logs | stdout (operator's choice of log target) | operator-configured |

## 3. Personal data

Personal data is limited to what the merchant's own business operation requires. The merchant may optionally store customer phone numbers, email addresses and addresses. **The merchant is the data controller for the customer data they enter.** MerchantOS is a data processor in the GDPR / DPDP-Act sense; the operator is the controller.

### Customer data minimization

- Phone, email and address are optional fields. The merchant decides what to capture.
- The default export format includes all fields the merchant has stored. The merchant can request a customer-data export on their own customers' behalf.

### Customer rights (data subject rights)

If a customer of the merchant asks for their data, asks for correction, or asks for deletion, the operator (merchant) can fulfill that request directly with the MerchantOS UI or via the api:

- **Access:** `GET /api/customers/:id` returns everything stored.
- **Correction:** `PATCH /api/customers/:id` allows updating the fields.
- **Deletion:** `DELETE /api/customers/:id` soft-deletes (sets `deleted_at`); the row is hidden from queries but retained in the database for audit. Hard delete is available via direct SQL for operators who are sure they no longer need the row.

### Children's data

MerchantOS is not designed for, marketed to, or used by children. The operator is responsible for not using the system to record data about minors without appropriate consent.

## 4. Data processing and where it happens

- All data processing happens on the operator's own server.
- No third-party processor is involved unless the operator enables an integration that uses one (an AI provider, a webhook receiver, a payment gateway adapter). When enabled, the operator becomes the controller and the third party becomes a sub-processor.
- AI features (Ollama by default) can run entirely on the operator's hardware. Remote AI providers are an opt-in choice.

## 5. Cookies and tracking

The web SPA does not use cookies for tracking. The api sets a short-lived, SameSite=Lax, HttpOnly cookie only if the operator enables cookie-based auth; the default is `Authorization: Bearer <jwt>` header. The api does not set third-party cookies, advertising cookies, or analytics cookies. No third-party scripts are loaded by the SPA.

## 6. Data portability

The operator can export any business data via:

- `GET /api/admin/export/<entity>?format=json|csv` (api; OWNER role + `exports:read` permission)
- `bin/backup.cjs` (full PostgreSQL dump)
- Direct SQL (`pg_dump`)

There is no lock-in: the data is in standard PostgreSQL with documented schema migrations.

## 7. Data deletion and the right to be forgotten

To delete a merchant account and all of its data:

1. Stop the api.
2. Run `psql` to drop the database, or use `bin/restore.cjs` from a clean backup to start fresh.
3. Remove the `uploads/` directory.
4. Rotate any integration credentials (JWT secrets, webhook secrets) that were in the `.env` file.

Soft-delete (preserving the row for audit) is available for individual records via the api.

## 8. Breach notification

MerchantOS does not have visibility into the operator's infrastructure. The operator is responsible for monitoring their own server, detecting breaches, and notifying affected parties and regulators per applicable law. MerchantOS provides the `audit_log` table to support forensic analysis of any incident.

## 9. International transfers

The default MerchantOS deployment does not transfer any data across borders. Cross-border transfers only occur if the operator explicitly enables a remote integration (AI provider, payment gateway, etc.). When that happens, the operator is responsible for the lawful basis of the transfer under applicable law (e.g. Standard Contractual Clauses for GDPR, government notifications for DPDP Act).

## 10. Sub-processors

None in the default build. The operator's choice to enable an AI provider, payment gateway, or any other integration adds a sub-processor. The operator is responsible for the resulting data-flow inventory.

## 11. Contact

For privacy questions about the **MerchantOS software** itself (this repository), file an issue at https://github.com/AadityaLabsAI/MerchantOS/issues. For privacy questions about a **specific deployment**, contact the operator of that deployment.

## 12. Changes to this policy

Material changes will be committed to this file with a `docs:` commit and noted in `CHANGELOG.md`. The version date at the top of the file will be updated.
