# Features

SlimFact is the invoicing platform that does the heavy lifting. From creating an invoice to getting paid — everything you need in one clean package.

---

## 📄 Invoices, Bills & Receipts

One system, three document types. Create professional invoices, send bills, and issue receipts. Each flows naturally into the next:

- **Bill** → paid → **Receipt** → **Invoice** — convert as the transaction progresses
- Immutable once opened — your records stay clean and auditable
- Tax rates per line, inclusive or exclusive — handle any tax scenario
- Decimal quantities and per-mille support — precision where it matters
- Due dates, payment terms, and automatic status tracking

![Invoice management](/screenshots/admin-invoices.png)

---

## 💳 Online Payments

Your customers pay online. You get notified. No manual reconciliation.

- **iDEAL / Wero** — the most popular Dutch online payment method
- **Credit cards** — Visa, Mastercard, and more
- **Multi-PSP routing** — route iDEAL through Mollie and credit cards through Stripe, or mix and match
- **Down payments** — require partial payment upfront
- **Cash & bank transfer** — for offline payments with transaction tracking
- **Automatic status sync** — webhooks update invoice status when payment completes
- **Refunds** — process refunds directly through your PSP

![Bill management](/screenshots/admin-bills.png)

---

## 🔄 Subscription Billing

Set it and forget it. Recurring invoices run on cron schedules while you focus on your business.

- Cron-based scheduling — every Monday, first of the month, quarterly, whatever you need
- Start and end dates — subscriptions that run for a fixed period
- Active/inactive toggle — pause subscriptions without deleting them
- Each subscription generates proper numbered invoices automatically

![Subscription management](/screenshots/admin-subscriptions.png)

---

## 📊 Admin Dashboard

A real-time overview of your invoicing business.

- Revenue cards and a click-to-zoom revenue chart with day/week/month/quarter granularity
- Status overview and overdue aging buckets — needs reminder, reminder sent, second reminder, exhortation
- Upcoming income and a payment-method breakdown per period
- Recent activity feed of invoices, bills, payments, reminders, and exhortations

## 👤 Client Portal

Your customers get their own space. They see what they owe, when it's due, and can pay right there.

- Personal dashboard with all invoices, bills, and receipts
- Pay online directly from the invoice page
- Real-time status updates — pending, open, paid
- No account creation needed — share the invoice link and they're in

![Customer bills](/screenshots/customer-bills.png)

---

## 🏢 Companies & Clients

Run multiple businesses from one account. Each company gets its own identity.

- **Company profiles** — name, address, banking details, VAT ID, CoC number, logo
- **Company-specific prefixes** — keep invoice numbers separate per company
- **Client records** — contact person, address, email, VAT ID
- **Number prefix templates** — `{year}-{num}`, `INV-{company}-{num}`, whatever you need
- **Configurable starting numbers** — pick up where your old system left off

![Company management](/screenshots/admin-companies.png)

![Client management](/screenshots/admin-clients.png)

---

## 📧 Email & Communication

Send invoices by email. Know when the link is clicked.

- **Customizable email templates** — Handlebars-powered with per-locale variants
- **Link tracking** — shows when a customer clicks the invoice link from their email
- **Per-company email settings** — different sender addresses and BCC per company
- **Send, resend, reply** — full email workflow from the invoice detail view

---

## 🎨 Typst Invoice Rendering

SlimFact uses [Typst](https://typst.app) — a modern, open-source typesetting engine — to render invoices. Unlike traditional HTML-to-PDF converters, Typst produces crisp, perfectly aligned layouts with professional-grade typography.

- **SVG preview** — invoices render instantly in the browser as scalable SVG, with zero layout shifts
- **PDF export** — one-click download as a print-ready PDF with embedded fonts
- **Multi-language templates** — English, Dutch, and German invoice templates with localized field names, date formats, and payment instructions
- **Customizable templates** — invoice layouts are written in Typst, a clean, readable markup language. You can add your own templates for custom branding, different document types, or industry-specific layouts
- **Company branding** — logo, address, banking details, and CoC/VAT numbers rendered inline
- **Flexible layouts** — A4 and US Letter page sizes, inclusive/exclusive tax display, automatic multiline descriptions
- **Invoice type awareness** — automatically shows the correct title (Invoice, Bill, Receipt, or Concept) based on document status
- **EPC QR codes** — scannable payment QR codes embedded directly in the PDF for instant bank transfers

![Typst invoice preview](/screenshots/invoice-public.png)

[Download sample invoice PDF](/screenshots/invoice.pdf)

## 📦 Exports & Formats

- **PDF** — download from the public invoice page
- **Digiboox** — format for Digiboox integration (Settings → Exports)
- **EPC QR codes** — scannable payment codes on every PDF invoice
- **UBL XML** — attached automatically to sent OPEN/PAID invoice emails

---

## 🔌 Headless API

SlimFact is API-first. Every feature available in the UI is also available through the API.

- **tRPC** — type-safe RPC with automatic client generation
- **OIDC authentication** — works headless with any OIDC provider
- **Webhook callbacks** — get notified of payment events
- Build custom frontends, integrate with your ERP, or automate your entire billing workflow

---

## 🔐 Authentication & Security

Your data stays yours. Authentication is handled by your existing identity provider.

- **OpenID Connect** — federated SSO with any OIDC provider
- **Multiple roles** — administrator, point of sale, and customer
- **No separate user database** — your IdP is the source of truth

---

## 📱 Technical Excellence

- **Fully responsive** — works on desktop, tablet, and mobile

![SlimFact on mobile](/screenshots/homepage-mobile.png)

- **Database-backed** — all invoices stored in PostgreSQL for advanced querying
- **On-the-fly PDF generation** — no stale files, always the latest template
- **Multi-language** — English, Dutch, and German UI
- **Self-hosted** — runs on your own infrastructure with Docker Compose
- **~160 req/s** — handles over 14 million API calls per day on modest hardware

![SlimFact homepage](/screenshots/homepage.png)
