---
# https://vitepress.dev/reference/default-theme-home-page
layout: home

hero:
  name: "SlimFact"
  text: "Streamlined invoicing made easy."
  # tagline: My great project tagline
  image:
    src: /logo.svg
    alt: SlimFact
  actions:
    - theme: brand
      text: Demo
      link: https://demo.slimfact.app

features:
  - title: Create bills and receipts.
    details: Easily accept online payments and create receipts.
  - title: Database oriented storage.
    details: All invoices are stored in the database (instead of a file) which allows for advanced querying and on-the-fly PDF generation.
  - title: Client portal.
    details: Bills, receipts and invoices are linked to an account which can be viewed by your clients.
  - title: Easy third-party integration.
    details: SlimFact can be used headless and completely integrated into your applications.
  - title: Support for UBL invoices.
    details: Invoices in the Universal Business Language format allow for fully automated processing.
  - title: Receive payments with Wero.
    details: By using Mollie as your Payment Service Provider you can use Wero (formerly iDEAL) to receive payments for a fixed price per payment (in contrast to a percentage of the paid amount). Support for other Payment Service Provider (e.g. Stripe) is on the roadmap.
    link: https://wero-wallet.eu
  - title: OpenID Connect authentication.
    details: With support for federated Single Sign-on (SSO).
  - title: Templates created with Typst.
    details: Typst provides the tooling to create beautiful templates with perfect formatting.
    link: https://typst.app
