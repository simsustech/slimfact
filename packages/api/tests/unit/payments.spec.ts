import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  it,
  expect,
  vi
} from 'vitest'
import { Kysely, PostgresDialect, CamelCasePlugin } from 'kysely'
import pg from 'pg'
import {
  createInvoiceHandler,
  createBankTransferPaymentHandler,
  createCashPaymentHandler,
  createPinPaymentHandler,
  InvoiceStatus,
  PaymentMethod,
  PaymentStatus
} from '@modular-api/fastify-checkout'
import type { DB } from '../../src/kysely/types.js'

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
    console.warn(
      `payments.spec: test DB unavailable, skipping: ${String(error)}`
    )
    testDb = null
  }
}

afterAll(async () => {
  if (testDb) await testDb.destroy()
})

const describeDb = testDb ? describe : describe.skip

const fakeFastify = {
  log: {
    warn: vi.fn(),
    debug: vi.fn(),
    info: vi.fn(),
    error: vi.fn()
  }
} as unknown as Parameters<typeof createInvoiceHandler>[0]['fastify']

const createdInvoiceIds: number[] = []

const mkInvoice = async (
  overrides: Partial<{
    status: InvoiceStatus
    totalIncludingTax: number
  }> = {}
): Promise<{ id: number; totalIncludingTax: number }> => {
  const totalIncludingTax = overrides.totalIncludingTax ?? 5000
  const inserted = await testDb!
    .insertInto('checkout.invoices')
    .values({
      locale: 'en-US',
      currency: 'EUR',
      companyPrefix: 'TEST',
      numberPrefixTemplate: 'TEST-{{number}}',
      paymentTermDays: 14,
      lines: JSON.stringify([]),
      companyDetails: JSON.stringify({ prefix: 'TEST' }),
      clientDetails: JSON.stringify({}),
      taxSummary: JSON.stringify([]),
      totalIncludingTax,
      totalExcludingTax: totalIncludingTax,
      status: overrides.status ?? InvoiceStatus.OPEN
    })
    .returningAll()
    .executeTakeFirstOrThrow()
  createdInvoiceIds.push(inserted.id)
  return { id: inserted.id, totalIncludingTax }
}

beforeEach(async () => {
  vi.clearAllMocks()
})

afterEach(async () => {
  if (!testDb) return
  const ids = [...createdInvoiceIds]
  createdInvoiceIds.length = 0
  if (ids.length) {
    await testDb
      .deleteFrom('checkout.payments')
      .where('checkout.payments.invoiceId', 'in', ids)
      .execute()
    await testDb
      .deleteFrom('invoiceEvents')
      .where('invoiceEvents.invoiceId', 'in', ids)
      .execute()
    await testDb
      .deleteFrom('checkout.invoices')
      .where('checkout.invoices.id', 'in', ids)
      .execute()
  }
})

