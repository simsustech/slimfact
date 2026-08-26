import { db } from '../index.js'
import type { Insertable } from 'kysely'
import type { Companies, Clients, NumberPrefixes } from '../types.js'
import {
  createBankTransferPaymentHandler,
  createInvoiceHandler,
  InvoiceStatus,
  PaymentMethod,
  PaymentStatus,
  RefundStatus
} from '@modular-api/fastify-checkout'
import { fastify as createFastify } from 'fastify'
import { pathToFileURL } from 'url'
import { demoCore } from './demoData.js'

// Fixture-driven dev seed. Replaces the old faker-based generator: it replays
// the committed `demoCore` fixture (see packages/banking-api/scripts/
// generate-demo-data.ts) through the real app flow — createInvoice →
// openInvoice → addPaymentToInvoice → setInvoiceStatus — so immutability,
// numbering and the company/client snapshots come from the real code path.
//
// Numbered invoices (OPEN/PAID/CANCELED, prefix 2026-) go through openInvoice
// and get the fixture's numbers. Unnumbered BILL/RECEIPT documents stay
// unnumbered. PSP-linked payments (ideal/creditcard with a settlementId) are
// raw-inserted into checkout.payments (addPaymentToInvoice has no
// externalId/settlementId seam); bank-transfer payments for receipts go
// through addPaymentToInvoice.

const fastify = createFastify()
const invoiceHandler = createInvoiceHandler({
  fastify,
  kysely: db,
  paymentHandlers: {
    bankTransfer: createBankTransferPaymentHandler({ fastify, kysely: db })
  }
})

