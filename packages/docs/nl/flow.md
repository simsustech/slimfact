# SlimFact Document Flow

A complete reference for how bills, receipts, invoices, payments, refunds, reminders, exhortations, and subscriptions work in SlimFact.

---

## Statuses

### InvoiceStatus

| Status | Meaning |
|--------|---------|
| `CONCEPT` | Draft — still being edited, not yet sent |
| `OPEN` | Sent to customer, awaiting payment (immutable) |
| `PAID` | Fully paid |
| `BILL` | A payment request — not an invoice yet |
| `RECEIPT` | Proof of payment — created from a paid bill |
| `CANCELED` | Void |

### PaymentStatus (checkout.payments)

`OPEN`, `CANCELED`, `PENDING`, `AUTHORIZED`, `EXPIRED`, `FAILED`, `PAID`

### RefundStatus (checkout.refunds)

`QUEUED`, `PENDING`, `PROCESSING`, `REFUNDED`, `FAILED`, `CANCELED`

---

## Invoice Lifecycle

```
                               ┌──────────┐
                               │ CANCELED │ ← terminal
                               └──────────┘
                                    ^
                                    │ cancelInvoice (any status)
    ┌───────────────────────────────┼───────────────────────────────┐
    │                               │                               │
    v                               │                               v
┌─────────┐                         │                          ┌─────────┐
│ CONCEPT │─────────────────────────┤                          │  BILL   │
│ (draft) │                         │                          │         │
└─────────┘                         │                          └─────────┘
    │                               │                               │
    │ sendInvoice                   │                               │ sendReceipt
    │ (assigns number, date,        │                               │ (amountDue must be 0)
    │  due date)                    │                               │
    │                               │                               v
    v                               │                          ┌─────────┐
┌─────────┐                         │                          │ RECEIPT │
│  OPEN   │─────────────────────────┤                          │ (proof) │
│ (sent)  │                         │                          └─────────┘
└─────────┘                         │                               │
    │                               │                               │ sendInvoice
    │ payment covers                │                               │ (converts to OPEN)
    │ amountDue                     │                               │
    v                               │                               v
┌─────────┐                     (can cancel                    ┌─────────┐
│  PAID   │                      any status)                   │  OPEN   │
└─────────┘                                                    └─────────┘
                                                                   │
                                                                   │ payment
                                                                   v
                                                              ┌─────────┐
                                                              │  PAID   │
                                                              └─────────┘
```

---

## Valid Transitions (setInvoiceStatus)

| From | To | Condition |
|------|----|-----------|
| CONCEPT | OPEN | Direct — `sendInvoice` assigns number, date, due date |
| CONCEPT | CANCELED | Direct |
| BILL | OPEN | Direct — `sendInvoice` |
| BILL | RECEIPT | `amountDue` must be 0 (fully paid). Only from BILL or RECEIPT |
| BILL | CANCELED | Direct |
| OPEN | PAID | `amountDue` must be 0 |
| OPEN | CANCELED | Direct |
| PAID | CANCELED | Direct |
| RECEIPT | OPEN | Direct — `sendInvoice` converts receipt to invoice |
| RECEIPT | CANCELED | Direct |

**Blocked transitions:**

| Attempt | Reason |
|---------|--------|
| Any → CONCEPT | "Cannot convert an invoice back to concept" |
| Any → RECEIPT (except BILL) | "Can only create receipts for bills" |
| Any → RECEIPT when `amountDue > 0` | "Cannot create a receipt when amount due is not zero" |
| Any → PAID when `amountDue > 0` | "Cannot set paid status when amount due is not zero" |

---

## Document Types & Semantics

### Invoice

- Starts as **CONCEPT** (draft)
- `sendInvoice` → **OPEN**: assigns invoice number, date, and due date. Becomes immutable.
- Payment received → **PAID**
- Can be canceled at any stage

### Bill

- Created with status **BILL**
- Behaves like an invoice but represents a payment request
- **Must be paid first** before it can become a receipt
- `sendReceipt` → **RECEIPT** (requires `amountDue === 0`)
- Subscription cron jobs can create bills by setting `type: 'bill'`

### Receipt

- Created from a **paid** bill via `sendReceipt`
- Proof of payment document
- Can be converted to an invoice via `sendInvoice` (status → OPEN)
- PDF rendering shows tax-inclusive amounts (like bills)

---

## Numbering

Invoice numbers are assigned when status transitions to **OPEN** (via `sendInvoice`). The number is assigned atomically using a serializable transaction:

1. Read `initialNumberForPrefix` by `numberPrefixTemplate`
2. Count existing OPEN invoices with same prefix
3. Compute next number: `initialNumber + count`
4. Fill in `{num}`, `{year}`, `{month}` placeholders in the template

CONCEPT and BILL invoices have no number yet. RECEIPT invoices get a number when converted to OPEN.

---

## Payment Flow

### Adding a Payment

1. Admin or customer calls `addPaymentToInvoice`
2. Payment method routing:
   - `ideal` → `IDEAL_PAYMENT_HANDLER` env var (default: `mollie`)
   - `creditcard` → `CREDITCARD_PAYMENT_HANDLER` env var (default: `stripe`)
   - `cash` → always available
   - `bankTransfer` → always available
   - `pin` → available if `pinEnabled`
