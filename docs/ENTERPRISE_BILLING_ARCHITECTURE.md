# SkyGrid Intelligence — Enterprise Billing, Access Control & Payment Architecture

**Company:** Akanno Tech Labs Limited (Incorporated in Nigeria)  
**Product:** SkyGrid Intelligence (Prototype / Evaluation Platform transitioning to Commercial B2B SaaS)  
**Current Billing Status:** `ENABLE_LIVE_BILLING=false` (Provisional Commercial Pricing — Enquiry Only; Live Payments Not Active)

---

## 1. Current State vs. Target Production State

| Capability | Current Status (Evaluation Mode) | Target Production State |
| :--- | :--- | :--- |
| **Commercial Pricing** | Provisional tiers on Public Landing Page only (`$2,500`, `$7,500`, `$25,000/mo`) | Contract-backed SaaS subscriptions & institutional MSAs |
| **Checkout Flow** | Enquiry-only (`POST /api/v1/enquiries`); live checkout returns `503` | FastAPI-initiated checkout session via Paystack / Flutterwave |
| **API Key Provisioning** | Public minting **disabled** (`403` without `x-admin-secret`); read-only `DEMO_EVALUATION` sandbox key | Automated issuance **only** after cryptographically signed webhook verification |
| **Paid Access Enforcement** | Server-side DB check (`require_paid_enterprise` returns `402 Payment Required` for unpaid keys) | Active subscription + non-expired `expires_at` + organization status check |
| **Settlement Account** | No bank details hardcoded or exposed | Verified Akanno Tech Labs Limited corporate settlement account |

---

## 2. Target Data Model (Implemented in `backend/database.py`)

1. **`organizations`**: Legal entity name, corporate billing email, jurisdiction/country, KYC/onboarding status.
2. **`subscriptions`**: Links `org_id` to `license_type`, `provider` (`paystack` | `flutterwave`), `provider_subscription_id`, `status` (`INACTIVE`, `ACTIVE`, `PAST_DUE`, `CANCELLED`, `EXPIRED`), `current_period_start`, `current_period_end`, `cancel_at_period_end`.
3. **`billing_orders`**: Server-created pending orders (`order_ref`, USD base amount, currency-converted amount, `payment_status`, `gateway_reference`, `api_key_id`).
4. **`api_keys`**: Stores **only** SHA-256 `key_hash`, `key_prefix`, `org_id`, `tier`, `rate_limit_rpm`, `is_active`, `is_paid_enterprise`, `subscription_status` (`DEMO_EVALUATION` | `VERIFIED_PAID` | `REVOKED`), and `expires_at`.
5. **`billing_audit_events`**: Immutable audit log storing every webhook validation result (SHA-256 payload hash, verification pass/fail, actor, timestamp), activation, renewal, revocation, and refund event.
6. **`enterprise_enquiries`**: Records commercial licensing requests submitted from the public landing page.

---

## 3. Secure End-to-End Subscription Flow (Future Activation)

```text
[1. Customer selects tier on Landing Page / Portal]
        │
        ▼
[2. FastAPI POST /api/v1/billing/checkout/initiate]
    - Validates authenticated organization account
    - Computes canonical amount on the server (never trusts client price)
    - Creates PENDING billing_orders record
    - Calls Paystack/Flutterwave API using backend-only SECRET_KEY
    - Returns hosted checkout authorization URL to browser
        │
        ▼
[3. Customer completes payment on Provider-hosted Checkout]
        │
        ▼
[4. Provider sends Server-to-Server Webhook -> FastAPI]
    - Paystack: verify `x-paystack-signature` (HMAC-SHA512 over raw body)
    - Flutterwave: verify `verif-hash` (constant-time digest vs FLUTTERWAVE_WEBHOOK_HASH)
    - Reject invalid/missing signatures with HTTP 401 and log to `billing_audit_events`
    - Re-query Provider transaction verification API to confirm settled amount & currency
    - Enforce idempotency on `order_ref` (ignore duplicate webhooks safely)
        │
        ▼
[5. Server-Side Entitlement Activation]
    - Update `billing_orders.payment_status = 'PAID'`
    - Create/extend `subscriptions` record (`current_period_end = now + 30d` or `+365d`)
    - Provision `sk_live_...` key (`is_paid_enterprise = 1`, `expires_at = current_period_end`)
    - Deliver key securely via authenticated organization dashboard (shown once)
```

