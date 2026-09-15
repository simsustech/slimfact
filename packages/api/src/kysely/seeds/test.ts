import { hashPassword } from '@vitrify/tools/scrypt'
import { db } from '../index.js'
import type { Insertable } from 'kysely'
import type { Clients, Companies, NumberPrefixes } from '../types.js'
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

const ADMIN_PASSWORD = 'Sif5uEG5hcTH'

// Double backslash to escape compress-tag
// const emailTemplates: Insertable<EmailTemplates>[] = [
//   {
//     name: 'sendInvoice',
//     locale: 'nl',
//     subject: `Factuur \\{{numberPrefix}}\\{{number}}`,
//     body: c`<p>Beste {{#if clientDetails.contactPersonName}}{{clientDetails.contactPersonName}}{{else}}{{clientDetails.companyName}}{{/if}},</p>

//   <p>Bijgevoegd treft u factuur \\{{numberPrefix}}\\{{number}} aan voor de geleverde diensten.</p>

//   <p>Gelieve het verschuldigde bedrag ter hoogte van {{totalIncludingTax}} te betalen binnen {{paymentTermDays}} dagen (voor \\{{dueDate}}) op rekeningnummer {{companyDetails.iban}} t.n.v. {{companyDetails.name}} onder vermelding van factuurnummer.</p>

//   <p>U kunt de factuur ook <a href="\\{{invoiceUrl}}">hier</a> bekijken.

//   <p>Mocht u nog vragen hebben over deze factuur, dan kunt u contact met ons opnemen.</p>

//   <p>Met vriendelijke groet,</p>

//   <p>{{companyDetails.name}}</p>`
//   },
//   {
//     name: 'remindInvoice',
//     locale: 'nl',
//     subject: `Betalingsherinnering factuur \\{{numberPrefix}}\\{{number}}`,
//     body: c`<p>Beste {{#if clientDetails.contactPersonName}}{{clientDetails.contactPersonName}}{{else}}{{clientDetails.companyName}}{{/if}},</p>

//   <p>Uit onze administratie blijkt dat factuur \\{{numberPrefix}}\\{{number}} nog niet is voldaan.</p>

//   <p>Wij willen u verzoeken het verschuldigde bedrag ter hoogte van {{totalIncludingTax}} alsnog binnen 7 dagen te betalen op rekeningnummer {{companyDetails.iban}} t.n.v. {{companyDetails.name}} onder vermelding van factuurnummer.</p>

//   <p>U kunt de factuur ook <a href="\\{{invoiceUrl}}">hier</a> bekijken.

//   <p>Mocht u nog vragen hebben over deze factuur, dan kunt u contact met ons opnemen.</p>

//   <p>Met vriendelijke groet,</p>

//   <p>{{companyDetails.name}}</p>`
//   },
//   {
//     name: 'exhortInvoice',
//     locale: 'nl',
//     subject: `Aanmaning factuur \\{{numberPrefix}}\\{{number}}`,
//     body: c`<p>Beste {{#if clientDetails.contactPersonName}}{{clientDetails.contactPersonName}}{{else}}{{clientDetails.companyName}}{{/if}},</p>

//   <p>Uit onze administratie blijkt dat factuur \\{{numberPrefix}}\\{{number}} nog niet is voldaan.</p>

//   <p>Wij willen u verzoeken het verschuldigde bedrag ter hoogte van {{totalIncludingTax}} alsnog binnen 5 dagen te betalen op rekeningnummer {{companyDetails.iban}} t.n.v. {{companyDetails.name}} onder vermelding van factuurnummer.</p>

//   <p>U kunt de factuur ook <a href="\\{{invoiceUrl}}">hier</a> bekijken.

//   <p>Indien de betaling uitblijft zijn we genoodzaakt verdere juridische stappen te nemen.</p>

//   <p>Met vriendelijke groet,</p>

//   <p>{{companyDetails.name}}</p>`
//   },
//   {
//     name: 'sendInvoice',
//     locale: 'en-US',
//     subject: `Invoice \\{{numberPrefix}}\\{{number}}`,
//     body: c`</p>Dear {{#if clientDetails.contactPersonName}}{{clientDetails.contactPersonName}}{{else}}{{clientDetails.companyName}}{{/if}},</p>