3. PSP handler's `createPayment` creates an external payment record and a local `checkout.payments` row
4. If online payment (iDEAL/creditcard): returns `checkoutUrl` for redirect
5. If offline (cash/bank transfer): records payment immediately

### Webhook Settlement

**Mollie** (`POST /mollie/webhook`):
1. Receives `{ id: molliePaymentId }`
2. Looks up local payment by `externalId`
3. Calls `mollieHandler.settlePayment({ externalId })` → syncs status from Mollie
4. If `amountPaid >= totalIncludingTax` and status is `OPEN` → `setInvoiceStatus(PAID)`
5. Calls `fetchWebhookUrl(invoice)` if external webhook URL configured

**Stripe** (`POST /stripe/webhook`):
1. Verifies webhook signature using `STRIPE_WEBHOOK_SECRET`
2. Filters for `checkout.session.completed` or `payment_intent.succeeded`
3. Idempotency guard: checks if invoice was already OPEN before transitioning
4. Calls `stripeHandler.settlePayment({ externalId })` → syncs from Stripe
5. If `wasOpen === true` and fully paid → `setInvoiceStatus(PAID)`
6. Calls `fetchWebhookUrl(invoice)`

### Refunds

1. Admin calls `refundInvoice({ id })`
2. Finds the highest paid payment from a supported PSP where `amountDue < 0`
3. Calls PSP's `refundPayment({ id, amount: -amountDue })`
4. PSP creates external refund, inserts into `checkout.refunds`
5. A daily cron job (`checkRefunds`, runs at midnight) syncs pending refund statuses

---

## Reminders & Exhortations

### Flow

```
Invoice due date passes
    │
    ├─ 1st reminder (send immediately after due)
    │       │
    │       └─ Must wait 7 days after last reminder
    │
    ├─ 2nd reminder (7 days after 1st)
    │       │
    │       └─ Must wait 7 days after last reminder
    │
    └─ Exhortation (7 days after 2nd)
            │
            └─ Requires at least 2 reminders sent
```

### Rules

- **Max 2 reminders** — after 2, you must send an exhortation instead
- **7-day waiting period** between each reminder/exhortation
- Invoice must be past its due date
- Email templates for `remindInvoice` and `exhortInvoice` are customizable per locale
- `reminderSentDates` is tracked on the invoice

---

## Subscriptions

### Creating a Subscription

1. Admin creates a subscription with:
   - `companyId`, `clientId`, `numberPrefixTemplate`
   - `cronSchedule` — standard cron expression
   - `startDate`, optional `endDate`
   - `type` — `'invoice'` or `'bill'`
   - `lines[]` — same as invoice lines

### How It Runs

1. `startSubscription` is called when a subscription is created or activated
2. Fetches company/client details from DB
3. Builds a `RawNewInvoice`:
   - If `type === 'bill'`: `status = InvoiceStatus.BILL`
   - If `type === 'invoice'`: `status = undefined` (defaults to CONCEPT)
4. Creates a pg-boss job queue named `subscription.{uuid}`
5. Schedules the cron with the subscription's cron expression
6. Each cron tick: `invoiceHandler.createInvoice(job.data)` creates a new invoice
7. The new invoice gets its own number when sent (via `sendInvoice`)

### Managing Subscriptions

- **Active/inactive toggle** — calls `stopSubscription` or `startSubscription`
- **Edit** — updates subscription and restarts the cron job
- **Delete** — stops the cron job and removes the record

---

## Key Environment Variables

| Variable | Purpose |
|----------|---------|
| `MOLLIE_API_KEY` | Mollie API key (test/live) |
| `MOLLIE_API_KEY_<PREFIX>` | Company-specific Mollie key (multi-company) |
| `STRIPE_API_KEY` | Stripe secret key |
| `STRIPE_API_KEY_<PREFIX>` | Company-specific Stripe key (multi-company) |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret for signature verification |
| `IDEAL_PAYMENT_HANDLER` | `mollie` or `stripe` (default: `mollie`) |
| `CREDITCARD_PAYMENT_HANDLER` | `mollie` or `stripe` (default: `stripe`) |
| `MODULARAPI_ADMIN_PASSWORD` | Password for the seed-created admin account |

---

## Email System

### Event Types

| Event | Template Name | Trigger |
|-------|---------------|---------|
| `sendInvoice` | `sendInvoice` | Admin/public sends an invoice |
| `sendReceipt` | `sendReceipt` | Admin converts bill to receipt |
| `remindInvoice` | `remindInvoice` | Admin sends a payment reminder |
| `exhortInvoice` | `exhortInvoice` | Admin sends a formal exhortation |
| `replyInvoice` | `replyInvoice` | Admin replies to invoice thread |

### Features

- **Handlebars templates** — `{{numberPrefix}}`, `{{num}}`, `{{totalIncludingTax}}`, etc.
- **Per-locale variants** — `en-US`, `nl-NL`, `de-DE`
- **Open tracking** — `?eventType=emailOpened` queryparameter in de factuurlink
- **Per-company settings** — custom `MAIL_FROM`, `EMAIL_BCC` per company
- **PDF attachment** — invoice PDF attached automatically on every send/remind/exhort
- **UBL XML attachment** — attached automatically when sending OPEN/PAID invoices
