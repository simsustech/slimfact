# Why SlimFact

Off-the-shelf invoicing software works for standard use cases. But if your business has specific needs — custom workflows, unique document formats, specialized integrations — you usually hit a wall.

SlimFact is open-source and API-first. Not just configurable: **adaptable.** You own the code, the data, and the entire pipeline. If it doesn't do exactly what you need, you can make it.

---

## What You Can Customize

| Area | What's possible |
|---|---|
| **Invoice PDF templates** | Write your own Typst template — full control over layout, fonts, colors, and content. Or create multiple templates for different document types |
| **Email templates** | Handlebars-powered with per-locale variants — any structure, any content, any language |
| **API behavior** | Modify server code for custom business logic — the full source is yours |
| **Payment routing** | Route iDEAL through one PSP, credit cards through another. Add your own PSP handler if needed |
| **Invoice numbering** | Any format with dynamic segments — `{year}-{num}`, `INV-{company}-{month}-{num}`, whatever fits your scheme |
| **Auth flows** | Any OIDC provider, any role model — bring your own identity and permission structure |
| **Database** | Direct SQL access to PostgreSQL — query, report, and extend beyond the API |
| **Frontend** | Build your own UI on top of the API, or customize the existing Vue 3 frontend |
| **Multi-language** | EN / NL / DE included — more languages can be added on request |

---

## Open-Source — Adapt the Full Stack

SlimFact is open-source under the ELv2 license. You can self-host the identical application for free — no feature limitations, no trial period.

- **Full source access** — inspect, modify, and extend every layer: database schema, rendering pipeline, authentication, payment routing
- **Self-host for free** — the same code that runs the cloud runs on your infrastructure
- **Your data, your database** — everything lives in PostgreSQL. No proprietary storage, no export hurdles
- **Customize deeply** — modify API behavior, add custom business logic, change PDF templates, wire in different PSPs
- **No vendor lock-in** — because you own the code. Leave, fork, extend — always your choice

---

## Headless API — Embed Invoicing Into Your Software

SlimFact is built API-first. Every feature available in the web UI is also available through a type-safe tRPC API — no separate code paths, no feature gaps, no rate limits on self-host.

**Use SlimFact as your invoicing backend.** Your application calls the API to create invoices, process payments, generate PDFs, and sync status — all without ever showing SlimFact's UI to your users.

- **Embed in SaaS platforms** — add invoicing to your existing application without building it yourself
- **White-label the frontend** — build your own customer portal, POS terminal, or mobile app on top of the API
- **Automate workflows** — generate, send, and collect invoices programmatically
- **ERP integration** — sync invoices, payments, and clients with your existing systems
- **Subscription management** — create and manage recurring billing entirely through the API
- **Webhook events** — get notified of payment and status changes in real time

### Why type-safe matters

SlimFact uses tRPC — not REST. Your IDE autocompletes every endpoint, validates request and response types at compile time, and catches integration errors before they reach production. No staring at API docs, no manual request builders, no debugging "why did this field not come through" at 2 AM.

### Headless authentication

Connect any OpenID Connect provider for authentication. Your identity provider handles auth — SlimFact just validates the tokens. This works headless too: machine-to-machine flows, service accounts, and API-only deployments.

---

## No Feature Gating

Cloud: **€15/month, all features.** Self-host: **€0, all features.**

Same code, every deployment. No tiers, no upsells, no surprise limits.

---

## Professional-Grade Invoices with Typst

SlimFact uses [Typst](https://typst.app) — a modern open-source typesetting engine — to render invoices. The same technology used for academic papers and professional publishing.

- **SVG preview** — renders instantly in the browser, no layout shifts
- **Embedded fonts** — the PDF looks the same on every device and printer
- **EPC QR codes** — scannable payment codes embedded in every invoice
- **Multi-language templates** — English, Dutch, and German with proper locale formatting
- **Custom templates** — bring your own Typst template for unique branding

---

## Multi-Company by Default

Run unlimited companies from one account. Each gets its own:

- Branding and logo
- Banking details and payment profiles
- Invoice numbering templates
- Email sender settings
- Mollie API key (per company, for multi-PSP setups)
- Stripe API key (per company, for multi-PSP setups)

---

## Your PSP, Your Money

- Connect **your own** Mollie or Stripe account — SlimFact never handles your funds
- **No per-transaction fee** from SlimFact — you pay only what your PSP charges
- **Route payments per method** — iDEAL through Mollie, credit cards through Stripe, or vice versa
- **Down payments** — require partial payment upfront

---

## Comparison at a Glance

| | SlimFact | Invoice Ninja | FreshBooks | Xero |
|---|---|---|---|---|
| **Cloud price** | €15/mo | $12–$50/mo | $19–$50/mo | €24–€54/mo |
| **Open-source** | ✅ ELv2 | ⚠️ Separate build | ❌ | ❌ |
| **Free self-host** | ✅ Full features | ✅ Self-host option | ❌ | ❌ |
| **Full source access** | ✅ | ❌ | ❌ | ❌ |
| **Custom PDF templates** | ✅ Full Typst | Limited presets | Limited presets | Limited presets |
| **Customizable API behavior** | ✅ Modify server code | ❌ | ❌ | ❌ |
| **Headless API** | ✅ tRPC, type-safe | ✅ REST | ✅ REST | ✅ REST |
| **API rate limits** | None (self-host) | Yes | Yes | Yes |
| **OIDC auth** | ✅ | ❌ | ❌ | ❌ |
| **PDF engine** | Typst | HTML-to-PDF | HTML-to-PDF | HTML-to-PDF |
| **Multi-company** | ✅ Unlimited | Limited | ❌ | Limited |
| **UBL XML attachments** | ✅ Via email | ❌ | ❌ | ❌ |
| **UBL / Peppol exports** | ✅ | ❌ | ❌ | ❌ |
| **Feature gating** | None | 4 tiers | 3 tiers | 3 tiers |
| **Subscription billing** | ✅ Cron-based | ✅ | ✅ | ✅ |
| **Client portal** | ✅ | ✅ | ✅ | ✅ |
| **Multi-language UI** | EN / NL / DE (+ more on request) | 20+ languages | 7 languages | 10+ languages |

For a detailed feature list, see the [Pricing page](/pricing).

---

## The Bottom Line

**You have specific invoicing needs that off-the-shelf tools can't meet** — SlimFact adapts to you. Open-source code, fully customizable templates, and a type-safe API for deep integration.

**You build software and need an invoicing engine** — embed SlimFact headlessly. API-first, open-source, no rate limits.

**You want simplicity** — €15/month, managed hosting, all features, no tiers.

**You want full control** — self-host for free, own the code, own your data.

[View the Demo](https://demo.slimfact.app) — or [Contact us](/contact) to discuss your needs.
