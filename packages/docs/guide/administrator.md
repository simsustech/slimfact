# Administrator Guide

This guide covers everything administrators can do — from creating your first invoice to configuring the whole system.

---

## Navigation

As an administrator, your sidebar gives you access to:

- **Invoices** — create and manage invoices
- **Bills** — create and manage bills
- **Receipts** — view and manage receipts
- **Subscriptions** — set up recurring billing
- **Clients** — manage your customer records
- **Settings** — companies, number prefixes, exports, accounts

---

## Getting Started

Before you create your first invoice, set up the basics:

### 1. Create a Company

1. Go to **Settings → Companies**
2. Click the **+** button
3. Fill in your company details:
   - **Name**, address, postal code, city, country
   - **Contact person**, telephone, website
   - **CoC number**, **IBAN**, **BIC**, **VAT ID number**
   - **Prefix** — a short code that identifies this company (e.g., "ACME")
   - **Email** — the sender address for invoices
4. Click **Submit**

![Company management](/screenshots/admin-companies.png)

### 2. Create a Client

1. Go to **Clients**
2. Click the **+** button
3. Fill in:
   - **Company name**, **contact person**
   - **Address**, postal code, city, country
   - **Email** — where invoices are sent
   - VAT ID and CoC number (optional)
4. Click **Submit**

![Client management](/screenshots/admin-clients.png)

### 3. Set Up Number Prefixes

Number prefixes control how your invoice numbers look.

1. Go to **Settings → Number prefixes**
2. Click **+** to add a new template
3. Set the template, for example: `{year}-{num}` or `F{year}{month}-{num}`
4. Set the initial number — the first invoice will start from this number
5. Click **Submit**

![Number prefix configuration](/screenshots/admin-numberprefixes.png)

---

## Creating Invoices

### Invoices

1. Go to **Invoices**
2. Click the **+** button
3. Select the **Company** and **Client**
4. Choose a **Number prefix**
5. Add **Lines** — click the line item to set description, unit price, quantity, and tax rate
6. Optionally add discounts or surcharges
7. Click **Submit**
8. The invoice is created in **Concept** status

![Invoice management](/screenshots/admin-invoices.png)

### Sending an Invoice

1. Expand the invoice by clicking its toggle icon
2. Click the **More** menu (⋮)
3. Click **Send**
4. Add a subject and message (optional)
5. Click **Send** — the invoice status changes to **Open** and the customer gets an email

### Invoice Actions

Once an invoice is expanded, the More menu gives you:

| Action | What it does |
|--------|-------------|
| **Edit** | Modify the invoice (only when Draft) |
| **Send** | Email the invoice to the customer |
| **Open** | Get the public invoice link |
| **Add payment** | Record a cash or bank transfer payment |
| **Cancel** | Cancel the invoice |
| **Download** | Download button — PDF and UBL XML |
| **Delete** | Remove the invoice (only when Concept) |
| **Send reminder** | Send a payment reminder to the customer |
| **Send exhortation** | Send a formal exhortation after a reminder |

### Invoice Status Flow

```
CONCEPT → OPEN → PAID / CANCELLED
```

- **Concept** — still editing, not yet sent
- **Open** — sent to customer, awaiting payment (immutable)
- **Paid** — payment received
- **Cancelled** — no longer valid

### Reminders & Exhortations

When an invoice is overdue, you can send payment reminders:

- **Send reminder** — the first reminder can be sent once the payment term expires. A second reminder is available 7 days later. After two reminders, you'll be prompted to send an exhortation instead.
- **Send exhortation** — a formal demand for payment, available 7 days after the second reminder.

The invoice shows when reminders were sent. Email templates for both are customizable under Settings.

---

## Bills

Bills work just like invoices but start with a different intent. Create a bill when you want to request payment. Once paid, convert it to a receipt — proof of payment.

1. Go to **Bills**
2. Click **+** and fill in the details (same as invoices)
3. Click **Submit**

![Bill management](/screenshots/admin-bills.png)

Once a bill is paid, it can be converted to a receipt. A receipt can then be converted to an invoice.

### Sending a Bill

1. Expand the bill and click the **More** menu (⋮)
2. Click **Send**
3. Add a subject and message
4. Click **Send** — the customer receives an email with the payment request

### Converting a Bill

1. Once the bill is paid, expand it and open the **More** menu
2. Click **Convert to receipt**
3. The bill becomes a receipt — you can now convert it further to an invoice

## Receipts

Receipts are proof of payment. They're created by converting a paid bill.

- View receipts under **Receipts** in the sidebar
- Receipts are created from paid bills. They can be converted to paid invoices

---

## Subscriptions

Set up recurring invoices that generate automatically.

### Creating a Subscription

1. Go to **Subscriptions**
2. Click **+**
3. Select the **Company**, **Client**, and **Number prefix**
4. Choose the **Type** — invoice or bill
5. Add line items — same as invoices
6. Set the **Cron schedule**:
   - `0 0 1 * *` — first of every month
   - `0 0 * * 1` — every Monday
   - `0 0 1 */3 *` — every 3 months
7. Set **Start date** and optionally **End date**
8. Click **Submit**

![Subscription management](/screenshots/admin-subscriptions.png)

### Managing Subscriptions

- **Toggle active/inactive** — pause without deleting
- **Edit** — change the schedule, lines, or details
- **Delete** — remove permanently

---

## Online Payments

SlimFact supports multiple payment service providers.

### Configuring Mollie

Set `MOLLIE_API_KEY` and SlimFact handles the rest. For multi-company setups, add company-specific keys with `MOLLIE_API_KEY_<PREFIX>`.

### Configuring Stripe

Set `STRIPE_API_KEY`. Same multi-company pattern: `STRIPE_API_KEY_<PREFIX>`.

### Payment Method Routing

Control which PSP handles which payment method:

| Env variable | Default | Options |
|-------------|---------|---------|
| `IDEAL_PAYMENT_HANDLER` | Mollie | `mollie` or `stripe` |
| `CREDITCARD_PAYMENT_HANDLER` | Stripe | `mollie` or `stripe` |

### Cash & Bank Transfer

These are offline payment methods. Record cash payments or bank transfers manually from the invoice's More menu.

### Refunds

1. Open a paid invoice
2. From the More menu, select the refund option
3. The refund is processed through the original PSP

---

## Exports

### Downloading

1. Expand an invoice
2. Click the **download** dropdown button — PDF or UBL XML
3. The file is generated on the fly with your company branding

> When sending an invoice by email, the PDF is attached automatically. If the invoice is OPEN or PAID, a UBL XML is also attached.

### Export Formats

Go to **Settings → Exports** to access:

- **Digiboox** — export invoices in Digiboox format

![Export options](/screenshots/admin-exports.png)

---

## Email Tracking

When you send an invoice by email, a URL query parameter is appended. When the customer opens the email and the image loads, the query is triggered and SlimFact records the event.

---

## Tips

- **Set up your company first** — an invoice needs a sender
- **Use number prefixes consistently** — pick a format and stick with it
- **Review drafts before sending** — invoices become immutable once opened
- **Check subscription schedules** — make sure cron expressions are correct
- **Monitor email opens** — know when customers are engaging with your invoices
