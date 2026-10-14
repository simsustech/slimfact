# Privacy Policy

_Last updated: 30 August 2026_

This Privacy Policy explains how **simsustech** ("we", "us", "our") handles personal data in connection with **SlimFact** — available as a managed **Cloud** service at [slimfact.app](https://www.slimfact.app) and [demo.slimfact.app](https://demo.slimfact.app), and as a **Self-Hosted** open-source edition — and this documentation site.

Controller: **simsustech** — contact: [info@simsus.tech](mailto:info@simsus.tech), website: [simsus.tech](https://www.simsus.tech).

CoC: 83537813

If you have privacy questions or want to exercise your rights, contact us at [info@simsus.tech](mailto:info@simsus.tech).

---

## 1. Scope

- **Cloud** — When you use SlimFact Cloud we are the data controller (and for invoice/client data you enter, we act as processor on your behalf). This policy applies in full.
- **Self-Hosted** — When you self-host SlimFact on your own infrastructure, no application data is sent to us. You are the controller for all data in your instance. This policy then only covers your use of our website/docs/demo and support channels.
- **Documentation site** — `slimfact.app` docs are static and do not collect analytics by default.

---

## 2. Data we process

### 2.1 Account & authentication

- What: email address, name (if provided), password hash or OIDC subject/issuer, company name, user preferences.
- Purpose: provide accounts, authenticate via password or OpenID Connect, manage multi-company access.
- Basis: performance of contract (Art. 6(1)(b) GDPR), legitimate interest in secure authentication (Art. 6(1)(f)).

### 2.2 Invoicing content you create

- What: company details, client/customer records (names, emails, addresses, VAT IDs), invoices, bills, receipts, payment references you enter.
- Purpose: provide the invoicing service you request.
- Basis: contract (Art. 6(1)(b)), legal obligation for retention of business records where applicable (Art. 6(1)(c)). You are responsible for ensuring you have a lawful basis to share your customers' data with us.

### 2.3 Payments (online payments)

- What: payment status, amount, currency, PSP references, payer email where required for iDEAL/credit-card flows via **Mollie** or **Stripe**. We do not store full card numbers.
- Purpose: process and reconcile online payments, handle refunds/chargebacks where applicable.
- Basis: contract (Art. 6(1)(b)). Payment data is processed by Mollie/Stripe as independent controllers/processors under their own policies.

### 2.4 Email delivery & invoice-link tracking

- What: recipient address, subject, delivery status, bounce/complaint signals, and — when the recipient clicks the invoice link in the email — a `?eventType=emailOpened` event that records that the invoice was opened via the email link.
- Purpose: deliver invoice emails and show you delivery status and whether the invoice link was clicked.
- Basis: contract (Art. 6(1)(b)) and legitimate interest in confirming delivery/viewing of invoices (Art. 6(1)(f)). This is link-click tracking only — no invisible pixel, no automatic open detection without a click.

### 2.5 Support & contact

- What: messages you send to [info@simsus.tech](mailto:info@simsus.tech), demo requests, GitHub issues you open.
- Purpose: answer questions, provide support.
- Basis: contract/pre-contract (Art. 6(1)(b)), legitimate interest (Art. 6(1)(f)).

### 2.6 Logs & security

- What: IP address, user-agent, timestamps, error logs, rate-limit counters.
- Purpose: security, abuse prevention, debugging, ensuring availability.
- Basis: legitimate interest (Art. 6(1)(f)), legal obligation where logging is required.
- Retention: short-lived (typically 30 days) unless needed longer for incident investigation.

---

## 3. Cookies

SlimFact uses only **strictly necessary** cookies:

- Session/authentication cookies (including OIDC state/nonce and CSRF tokens) — required to keep you logged in.
- Preference cookies (e.g. language/locale) — functional.

There are **no analytics or advertising cookies** on the Cloud app or docs site by default. Invoice emails contain a normal link to view the invoice (`https://…/invoice/{uuid}?eventType=emailOpened`). Only if the recipient clicks that link is an `emailOpened` event recorded — no invisible tracking pixel is used.

If we ever add analytics (e.g. Plausible), we will update this section and, where required, request consent.

---

## 4. Subprocessors (Cloud)

For Cloud we rely on the following categories of processors, all instructed to process data only on our behalf:

| Category                  | Provider                                                  | Location                  | Purpose                                       |
| ------------------------- | --------------------------------------------------------- | ------------------------- | --------------------------------------------- |
| Hosting & infrastructure  | EU-based hosting provider (e.g. Hetzner / EU data centre) | EU/EEA                    | Application & database hosting, daily backups |
| Payment service providers | **Mollie B.V.** and **Stripe, Inc.**                      | EU / US (with safeguards) | Online payments (iDEAL, cards)                |
| Email delivery            | Transactional email provider (SMTP)                       | EU/EEA                    | Delivering invoice & system emails            |

We may replace providers with equivalent EU/EEA alternatives — updates will be reflected here. Stripe transfers to the US are covered by Standard Contractual Clauses.

Self-Hosted instances have no subprocessors from us.

---

## 5. Hosting location & international transfers

Cloud data is hosted in the **EU/EEA**. We do not intentionally transfer personal data outside the EEA except where a payment provider (Stripe) or you (e.g. forwarding an invoice to a non-EEA recipient) requires it. Where transfers occur, we rely on adequacy decisions or Standard Contractual Clauses.

---

## 6. Retention

- Account & company data: while your account is active, plus 30 days after deletion to allow recovery, unless longer retention is required by law.
- Invoices/bills/receipts & related client records: retained while your account is active. After account deletion, removed within 30 days unless tax/accounting law requires longer (typically 7–10 years for invoice records — we will inform you where applicable and minimise what is retained).
- Email logs: 90 days.
- Security logs: 30 days.
- Support correspondence: 2 years.

You can export your data (including invoices as PDF/UBL/CSV) at any time before deletion and request erasure subject to legal retention duties.

---

## 7. Your rights (GDPR)

If EU/EEA data protection law applies, you have the right to:

- **Access** your personal data
- **Rectification** of inaccurate data
- **Erasure** ("right to be forgotten"), subject to legal retention
- **Restriction** of processing
- **Data portability** (export in structured formats)
- **Object** to processing based on legitimate interest
- **Withdraw consent** where processing is based on consent
- **Lodge a complaint** with your supervisory authority (e.g. the Dutch _Autoriteit Persoonsgegevens_ if you are in the Netherlands, or your local DPA).

To exercise rights, email [info@simsus.tech](mailto:info@simsus.tech). We respond within one month.

If you are a SlimFact customer handling your own end-customers' data, you are the controller for that customer data — ensure you handle data-subject requests from your customers and forward any that require our assistance.

---

## 8. Security

We apply appropriate technical and organisational measures: TLS/SSL for all connections, encrypted session cookies, daily encrypted backups, least-privilege database access, security patches and automatic updates for Cloud, and OIDC-based SSO where enabled. No system is perfectly secure — please use strong passwords and keep OIDC provider credentials safe.

---

## 9. Changes to this policy

We may update this policy to reflect service or legal changes. Material changes will be announced via the docs site and, for Cloud customers, by email. The "Last updated" date at the top indicates the current version.

---

## 10. Contact

Questions about this policy or our privacy practices:

- **Email:** [info@simsus.tech](mailto:info@simsus.tech)
- **Website:** [simsus.tech](https://www.simsus.tech)
- **GitHub:** [simsustech/slimfact](https://github.com/simsustech/slimfact)

For self-hosted deployments, your privacy contact for end-customer data is your own organisation — this policy does not replace your own privacy statement to your customers.