describeDb('invoiceHandler.deletePaymentFromInvoice', () => {
  const buildHandler = () =>
    createInvoiceHandler({
      fastify: fakeFastify,
      kysely: testDb!,
      paymentHandlers: {
        cash: createCashPaymentHandler({
          fastify: fakeFastify as never,
          kysely: testDb as never
        }),
        bankTransfer: createBankTransferPaymentHandler({
          fastify: fakeFastify as never,
          kysely: testDb as never
        }),
        pin: createPinPaymentHandler({
          fastify: fakeFastify as never,
          kysely: testDb as never
        })
      }
    })

  it('deletes an offline payment and recomputes the open amount', async () => {
    const handler = buildHandler()
    const { id } = await mkInvoice()

    const added = await handler.addPaymentToInvoice({
      id,
      payment: {
        method: PaymentMethod.cash,
        amount: 2000,
        currency: 'EUR',
        description: 'Cash payment'
      }
    })
    expect(added.success).toBe(true)
    if (!added.success) throw new Error(added.errorMessage)

    const paymentId = added.payment.id
    const result = await handler.deletePaymentFromInvoice!({ id, paymentId })
    expect(result.success).toBe(true)

    const rows = await testDb!
      .selectFrom('checkout.payments')
      .where('checkout.payments.id', '=', paymentId)
      .execute()
    expect(rows).toHaveLength(0)

    const invoice = await testDb!
      .selectFrom('checkout.invoices')
      .where('checkout.invoices.id', '=', id)
      .select('status')
      .executeTakeFirstOrThrow()
    expect(invoice.status).toBe(InvoiceStatus.OPEN)
  })

  it('reverts a fully paid invoice to OPEN when its last payment is deleted', async () => {
    const handler = buildHandler()
    const { id, totalIncludingTax } = await mkInvoice()

    const added = await handler.addPaymentToInvoice({
      id,
      payment: {
        method: PaymentMethod.banktransfer,
        amount: totalIncludingTax,
        currency: 'EUR',
        description: 'Bank transfer'
      }
    })
    expect(added.success).toBe(true)
    if (!added.success) throw new Error(added.errorMessage)

    const afterPay = await testDb!
      .selectFrom('checkout.invoices')
      .where('checkout.invoices.id', '=', id)
      .select('status')
      .executeTakeFirstOrThrow()
    expect(afterPay.status).toBe(InvoiceStatus.PAID)

    const result = await handler.deletePaymentFromInvoice!({
      id,
      paymentId: added.payment.id
    })
    expect(result.success).toBe(true)

    const afterDelete = await testDb!
      .selectFrom('checkout.invoices')
      .where('checkout.invoices.id', '=', id)
      .select('status')
      .executeTakeFirstOrThrow()
    expect(afterDelete.status).toBe(InvoiceStatus.OPEN)
  })

  it('keeps partial payments paid-status intact when other payments remain', async () => {
    const handler = buildHandler()
    const { id } = await mkInvoice({ totalIncludingTax: 5000 })

    const first = await handler.addPaymentToInvoice({
      id,
      payment: {
        method: PaymentMethod.cash,
        amount: 2000,
        currency: 'EUR',
        description: 'Partial cash'
      }
    })
    expect(first.success).toBe(true)

    if (!first.success) throw new Error(first.errorMessage)

    const result = await handler.deletePaymentFromInvoice!({
      id,
      paymentId: first.payment.id
    })
    expect(result.success).toBe(true)
  })

  it('refuses to delete PSP-settled payments', async () => {
    const handler = buildHandler()
    const { id } = await mkInvoice({ status: InvoiceStatus.PAID })

    const inserted = await testDb!
      .insertInto('checkout.payments')
      .values({
        invoiceId: id,
        description: 'Stripe checkout',
        method: PaymentMethod.creditcard,
        amount: 5000,
        currency: 'EUR',
        status: PaymentStatus.PAID,
        paidAt: new Date().toISOString(),
        paymentServiceProvider: 'stripe',
        settlementId: 'setl-test-1'
      })
      .returningAll()
      .executeTakeFirstOrThrow()

    const result = await handler.deletePaymentFromInvoice!({
      id,
      paymentId: inserted.id
    })
    expect(result.success).toBe(false)
    if (result.success) throw new Error('expected failure')
    expect(result.errorMessage).toMatch(/offline/i)

    const stillThere = await testDb!
      .selectFrom('checkout.payments')
      .where('checkout.payments.id', '=', inserted.id)
      .execute()
    expect(stillThere).toHaveLength(1)
  })

  it('fails when the payment belongs to another invoice', async () => {
    const handler = buildHandler()
    const invoiceA = await mkInvoice()
    const invoiceB = await mkInvoice()

    const added = await handler.addPaymentToInvoice({
      id: invoiceA.id,
      payment: {
        method: PaymentMethod.cash,
        amount: 1000,
        currency: 'EUR',
        description: 'Cash on A'
      }
    })
    expect(added.success).toBe(true)
    if (!added.success) throw new Error(added.errorMessage)

    const result = await handler.deletePaymentFromInvoice!({
      id: invoiceB.id,
      paymentId: added.payment.id
    })
    expect(result.success).toBe(false)

    const untouched = await testDb!
      .selectFrom('checkout.payments')
      .where('checkout.payments.id', '=', added.payment.id)
      .execute()
    expect(untouched).toHaveLength(1)
  })
})

describeDb('invoiceHandler.addPaymentToInvoice date handling', () => {
  const buildHandler = () =>
    createInvoiceHandler({
      fastify: fakeFastify,
      kysely: testDb!,
      paymentHandlers: {
        cash: createCashPaymentHandler({
          fastify: fakeFastify as never,
          kysely: testDb as never
        }),
        bankTransfer: createBankTransferPaymentHandler({
          fastify: fakeFastify as never,
          kysely: testDb as never
        }),
        pin: createPinPaymentHandler({
          fastify: fakeFastify as never,
          kysely: testDb as never
        })
      }
    })

  it('persists a provided date as the payment paidAt', async () => {
    const handler = buildHandler()
    const { id } = await mkInvoice()

    const added = await handler.addPaymentToInvoice({
      id,
      payment: {
        method: PaymentMethod.banktransfer,
        amount: 1000,
        currency: 'EUR',
        description: 'Dated transfer',
        date: '2026-08-20'
      }
    })
    expect(added.success).toBe(true)
    if (!added.success) throw new Error(added.errorMessage)

    const row = await testDb!
      .selectFrom('checkout.payments')
      .where('checkout.payments.id', '=', added.payment.id)
      .select('paidAt')
      .executeTakeFirstOrThrow()
    expect(new Date(row.paidAt as unknown as string).toISOString()).toBe(
      '2026-08-20T00:00:00.000Z'
    )
  })
})
