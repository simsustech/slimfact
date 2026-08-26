import {
  afterAll,
  beforeAll,
  describe,
  it,
  expect,
  beforeEach,
  vi
} from 'vitest'
import { Kysely, PostgresDialect, CamelCasePlugin, sql } from 'kysely'
import pg from 'pg'
import {
  InvoiceStatus,
  PaymentMethod,
  PaymentStatus
} from '@modular-api/fastify-checkout'
import type { DB } from '../../../src/kysely/types.js'
import type { InvoiceHandler } from '../../../src/banking/apply.js'
import type {
  MatchInvoice,
  MatchTransaction
} from '../../../src/banking/match.js'

const { Pool } = pg

// Mirror the API server's pg type parsers.
pg.types.setTypeParser(1700, (value: string) => parseFloat(value))
pg.types.setTypeParser(1114, (value: string) => value)
pg.types.setTypeParser(1082, (value: string) => value)

const databaseUrl = process.env.TEST_DATABASE_URL
let testDb: Kysely<DB> | null = null
if (databaseUrl) {
  try {
    testDb = new Kysely<DB>({
      dialect: new PostgresDialect({
        pool: new Pool({ connectionString: databaseUrl, max: 5 })
      }),
      plugins: [new CamelCasePlugin()]
    })
    // Probe connectivity; if the test DB is unavailable the suite skips so the
    // regular `pnpm test` gate stays green on machines without it.
    await testDb.selectFrom('companies').select('id').limit(1).execute()
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn(`apply.spec: test DB unavailable, skipping: ${String(error)}`)
    testDb = null
  }
}

afterAll(async () => {
  if (testDb) await testDb.destroy()
})

const makeHandler = (): InvoiceHandler['addPaymentToInvoice'] =>
  vi.fn<InvoiceHandler['addPaymentToInvoice']>(async () => ({
    success: true,
    payment: { id: 999 }
  })) as unknown as InvoiceHandler['addPaymentToInvoice']

const makeFailingHandler = (): InvoiceHandler['addPaymentToInvoice'] =>
  vi.fn<InvoiceHandler['addPaymentToInvoice']>(async () => {
    throw Object.assign(
      new Error('duplicate key value violates unique constraint'),
      {
        code: '23505'
      }
    )
  }) as unknown as InvoiceHandler['addPaymentToInvoice']

const describeDb = testDb ? describe : describe.skip

const credit = (
  overrides: Partial<MatchTransaction> = {}
): MatchTransaction => ({
  externalId: 'txn-1',
  accountExternalId: 'acc-1',
  companyId: 10,
  amountCents: 5000,
  currency: 'EUR',
  creditDebit: 'CRDT',
  status: 'BOOK',
  bookingDate: '2026-06-30',
  description: 'Factuur 2026-0001',
  remittanceInformation: null,
  referenceNumber: null,
  counterpartyName: null,
  counterpartyIban: null,
  ...overrides
})

type SeedRow = { companyId: number; invoiceId: number; invoiceUuid: string }

const seed = async (db: Kysely<DB>): Promise<SeedRow> => {
  const { id: companyId } = await db
    .insertInto('companies')
    .values({
      prefix: 'X',
      name: 'Test BV',
      address: 'Straat 1',
      postalCode: '1234AB',
      city: 'Den Haag',
      country: 'NL',
      email: 'admin@test.nl',
      cocNumber: '98765432',
      vatIdNumber: 'NL987654321B01',
      iban: 'NL00TEST0123456789',
      bic: 'TESTNL2A'
    })
    .returning('id')
    .executeTakeFirstOrThrow()

  const invoice = await db
    .insertInto('checkout.invoices')
    .values({
      locale: 'nl-NL',
      currency: 'EUR',
      companyPrefix: 'X',
      numberPrefix: '2026-000',
      numberPrefixTemplate: 'template',
      number: 1,
      paymentTermDays: 14,
      dueDate: '2026-07-01',
      lines: '[]',
      companyDetails: '{}',
      clientDetails: '{}',
      taxSummary: '[]',
      totalIncludingTax: 5000,
      totalExcludingTax: 5000,
      status: InvoiceStatus.OPEN,
      companyId
    })
    .returning(['id', 'uuid'])
    .executeTakeFirstOrThrow()

  return { companyId, invoiceId: invoice.id, invoiceUuid: invoice.uuid ?? '' }
}