//   <p>In the attachment you can find invoice \\{{numberPrefix}}\\{{number}} for our services.</p>

//   <p>We would like to ask you to pay the amount of {{totalIncludingTax}} within {{paymentTermDays}} days (before \\{{dueDate}}) on account number {{companyDetails.iban}} in the name of {{companyDetails.name}} with mention of the invoice number.</p>

//   <p>You can also view the invoice <a href="\\{{invoiceUrl}}">here</a>.

//   <p>If you have any questions about this invoice, you can contact us.</p>

//   <p>Kind regards,</p>

//   <p>{{companyDetails.name}}</p>`
//   },
//   {
//     name: 'remindInvoice',
//     locale: 'en-US',
//     subject: `Payment reminder invoice \\{{numberPrefix}}\\{{number}}`,
//     body: c`</p>Dear {{#if clientDetails.contactPersonName}}{{clientDetails.contactPersonName}}{{else}}{{clientDetails.companyName}}{{/if}},</p>

//   <p>According to our administration the payment for invoice \\{{numberPrefix}}\\{{number}} is overdue.</p>

//   <p>We would like to ask you to pay the open amount of {{totalIncludingTax}} within 7 days on account number {{companyDetails.iban}} in the name of {{companyDetails.name}} with mention of the invoice number.</p>

//   <p>You can also view the invoice <a href="\\{{invoiceUrl}}">here</a>.

//   <p>If you have any questions about this invoice, you can contact us.</p>

//   <p>Kind regards,</p>

//   <p>{{companyDetails.name}}</p>`
//   },
//   {
//     name: 'exhortInvoice',
//     locale: 'en-US',
//     subject: `Exhortation invoice \\{{numberPrefix}}\\{{number}}`,
//     body: c`</p>Dear {{#if clientDetails.contactPersonName}}{{clientDetails.contactPersonName}}{{else}}{{clientDetails.companyName}}{{/if}},</p>

//   <p>According to our administration the payment for invoice \\{{numberPrefix}}\\{{number}} is overdue.</p>

//   <p>We would like to ask you to pay the open amount of {{totalIncludingTax}} within 5 days on account number {{companyDetails.iban}} in the name of {{companyDetails.name}} with mention of the invoice number.</p>

//   <p>You can also view the invoice <a href="\\{{invoiceUrl}}">here</a>.

//   <p>If the payment is not received we will be required to take further legal steps.</p>

//   <p>Kind regards,</p>

//   <p>{{companyDetails.name}}</p>`
//   }
// ]

const numberPrefixes: Insertable<NumberPrefixes>[] = [
  {
    name: 'YYYY.',
    template: '{{YYYY}}.'
  }
]

const companies: Insertable<Companies>[] = [
  {
    name: 'Acme Inc',
    address: 'Hoofdweg 1',
    postalCode: '1234 AB',
    city: 'Amsterdam',
    country: 'NL',
    email: 'john@acme.local',
    cocNumber: '123456789',
    // A checksum-valid Knab IBAN (NL68KNAB0123456789): the customer invoice
    // page's EPC QR (and thus the bankTransfer payment option) requires a
    // valid IBAN. With no explicit link, the fallback resolves knab-acc to
    // Acme (seed:test runs before the demo links are inserted).
    iban: 'NL68KNAB0123456789',
    bic: 'KNABNL2H',
    prefix: 'acme',
    vatIdNumber: 'NL12345678',
    emailBcc: 'bcc@acme.local'
  },
  {
    name: 'Acme Retail BV',
    address: 'Hoofdweg 3',
    postalCode: '1234 AB',
    city: 'Amsterdam',
    country: 'NL',
    email: 'info@acmeretail.local',
    cocNumber: '987654321',
    // Matches the Rabobank account's IBAN but is NOT explicitly linked —
    // link-first resolution must still map rabobank-acc to Acme, proving an
    // explicit link beats the IBAN fallback (E2E link-over-iban assertions).
    iban: 'NL78RABO9876543210',
    bic: 'RABONL2U',
    prefix: 'rabo',
    vatIdNumber: 'NL87654321',
    emailBcc: null
  }
]