---

## 4. Security Non-Negotiables

- **Zero Client Trust:** Never trust a frontend flag, query parameter, `Referer` header, or client-supplied callback to mark an order `PAID` or grant `is_paid_enterprise=True`.
- **Secrets Stay on Render Backend:** `PAYSTACK_SECRET_KEY`, `FLUTTERWAVE_SECRET_KEY`, `FLUTTERWAVE_WEBHOOK_HASH`, and `SKYGRID_ADMIN_SECRET` must exist **only** in Render environment variables—never in Vite (`VITE_*`) or frontend source code.
- **No Unauthenticated Key Minting:** `POST /api/v1/auth/keys` and `DELETE /api/v1/auth/keys/{id}` require server-configured `x-admin-secret` authorization (`403 Forbidden` otherwise).

---

## 5. Corporate Settlement Onboarding (Akanno Tech Labs Limited — Nigeria)

1. Complete CAC corporate banking onboarding for **Akanno Tech Labs Limited** (Nigerian corporate NGN and/or USD domiciliary account).
2. Complete KYB / merchant compliance verification with **Paystack** or **Flutterwave** using corporate registration documents (CAC Certificate, TIN, Board Resolution, Corporate Bank Account).
3. Configure live credentials **only** on the Render backend service:
   - `PAYMENT_GATEWAY=paystack` (or `flutterwave`)
   - `PAYSTACK_PUBLIC_KEY` / `PAYSTACK_SECRET_KEY` (or Flutterwave equivalents + `FLUTTERWAVE_WEBHOOK_HASH`)
   - `ENABLE_LIVE_BILLING=true`
4. Register the production webhook URL (`https://<render-host>/api/v1/billing/webhook/paystack` or `/flutterwave`) inside the provider dashboard.

---

## 6. Legal & Accounting Separation: SaaS Revenue vs. Foreign Equity Investment

- **SaaS Customer Subscription Payments** (Regional Hub, Global Cargo Carrier, Sovereign Airspace licenses):
  - Classified as **commercial operating revenue** (software/API service exports or domestic SaaS invoices).
  - Routed through verified merchant payment processors (Paystack / Flutterwave) or invoiced corporate revenue settlement accounts.
  - Subject to commercial invoicing, VAT/WHT compliance as applicable, and deferred revenue recognition across subscription terms.
- **Foreign Equity Investment Inflows** (venture capital, angel, or strategic equity rounds):
  - Must **never** pass through SaaS checkout gateways or be commingled with customer subscription settlements.
  - Must be wired directly to Akanno Tech Labs Limited's designated corporate bank account through an authorized dealer bank in Nigeria with a **Central Bank of Nigeria (CBN) Electronic Certificate of Capital Importation (e-CCI)** so foreign investors retain statutory capital repatriation rights.

---

## 7. Subscription Lifecycle Requirements

- **Recurring Billing & Renewals:** Use provider subscription/plan codes (`PLN_...`) or scheduled invoice reminders; listen for `invoice.payment_failed` / `subscription.disable` webhooks to transition `status` to `PAST_DUE` with a configurable 7-day grace window before revoking API access (`expires_at`).
- **Invoicing:** Issue sequentially numbered corporate tax/commercial invoices (`INV-ATL-YYYY-NNNN`) tied to `billing_orders` and `organizations`.
- **Cancellations:** Set `cancel_at_period_end = 1` via authenticated organization admin action so access continues cleanly through `current_period_end` without surprise mid-cycle cutoff.
- **Refunds & Chargebacks:** Process refunds through provider server APIs, log an audit entry in `billing_audit_events`, update order state to `REFUNDED`, and immediately revoke associated `api_keys` (`is_active = 0`).