const invoiceFor = (
  seeded: SeedRow,
  overrides: Partial<MatchInvoice & { uuid: string }> = {}
): MatchInvoice & { uuid: string } => ({
  id: seeded.invoiceId,
  number: '2026-0001',
  amountDueCents: 5000,
  dueDate: '2026-07-01',
  status: InvoiceStatus.OPEN,
  companyId: seeded.companyId,
  currency: 'EUR',
  uuid: seeded.invoiceUuid,
  ...overrides
})

const addPayment = async (
  db: Kysely<DB>,
  {
    invoiceId,
    amount = 5000,
    method = PaymentMethod.banktransfer,
    status = PaymentStatus.PAID,
    transactionReference = null
  }: {
    invoiceId: number
    amount?: number
    method?: PaymentMethod
    status?: PaymentStatus
    transactionReference?: string | null
  }
): Promise<number> => {
  const row = await db
    .insertInto('checkout.payments')
    .values({
      invoiceId,
      description: 'handmatig',
      paymentServiceProvider: null,
      method,
      externalId: null,
      transactionReference,
      amount,
      currency: 'EUR',
      status
    })
    .returning('id')
    .executeTakeFirstOrThrow()
  return row.id
}

describeDb('banking/apply', () => {
  let fetchBankPayments: (typeof import('../../../src/banking/apply.js'))['fetchBankPayments']
  let linkBankCreditToInvoice: (typeof import('../../../src/banking/apply.js'))['linkBankCreditToInvoice']
  let linkBankCreditsToInvoices: (typeof import('../../../src/banking/apply.js'))['linkBankCreditsToInvoices']

  ;(beforeAll(async () => {
    const apply = await import('../../../src/banking/apply.js')
    fetchBankPayments = apply.fetchBankPayments
    linkBankCreditToInvoice = apply.linkBankCreditToInvoice
    linkBankCreditsToInvoices = apply.linkBankCreditsToInvoices
  }),
    beforeEach(async () => {
      if (!testDb) return
      await sql`TRUNCATE TABLE companies, "checkout".invoices, "checkout".payments,
      invoice_events CASCADE`.execute(testDb)
    }))

  const countPayments = async () => {
    const rows = await testDb!
      .selectFrom('checkout.payments')
      .select('id')
      .execute()
    return rows.length
  }

  it('fetchBankPayments indexes every bank-linked payment by reference', async () => {
    const seeded = await seed(testDb!)
    await addPayment(testDb!, {
      invoiceId: seeded.invoiceId,
      transactionReference: 'bank:txn-1'
    })
    await addPayment(testDb!, {
      invoiceId: seeded.invoiceId,
      transactionReference: 'bank:txn-2'
    })
    await addPayment(testDb!, { invoiceId: seeded.invoiceId }) // manual, unlinked

    const index = await fetchBankPayments(testDb!)
    expect(index.refs).toEqual(new Set(['bank:txn-1', 'bank:txn-2']))
    expect(index.byRef.get('bank:txn-1')?.[0]?.invoiceId).toBe(seeded.invoiceId)
    expect(index.byRef.size).toBe(2)
  })

  it('adopts an exact-amount paid manual banktransfer payment instead of creating a second one', async () => {
    const seeded = await seed(testDb!)
    const paymentId = await addPayment(testDb!, { invoiceId: seeded.invoiceId })
    const addPaymentToInvoice = makeHandler()

    const result = await linkBankCreditToInvoice({
      db: testDb!,
      invoiceHandler: { addPaymentToInvoice },
      invoice: invoiceFor(seeded),
      transaction: credit({ companyId: seeded.companyId })
    })

    expect(result).toEqual({ adopted: true, alreadyLinked: false, paymentId })
    expect(addPaymentToInvoice).not.toHaveBeenCalled()
    const row = await testDb!
      .selectFrom('checkout.payments')
      .select('transactionReference')
      .where('id', '=', paymentId)
      .executeTakeFirst()
    expect(row?.transactionReference).toBe('bank:txn-1')
    expect(await countPayments()).toBe(1)
  })

  it('adopts when the manual payment reference equals the booking date', async () => {
    const seeded = await seed(testDb!)
    const paymentId = await addPayment(testDb!, {
      invoiceId: seeded.invoiceId,
      transactionReference: '2026-06-30'
    })
    const addPaymentToInvoice = makeHandler()

    const result = await linkBankCreditToInvoice({
      db: testDb!,
      invoiceHandler: { addPaymentToInvoice },
      invoice: invoiceFor(seeded),
      transaction: credit({ companyId: seeded.companyId })
    })

    expect(result.adopted).toBe(true)
    const row = await testDb!
      .selectFrom('checkout.payments')
      .select('transactionReference')
      .where('id', '=', paymentId)
      .executeTakeFirst()
    expect(row?.transactionReference).toBe('bank:txn-1')
    expect(await countPayments()).toBe(1)
  })

  it('creates a new payment when there is no adoptable payment', async () => {
    const seeded = await seed(testDb!)
    const addPaymentToInvoice = vi.fn<InvoiceHandler['addPaymentToInvoice']>(
      async () => ({
        success: true,
        payment: { id: 4242 }
      })
    )

    const result = await linkBankCreditToInvoice({
      db: testDb!,
      invoiceHandler: { addPaymentToInvoice },
      invoice: invoiceFor(seeded),
      transaction: credit()
    })

    expect(result).toEqual({
      adopted: false,
      alreadyLinked: false,
      paymentId: 4242
    })
    expect(addPaymentToInvoice).toHaveBeenCalledTimes(1)
    const call = addPaymentToInvoice.mock.calls[0]![0]
    expect(call.id).toBe(seeded.invoiceId)
    expect(call.payment.amount).toBe(5000)
    expect(call.payment.currency).toBe('EUR')
    expect(call.payment.method).toBe(PaymentMethod.banktransfer)
    expect(call.payment.description).toBe('Factuur 2026-0001')
    expect(call.payment.transactionReference).toBe('bank:txn-1')
    // The applied payment must carry the bank booking date as paidAt.
    expect(call.payment.date).toBe('2026-06-30')
  })

  it('falls back to transactionDate when bookingDate is missing', async () => {
    const seeded = await seed(testDb!)
    const addPaymentToInvoice = vi.fn<InvoiceHandler['addPaymentToInvoice']>(
      async () => ({
        success: true,
        payment: { id: 4243 }
      })
    )

    const result = await linkBankCreditToInvoice({
      db: testDb!,
      invoiceHandler: { addPaymentToInvoice },
      invoice: invoiceFor(seeded),
      transaction: credit({
        companyId: seeded.companyId,
        bookingDate: null,
        transactionDate: '2026-06-28'
      })
    })

    expect(result.adopted).toBe(false)
    const call = addPaymentToInvoice.mock.calls[0]![0]
    expect(call.payment.date).toBe('2026-06-28')
  })

  it('falls through to create when the adoptable payment belongs to another company', async () => {
    const seeded = await seed(testDb!)
    await addPayment(testDb!, { invoiceId: seeded.invoiceId })
    const addPaymentToInvoice = vi.fn<InvoiceHandler['addPaymentToInvoice']>(
      async () => ({
        success: true,
        payment: { id: 4242 }
      })
    )

    const result = await linkBankCreditToInvoice({
      db: testDb!,
      invoiceHandler: { addPaymentToInvoice },
      invoice: invoiceFor(seeded, { companyId: 99 }),
      transaction: credit()
    })

    expect(result.adopted).toBe(false)
    expect(addPaymentToInvoice).toHaveBeenCalledTimes(1)
  })

  it('returns alreadyLinked when the transaction reference already exists', async () => {
    const seeded = await seed(testDb!)
    await addPayment(testDb!, {
      invoiceId: seeded.invoiceId,
      transactionReference: 'bank:txn-1'
    })
    const addPaymentToInvoice = makeHandler()

    const result = await linkBankCreditToInvoice({
      db: testDb!,
      invoiceHandler: { addPaymentToInvoice },
      invoice: invoiceFor(seeded),
      transaction: credit()
    })

    expect(result).toEqual({ adopted: false, alreadyLinked: true })
    expect(addPaymentToInvoice).not.toHaveBeenCalled()
    expect(await countPayments()).toBe(1)
  })

  it('treats a unique violation from a concurrent apply as alreadyLinked', async () => {
    const seeded = await seed(testDb!)
    const addPaymentToInvoice = makeFailingHandler()

    const result = await linkBankCreditToInvoice({
      db: testDb!,
      invoiceHandler: { addPaymentToInvoice },
      invoice: invoiceFor(seeded),
      transaction: credit()
    })

    expect(result).toEqual({ adopted: false, alreadyLinked: true })
  })

  it('returns an error result when no invoice handler is available', async () => {
    const seeded = await seed(testDb!)

    const result = await linkBankCreditToInvoice({
      db: testDb!,
      invoiceHandler: undefined,
      invoice: invoiceFor(seeded),
      transaction: credit()
    })

    expect(result).toMatchObject({ adopted: false, alreadyLinked: false })
    expect('error' in result ? result.error : undefined).toContain(
      'unavailable'
    )
  })

  it('allows one bank: reference across two invoices and rejects the same (ref, invoice) pair twice', async () => {
    // Relaxed partial unique index (transaction_reference, invoice_id): a
    // PSP payout credit linked to two invoices is legal; the OLD index (unique
    // on transaction_reference alone) would reject the second insert.
    const seededA = await seed(testDb!)
    // A second invoice under the same company (different number — the
    // (company_prefix, number_prefix, number) unique must not collide).
    const invoiceB = await testDb!
      .insertInto('checkout.invoices')
      .values({
        locale: 'nl-NL',
        currency: 'EUR',
        companyPrefix: 'X',
        numberPrefix: '2026-000',
        numberPrefixTemplate: 'template',
        number: 2,
        paymentTermDays: 14,
        dueDate: '2026-07-01',
        lines: '[]',
        companyDetails: '{}',
        clientDetails: '{}',
        taxSummary: '[]',
        totalIncludingTax: 5000,
        totalExcludingTax: 5000,
        status: InvoiceStatus.OPEN,
        companyId: seededA.companyId
      })
      .returning('id')
      .executeTakeFirstOrThrow()

    await addPayment(testDb!, {
      invoiceId: seededA.invoiceId,
      transactionReference: 'bank:txn-dup'
    })
    await addPayment(testDb!, {
      invoiceId: invoiceB.id,
      transactionReference: 'bank:txn-dup'
    })

    await expect(
      addPayment(testDb!, {
        invoiceId: seededA.invoiceId,
        transactionReference: 'bank:txn-dup'
      })
    ).rejects.toMatchObject({ code: '23505' })
  })

  it('linkBankCreditsToInvoices creates one payment per invoice sharing the bank reference', async () => {
    const seededA = await seed(testDb!)
    const invoiceB = await testDb!
      .insertInto('checkout.invoices')
      .values({
        locale: 'nl-NL',
        currency: 'EUR',
        companyPrefix: 'X',
        numberPrefix: '2026-000',
        numberPrefixTemplate: 'template',
        number: 3,
        paymentTermDays: 14,
        dueDate: '2026-07-01',
        lines: '[]',
        companyDetails: '{}',
        clientDetails: '{}',
        taxSummary: '[]',
        totalIncludingTax: 5000,
        totalExcludingTax: 5000,
        status: InvoiceStatus.OPEN,
        companyId: seededA.companyId
      })
      .returning(['id', 'uuid'])
      .executeTakeFirstOrThrow()

    const addPaymentToInvoice = vi.fn<InvoiceHandler['addPaymentToInvoice']>(
      async () => ({
        success: true,
        payment: { id: 4242 }
      })
    )
    const results = await linkBankCreditsToInvoices({
      db: testDb!,
      invoiceHandler: { addPaymentToInvoice },
      invoices: [
        invoiceFor(seededA),
        invoiceFor(seededA, {
          id: invoiceB.id,
          uuid: invoiceB.uuid ?? ''
        })
      ],
      transaction: credit(),
      bankRefs: await fetchBankPayments(testDb!)
    })

    expect(results).toHaveLength(2)
    expect(
      results.every((result) => result.paymentId && !result.alreadyLinked)
    ).toBe(true)
    expect(addPaymentToInvoice).toHaveBeenCalledTimes(2)
    const ids = addPaymentToInvoice.mock.calls.map((call) => call[0].id)
    expect(new Set(ids)).toEqual(new Set([seededA.invoiceId, invoiceB.id]))
    const references = addPaymentToInvoice.mock.calls.map(
      (call) => call[0].payment.transactionReference
    )
    expect(references).toEqual(['bank:txn-1', 'bank:txn-1'])
  })
})
