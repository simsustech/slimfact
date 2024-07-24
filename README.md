# SlimFact

> Streamlined invoicing made easy

SlimFact is a powerful invoicing solution designed to simplify your billing process. Whether you’re a small business owner, freelancer, or enterprise, SlimFact offers seamless invoice management with the following features:

  1. Immutable invoices:
      - Once an invoice is created, it remains unchanged. No accidental modifications or discrepancies.
      - Fully rendered in the browser, eliminating the need for additional PDF generation packages.

  2. Flexible billing:
      - For orders that may undergo changes, SlimFact allows you to create bills.
      - Bills can be seamlessly converted to receipts once paid, maintaining a clear transaction history.
      - If the client requests an invoice, receipts can be converted to an invoice with a single click.

  3. Efficient UUID Access:
      - Each invoice is uniquely identified by a UUID (Universally Unique Identifier).
      - Clients can access their invoices anytime using their unique identifier.

SlimFact streamlines your invoicing process, ensuring accuracy, security, and convenience. Say goodbye to manual paperwork and embrace hassle-free billing with SlimFact! 🚀💡

## Features
- OpenID Connect (OIDC) authentication
- API can be used headless if desired.
- Ability to use decimals in invoice line quantity.
- Define the tax rate per invoice line and define wether or not the price includes or excludes tax, and automatically calculate the correct amount.
- Send invoices in different languages by defining the locale on invoice level.
- Clients can easily pay their invoices with the help of a payment service provider (Mollie).

## Documentation
[Invoice status flowchart](./packages/docs/Flowchart.md)

## License
Copyright © simsustech 2024-present

[ELv2 License](./LICENSE)