export const seedFake = async (): Promise<void> => {
  const { companies, clients, numberPrefixes, invoices, payments, refunds } =
    demoCore

  // Re-seed guard: early-exit if the numbered demo invoices already exist, so
  // re-running never shifts the numbers (mirrors seed:test.ts's demoInvoice
  // early-exit).
  const existing = await db
    .selectFrom('checkout.invoices')
    .select('id')
    .where('numberPrefix', '=', '2026-')
    .limit(1)
    .executeTakeFirst()
  if (existing) {
    console.log('[seed:fake] demo data already present, skipping')
    return
  }

  await db
    .insertInto('numberPrefixes')
    .values(numberPrefixes as unknown as Insertable<NumberPrefixes>[])
    .execute()
  await db
    .insertInto('companies')
    .values(companies as unknown as Insertable<Companies>[])
    .execute()
  await db
    .insertInto('clients')
    .values(clients as unknown as Insertable<Clients>[])
    .execute()

  const insertedCompanies = await db
    .selectFrom('companies')
    .selectAll()
    .execute()
  const insertedClients = await db.selectFrom('clients').selectAll().execute()

  await db
    .insertInto('initialNumberForPrefixes')
    .values({
      companyId: insertedCompanies[0].id,
      numberPrefix: '2026-',
      initialNumber: 1
    })
    .onConflict((oc) => oc.doNothing())
    .execute()

  const { initialNumber } =
    (await db
      .selectFrom('initialNumberForPrefixes')
      .where('numberPrefix', '=', '2026-')
      .select('initialNumber')
      .executeTakeFirst()) || {}

  // Create invoices in fixture order (numbered first, then unnumbered).
  const createdIds = new Map<number, number>()
  for (let i = 0; i < invoices.length; i++) {
    const inv = invoices[i]
    const company = insertedCompanies[inv.companyIndex]
    const client = insertedClients[inv.clientIndex]
    const isNumbered = inv.number !== null
    const created = await invoiceHandler.createInvoice({
      companyDetails: company,
      clientDetails: client,
      companyPrefix: company.prefix,
      numberPrefixTemplate: '2026-',
      currency: 'EUR',
      lines: [
        {
          description: inv.lineDescription,
          listPrice: inv.amountCents,
          listPriceIncludesTax: true,
          taxRate: 0,
          quantity: 1,
          quantityPerMille: false,
          discount: 0
        }
      ],
      discounts: [],
      surcharges: [],
      paymentTermDays: inv.paymentTermDays,
      locale: inv.locale,
      status: isNumbered ? InvoiceStatus.CONCEPT : InvoiceStatus.BILL,
      companyId: company.id,
      clientId: client.id
    })
    if (!created.success) throw new Error(created.errorMessage)
    createdIds.set(i, created.invoice.id)

    if (isNumbered) {
      const opened = await invoiceHandler.openInvoice({
        id: created.invoice.id,
        numberPrefix: '2026-',
        initialNumber
      })
      if (!opened.success) throw new Error(opened.errorMessage)
      if (inv.status === 'canceled') {
        // cancelInvoice (not setInvoiceStatus) — an opened invoice can only be
        // canceled via the direct cancel path.
        const canceled = await invoiceHandler.cancelInvoice({
          id: created.invoice.id
        })
        if (!canceled.success) throw new Error(canceled.errorMessage)
      }
    }
  }

  // Apply payments. PSP-linked payments are raw-inserted (they carry
  // externalId/settlementId); bank-transfer payments go through the app flow.
  for (const payment of payments) {
    const invoiceId = createdIds.get(payment.invoiceIndex)!
    const inv = invoices[payment.invoiceIndex]
    if (payment.externalId !== null && payment.settlementId !== null) {
      await db
        .insertInto('checkout.payments')
        .values({
          invoiceId,
          externalId: payment.externalId,
          settlementId: payment.settlementId,
          method: payment.method as PaymentMethod,
          paymentServiceProvider: 'mollie',
          amount: payment.amountCents,
          currency: 'EUR',
          status: PaymentStatus.PAID,
          description: payment.description
        })
        .execute()
    } else {
      const paid = await invoiceHandler.addPaymentToInvoice({
        id: invoiceId,
        payment: {
          amount: payment.amountCents,
          currency: 'EUR',
          description: payment.description,
          method: payment.method as PaymentMethod
        }
      })
      if (!paid.success) throw new Error(paid.errorMessage)
      // A fully paid bill converts to a receipt via setInvoiceStatus (app flow).
      if (inv.status === 'receipt') {
        const receipt = await invoiceHandler.setInvoiceStatus({
          id: invoiceId,
          status: InvoiceStatus.RECEIPT
        })
        if (!receipt.success) throw new Error(receipt.errorMessage)
      }
    }
  }

  // Mark PAID numbered invoices as PAID (their PSP payments are raw-inserted,
  // which does not flip the status).
  for (let i = 0; i < invoices.length; i++) {
    if (invoices[i].status === 'paid') {
      await db
        .updateTable('checkout.invoices')
        .set({ status: InvoiceStatus.PAID })
        .where('id', '=', createdIds.get(i)!)
        .execute()
    }
  }

  // Insert refunds, resolving each refund's payment_id by the PSP externalId.
  for (const refund of refunds) {
    const paymentRow = await db
      .selectFrom('checkout.payments')
      .select('id')
      .where('externalId', '=', refund.paymentExternalId)
      .executeTakeFirst()
    if (!paymentRow) {
      throw new Error(
        `[seed:fake] refund payment not found: ${refund.paymentExternalId}`
      )
    }
    await db
      .insertInto('checkout.refunds')
      .values({
        externalId: refund.externalId,
        paymentId: paymentRow.id,
        description: refund.description,
        paymentServiceProvider: 'mollie',
        amount: refund.amountCents,
        currency: 'EUR',
        status: RefundStatus.REFUNDED
      })
      .execute()
  }

  console.log(
    `[seed:fake] seeded ${invoices.length} invoices, ${payments.length} payments, ${refunds.length} refunds`
  )
}

// CLI entry: run when executed directly (node dist/kysely/seeds/fake.js).
const isMain =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isMain) {
  seedFake().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