const clients: Insertable<Clients>[] = [
  {
    companyName: 'Goods For All',
    address: 'Hoofdweg 2',
    postalCode: '1234 AB',
    city: 'Amsterdam',
    country: 'NL',
    email: 'jane@goodsforall.local',
    contactPersonName: 'Jane Doe'
  }
]

const seed = async () => {
  // await db.insertInto('emailTemplates').values(emailTemplates).execute()
  await db.insertInto('numberPrefixes').values(numberPrefixes).execute()

  await db.insertInto('companies').values(companies).execute()
  await db.insertInto('clients').values(clients).execute()

  const adminAccounts = await db
    .insertInto('accounts')
    .values([
      {
        email: 'admin@slimfact.app',
        roles: `["administrator", "pointofsale"]`
      }
    ])
    .returning('id')
    .execute()

  const admin = adminAccounts[0]

  await db
    .insertInto('authenticationMethods')
    .values([
      {
        accountId: admin.id,
        provider: 'native',
        password: await hashPassword(ADMIN_PASSWORD)
      }
    ])
    .execute()

  // ---- Bank demo: review-queue + auto-apply showcase (idempotent) ----
  // E2E number prefix so the demo invoices get stable numbers.
  const e2ePrefix = await db
    .selectFrom('numberPrefixes')
    .select('id')
    .where('name', '=', 'E2E')
    .limit(1)
    .executeTakeFirst()
  if (!e2ePrefix) {
    await db
      .insertInto('numberPrefixes')
      .values({ name: 'E2E', template: '2026-' })
      .execute()
  }

  const acme = await db
    .selectFrom('companies')
    .selectAll()
    .where('name', '=', 'Acme Inc')
    .executeTakeFirstOrThrow()
  const demoClient = await db
    .selectFrom('clients')
    .selectAll()
    .limit(1)
    .executeTakeFirstOrThrow()

  await db
    .insertInto('initialNumberForPrefixes')
    .values({
      companyId: acme.id,
      numberPrefix: '2026-',
      initialNumber: 1
    })
    .onConflict((conflict) => conflict.doNothing())
    .execute()

  // Links: one company (Acme) owns both accounts (many-to-many demo).
  // Direct insert on purpose — importing the banking module (accountLinks →
  // sync → match) would drag date-fns (devDependency, build-time only) into
  // the deployed node_modules and bloat the image.
  await db
    .insertInto('bankAccountCompanies')
    .values([
      { accountExternalId: 'knab-acc', companyId: acme.id },
      { accountExternalId: 'rabobank-acc', companyId: acme.id }
    ])
    .onConflict((conflict) => conflict.doNothing())
    .execute()

  // Demo invoices A–E (2026-1..5) + B's manual payment + E's bank link.
  // Scoped to Acme: leftover invoices from other companies (e.g. unit-test
  // fixtures that TRUNCATE the shared DB) must never block the demo world.
  const demoInvoice = await db
    .selectFrom('checkout.invoices')
    .select('id')
    .where('companyId', '=', acme.id)
    .where('numberPrefix', '=', '2026-')
    .limit(1)
    .executeTakeFirst()
  if (!demoInvoice) {
    const fastify = createFastify()
    const invoiceHandler = createInvoiceHandler({
      fastify,
      kysely: db,
      paymentHandlers: {
        bankTransfer: createBankTransferPaymentHandler({
          fastify,
          kysely: db
        })
      }
    })

    const createDemoInvoice = async (amountCents: number) => {
      const result = await invoiceHandler.createInvoice({
        companyDetails: acme,
        clientDetails: demoClient,
        companyPrefix: acme.prefix,
        numberPrefixTemplate: '2026-',
        currency: 'EUR',
        lines: [
          {
            description: 'Demo factuur',
            listPrice: amountCents,
            listPriceIncludesTax: true,
            taxRate: 0,
            quantity: 1,
            quantityPerMille: false,
            discount: 0
          }
        ],
        discounts: [],
        surcharges: [],
        paymentTermDays: 12,
        locale: 'en-US',
        status: InvoiceStatus.BILL,
        companyId: acme.id,
        clientId: demoClient.id
      })
      if (!result.success) throw new Error(result.errorMessage)
      return result.invoice
    }

    // Follow the app flow: createInvoice → openInvoice → addPaymentToInvoice.
    // Numbering is NOT hardcoded — the starting number comes from
    // initialNumberForPrefixes and openInvoice advances via getLastInvoiceNumber
    // (same seam as trpc/admin/invoices.ts), so the demo world gets
    // 2026-1..5 automatically on a fresh stack.
    const invoiceA = await createDemoInvoice(5000)
    const invoiceB = await createDemoInvoice(3000)
    const invoiceC = await createDemoInvoice(2500)
    const invoiceD = await createDemoInvoice(4000)
    const invoiceE = await createDemoInvoice(4200)
    const invoiceF = await createDemoInvoice(4000)
    const { initialNumber } =
      (await db
        .selectFrom('initialNumberForPrefixes')
        .where('numberPrefix', '=', '2026-')
        .select('initialNumber')
        .executeTakeFirst()) || {}
    for (const invoice of [
      invoiceA,
      invoiceB,
      invoiceC,
      invoiceD,
      invoiceE,
      invoiceF
    ]) {
      const opened = await invoiceHandler.openInvoice({
        id: invoice.id,
        numberPrefix: '2026-',
        initialNumber
      })
      if (!opened.success) throw new Error(opened.errorMessage)
    }
    const paid = await invoiceHandler.addPaymentToInvoice({
      id: invoiceB.id,
      payment: {
        amount: 3000,
        currency: 'EUR',
        description: 'Bank transfer (manual)',
        method: PaymentMethod.banktransfer
      }
    })
    if (!paid.success) throw new Error(paid.errorMessage)
    // Invoice E is linked to the seeded credit seed-credit-001 (€42.00 on the
    // Knab account): the overview's Linked chip + the linked/unlinked filter
    // get a deterministic seeded baseline, and the review queue excludes it.
    const linkedE = await invoiceHandler.addPaymentToInvoice({
      id: invoiceE.id,
      payment: {
        amount: 4200,
        currency: 'EUR',
        description: 'Bank credit 2026-5',
        method: PaymentMethod.banktransfer,
        transactionReference: 'bank:seed-credit-001'
      }
    })
    if (!linkedE.success) throw new Error(linkedE.errorMessage)
    // PSP lump-sum payout fixture: a Mollie-paid row on E whose settlementId
    // matches the proxy's seeded setl-seed-001 (see banking-api seed). The
    // overview proposes a PSP reconcile for the MOLLIE PAYOUT credit.
    await db
      .insertInto('checkout.payments')
      .values({
        invoiceId: invoiceE.id,
        description: 'Mollie payout 2026-5',
        externalId: 'pay-seed-1',
        settlementId: 'setl-seed-001',
        method: PaymentMethod.ideal,
        paymentServiceProvider: 'mollie',
        amount: 4200,
        currency: 'EUR',
        status: PaymentStatus.PAID,
        // Paid PSP rows must carry paidAt — the dashboard activity feed
        // filters payments on it.
        paidAt: new Date().toISOString()
      })
      .onConflict((conflict) => conflict.doNothing())
      .execute()
    // Payments-ledger fixtures: a Mollie refund on E's payout plus a failed
    // iDEAL attempt and a pending creditcard attempt on OPEN invoice F —
    // the unified payments overview gets every row kind and attempt status
    // deterministically, without touching any invoice state.
    const seededPspPayment = await db
      .selectFrom('checkout.payments')
      .select('id')
      .where('externalId', '=', 'pay-seed-1')
      .executeTakeFirst()
    if (seededPspPayment) {
      await db
        .insertInto('checkout.refunds')
        .values({
          paymentId: seededPspPayment.id,
          externalId: 're-seed-001',
          description: 'Refund 2026-5',
          paymentServiceProvider: 'mollie',
          amount: 1000,
          currency: 'EUR',
          status: RefundStatus.REFUNDED
        })
        .onConflict((conflict) => conflict.doNothing())
        .execute()
    }
    await db
      .insertInto('checkout.payments')
      .values({
        invoiceId: invoiceF.id,
        externalId: 'pay-seed-failed-1',
        method: PaymentMethod.ideal,
        paymentServiceProvider: 'mollie',
        amount: 4000,
        currency: 'EUR',
        status: PaymentStatus.FAILED,
        description: 'Failed iDEAL attempt 2026-6'
      })
      .onConflict((conflict) => conflict.doNothing())
      .execute()
    const yesterday = new Date(Date.now() - 86400000)
    const pad = (value: number) => String(value).padStart(2, '0')
    const pendingCreatedAt =
      `${yesterday.getUTCFullYear()}-${pad(yesterday.getUTCMonth() + 1)}-` +
      `${pad(yesterday.getUTCDate())} 12:00:00+00`
    await db
      .insertInto('checkout.payments')
      .values({
        invoiceId: invoiceF.id,
        externalId: 'pay-seed-pending-1',
        method: PaymentMethod.creditcard,
        paymentServiceProvider: 'stripe',
        amount: 4000,
        currency: 'EUR',
        status: PaymentStatus.PENDING,
        createdAt: pendingCreatedAt,
        description: 'Pending creditcard attempt 2026-6'
      })
      .onConflict((conflict) => conflict.doNothing())
      .execute()
    // Invoices G–L: exercised by the banking E2E (settlement drill-down,
    // picker preselect, uuid-seam demo).
    const invoiceG = await createDemoInvoice(2499)
    const invoiceH = await createDemoInvoice(12900)
    const invoiceI = await createDemoInvoice(5900)
    const invoiceJ = await createDemoInvoice(34581)
    const invoiceK = await createDemoInvoice(1290)
    const invoiceL = await createDemoInvoice(19900)
    for (const invoice of [
      invoiceG,
      invoiceH,
      invoiceI,
      invoiceJ,
      invoiceK,
      invoiceL
    ]) {
      const opened = await invoiceHandler.openInvoice({
        id: invoice.id,
        numberPrefix: '2026-',
        initialNumber
      })
      if (!opened.success) throw new Error(opened.errorMessage)
    }
    // J: Mollie ideal, settlement setl-seed-201, bank:seed-credit-008.
    await db
      .insertInto('checkout.payments')
      .values({
        invoiceId: invoiceJ.id,
        externalId: 'tr-201-1',
        settlementId: 'setl-seed-201',
        method: PaymentMethod.ideal,
        paymentServiceProvider: 'mollie',
        amount: 34581,
        currency: 'EUR',
        status: PaymentStatus.PAID,
        transactionReference: 'bank:seed-credit-008',
        description: 'Mollie payout 2026-10'
      })
      .onConflict((conflict) => conflict.doNothing())
      .execute()
    // K: Mollie creditcard, same settlement, same bank ref (uuid-seam demo —
    // two payments on different invoices share bank:seed-credit-008).
    await db
      .insertInto('checkout.payments')
      .values({
        invoiceId: invoiceK.id,
        externalId: 'pay-201-2',
        settlementId: 'setl-seed-201',
        method: PaymentMethod.creditcard,
        paymentServiceProvider: 'mollie',
        amount: 1290,
        currency: 'EUR',
        status: PaymentStatus.PAID,
        transactionReference: 'bank:seed-credit-008',
        description: 'Mollie payout 2026-11'
      })
      .onConflict((conflict) => conflict.doNothing())
      .execute()
    // L: Mollie ideal, settlement setl-seed-202, no bank ref.
    await db
      .insertInto('checkout.payments')
      .values({
        invoiceId: invoiceL.id,
        externalId: 'tr-202-1',
        settlementId: 'setl-seed-202',
        method: PaymentMethod.ideal,
        paymentServiceProvider: 'mollie',
        amount: 19900,
        currency: 'EUR',
        status: PaymentStatus.PAID,
        description: 'Mollie payout 2026-12'
      })
      .onConflict((conflict) => conflict.doNothing())
      .execute()
    // Mark J/K/L as paid.
    for (const id of [invoiceJ.id, invoiceK.id, invoiceL.id]) {
      await db
        .updateTable('checkout.invoices')
        .set({ status: InvoiceStatus.PAID })
        .where('id', '=', id)
        .execute()
    }

    // Invoices M/N (2026-13/14): the multi-candidate adoption fixture.
    // Both are €130, paid by manual banktransfer (no bank: ref); the credit
    // seed-credit-011 names N explicitly (note "FACTUUR 2026-14") while M is
    // reached only via the payer surname (Jane Doe). The link dialog for that
    // credit must show both rows, N (98%) sorted above M (75%).
    const invoiceM = await createDemoInvoice(13000)
    const invoiceN = await createDemoInvoice(13000)
    for (const invoice of [invoiceM, invoiceN]) {
      const opened = await invoiceHandler.openInvoice({
        id: invoice.id,
        numberPrefix: '2026-',
        initialNumber
      })
      if (!opened.success) throw new Error(opened.errorMessage)
      const paid = await invoiceHandler.addPaymentToInvoice({
        id: invoice.id,
        payment: {
          amount: 13000,
          currency: 'EUR',
          description: 'Bank transfer (manual)',
          method: PaymentMethod.banktransfer
        }
      })
      if (!paid.success) throw new Error(paid.errorMessage)
    }
    // Give N's manual payment the bookkeeper-style day-month ref (like the
    // production "29-6" pattern); M keeps a NULL ref. Both stay adoptable
    // because neither ref starts with "bank:".
    await db
      .updateTable('checkout.payments')
      .set({ transactionReference: '29-6' })
      .where('invoiceId', '=', invoiceN.id)
      .where('method', '=', PaymentMethod.banktransfer)
      .execute()

    // Pin deterministic UUIDs so the E2E test world is byte-deterministic.
    // createInvoice has no uuid param and the column defaults to
    // gen_random_uuid(), so we overwrite it post-create (Option A).
    const deterministicUuid = (number: number): string =>
      `00000000-0000-4000-8000-${String(number).padStart(12, '0')}`
    for (let num = 1; num <= 14; num++) {
      await db
        .updateTable('checkout.invoices')
        .set({ uuid: deterministicUuid(num) })
        .where('numberPrefix', '=', '2026-')
        .where('number', '=', num)
        .execute()
    }
    const paymentUuids: Record<string, string> = {
      'pay-seed-1': '00000000-0000-4000-8000-000000000101',
      'tr-201-1': '00000000-0000-4000-8000-000000000102',
      'pay-201-2': '00000000-0000-4000-8000-000000000103',
      'tr-202-1': '00000000-0000-4000-8000-000000000104',
      'pay-seed-failed-1': '00000000-0000-4000-8000-000000000105',
      'pay-seed-pending-1': '00000000-0000-4000-8000-000000000106'
    }
    for (const [externalId, uuid] of Object.entries(paymentUuids)) {
      await db
        .updateTable('checkout.payments')
        .set({ uuid })
        .where('externalId', '=', externalId)
        .execute()
    }
    // Pin the refund uuid too.
    await db
      .updateTable('checkout.refunds')
      .set({ uuid: '00000000-0000-4000-8000-000000000301' })
      .where('externalId', '=', 're-seed-001')
      .execute()
    // The two addPaymentToInvoice payments (B banktransfer, E bank-linked) have
    // no externalId — pin them by invoice number + method.
    const bankTransferUuids: Record<string, string> = {
      '2:banktransfer': '00000000-0000-4000-8000-000000000201',
      '5:banktransfer': '00000000-0000-4000-8000-000000000202',
      '13:banktransfer': '00000000-0000-4000-8000-000000000203',
      '14:banktransfer': '00000000-0000-4000-8000-000000000204'
    }
    for (const [key, uuid] of Object.entries(bankTransferUuids)) {
      const [number, method] = key.split(':')
      const invoice = await db
        .selectFrom('checkout.invoices')
        .select('id')
        .where('numberPrefix', '=', '2026-')
        .where('number', '=', Number(number))
        .executeTakeFirst()
      if (!invoice) continue
      await db
        .updateTable('checkout.payments')
        .set({ uuid })
        .where('invoiceId', '=', invoice.id)
        .where('method', '=', method as PaymentMethod)
        .execute()
    }
  }
}

// CLI entry: run when executed directly (node dist/kysely/seeds/test.js).
const isMain =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isMain) {
  seed().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}

export const seedTest = seed
