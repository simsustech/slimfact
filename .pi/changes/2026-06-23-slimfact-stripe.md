# Changes: Stripe payment handler + payment method routing (2026-06-23)

## New files
| File | Description |
|------|-------------|
| `packages/api/tests/e2e/payments.spec.ts` | E2E tests for payment methods (cash, bank transfer, UI checks for ideal/creditcard) |

## Modified files
| File | Lines | Description |
|------|-------|-------------|
| `packages/api/src/config/env.ts` | +2 | Added `stripeApiKey`, `idealPaymentHandler`, `creditcardPaymentHandler` env vars |
| `packages/api/src/setup.ts` | ~30 | Added Stripe handler creation with multi-profile support (like Mollie). Added `profileProxy` helper and `paymentMethodRouting` config. Frontend PAYMENT_HANDLERS derived from routing + handler instances. |
| `packages/api/vitrify.config.ts` | +1 | Added `stripe` to serverModules externals |
| `packages/api/.env.example` | +2 | Added `STRIPE_API_KEY`, `IDEAL_PAYMENT_HANDLER`, `` |
| `packages/api/.env.development` | +3 | Added `VITE_STRIPE_API_KEY`, `VITE_IDEAL_PAYMENT_HANDLER`, `VITE_CREDITCARD_PAYMENT_HANDLER` |
| `packages/app/src/configuration.ts` | ~4 | Added `creditcard` to PAYMENT_HANDLERS type and defaults |
| `packages/app/src/lang/index.ts` | +1 | Added `creditcard` to payment.methods type |
| `packages/app/src/lang/en-US.ts` | +1 | Added `creditcard: 'Credit card'` |
| `packages/app/src/lang/nl.ts` | +1 | Added `creditcard: 'Creditcard'` |
| `packages/app/src/lang/de.ts` | +1 | Added `creditcard: 'Kreditkarte'` |
| `packages/app/src/components/invoice/InvoiceExpansionItem.vue` | ~15 | Added `onAddPaymentCreditcard` prop/emit, menu item, updated sub-menu visibility |
| `packages/app/src/pages/admin/InvoicesPage/InvoicesPage.vue` | ~50 | Wired `addPaymentIdeal` and `addPaymentCreditcard` handlers with checkout URL clipboard copy |
| `packages/app/src/pages/admin/BillsPage/BillsPage.vue` | ~50 | Same as InvoicesPage |

## External changes (Projects/modular-api)
| File | Description |
|------|-------------|
| `packages/fastify-checkout/src/paymentHandlers/stripe.ts` | Rewritten to use `stripe` npm SDK instead of raw REST calls. Uses `PaymentStatus`/`RefundStatus` enums. |
| `packages/fastify-checkout/src/index.ts` | Stripe now supports multi-profile dispatch like Mollie. Added `paymentMethodRouting` to `createInvoiceHandler` options type. |
| `packages/fastify-checkout/src/invoiceHandler.ts` | Added `stripePaymentHandler` dispatch function. Added `creditcard` payment method dispatch. Refunds now handle Stripe payments. Payment dispatch uses `paymentMethodRouting` config. |
| `packages/fastify-checkout/package.json` | Added `stripe ^22.2.2` dependency |

## Notes
- `IDEAL_PAYMENT_HANDLER` and `CREDITCARD_PAYMENT_HANDLER` env vars are read directly — no defaults. If unset, `paymentMethodRouting.ideal`/`creditcard` is `undefined` and the payment button won't show.
- `PAYMENT_HANDLERS` frontend config is derived from the initialized handler instances via `paymentMethodRouting`, not from env var string checks.
- Stripe checkout sessions created with `payment_method_types: ['card']`. Payment method `creditcard` maps to Stripe.
