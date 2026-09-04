import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest'
import { initTRPC } from '@trpc/server'
import { Kysely, PostgresDialect, CamelCasePlugin } from 'kysely'
import pg from 'pg'
import {
  InvoiceStatus,
  PaymentMethod,
  PaymentStatus,
  RefundStatus
} from '@modular-api/fastify-checkout'
import type { BankingApi } from '../../src/banking/client.js'
import type { DB } from '../../src/kysely/types.js'

const { Pool } = pg

// Mirror the API server's pg type parsers.
pg.types.setTypeParser(1700, (value: string) => parseFloat(value))
pg.types.setTypeParser(1114, (value: string) => value)
pg.types.setTypeParser(1082, (value: string) => value)

const databaseUrl =
  process.env.TEST_DATABASE_URL ??
  'postgres://postgres:ufgouifdgjdfg@localhost:5433/slimfact_unit'

const testDb = new Kysely<DB>({
  dialect: new PostgresDialect({
    pool: new Pool({ connectionString: databaseUrl, max: 5 })
  }),
  plugins: [new CamelCasePlugin()]
})

// The router uses its own db singleton — point it at the unit database via
// env BEFORE importing any module that builds appConfig / the pool.
process.env.POSTGRES_HOST = 'localhost'
const envPort = process.env.TEST_DATABASE_URL
  ? new URL(process.env.TEST_DATABASE_URL).port
  : '5433'
process.env.POSTGRES_PORT = envPort
process.env.POSTGRES_PASSWORD = 'ufgouifdgjdfg'
process.env.POSTGRES_DB = 'slimfact_unit'
process.env.API_HOST = 'slimfact.test'
process.env.OTP_SECRET = 'test-otp-secret'
process.env.OIDC_CLIENT_SECRET = 'test-client-secret'
process.env.OIDC_COOKIES_KEYS = 'test-cookie-keys'

afterAll(async () => {
  await testDb.destroy()
})

const t = initTRPC
  .context<{
    account: { id: string; roles?: string[] } | null
    session: { exp: number } | null
  }>()
  .create()

let fakeClient: BankingApi | null

// kysely/index.ts installs a BigInt.toJSON serializer at import time;
// vi.resetModules() re-runs it every load, so neutralize the redefine —
// scoped strictly to the dynamic import (a global spy leaks into vitest
// internals, which call Object.defineProperty on primitives).
const loadWithGuardedImports = async <T>(
  load: () => Promise<T>
): Promise<T> => {
  const original = Object.defineProperty
  const guarded = ((
    target: unknown,
    key: PropertyKey,
    descriptor: PropertyDescriptor
  ) => {
    if (target === BigInt.prototype && key === 'toJSON') return target
    return original(target as object, key, descriptor)
  }) as typeof Object.defineProperty
  ;(Object as { defineProperty: typeof Object.defineProperty }).defineProperty =
    guarded
  try {
    return await load()
  } finally {
    Object.defineProperty = original
  }
}

const fakeFastify = () =>
  ({
    log: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() },
    banking: { getClient: () => fakeClient }
  }) as never

const loadCaller = async () =>
  loadWithGuardedImports(async () => {
    const module = await import('../../src/trpc/admin/payments.js')
    const router = t.router(
      module.adminPaymentsRoutes({
        fastify: fakeFastify(),
        procedure: t.procedure
      })
    )
    return router.createCaller({ account: null, session: null })
  })

/* ------------------------------------------------------------------ */
/* Fixtures                                                            */
/* ------------------------------------------------------------------ */

const PREFIX = 'POT' // payments overview test

// The ledger reads the whole checkout schema, so parallel unit specs sharing
// slimfact_unit can leave rows behind. Every test scopes its assertions to
// its own fixtures via a unique description token.
const uniqueToken = () => `pot-${Math.random().toString(36).slice(2, 10)}`

const mkCompany = async (): Promise<number> => {
  const row = await testDb
    .insertInto('companies')
    .values({
      name: `${PREFIX} Company`,
      prefix: PREFIX,
      address: 'Ledger Lane 1',
      city: 'Ledgerdam',
      country: 'NL',
      cocNumber: '12345678',
      email: 'ledger@example.com',
      iban: 'NL00POTB0000000000',
      bic: 'POTBNL2A',
      postalCode: '1234AB',
      vatIdNumber: 'NL123456789B01'
    })
    .returningAll()
    .executeTakeFirstOrThrow()
  return row.id
}

const mkClient = async (name: string): Promise<number> => {
  const row = await testDb
    .insertInto('clients')
    .values({
      companyName: name,
      address: 'Client Street 1',
      city: 'Clientville',
      country: 'NL',
      email: `${name.toLowerCase().replace(/\s+/g, '.')}@example.com`,
      postalCode: '4567CD'
    })
    .returningAll()
    .executeTakeFirstOrThrow()
  return row.id
}

const mkInvoice = async (
  companyId: number,
  clientId: number,
  overrides: Partial<{ number: number; status: InvoiceStatus }> = {}
): Promise<{ id: number; uuid: string }> => {
  const row = await testDb
    .insertInto('checkout.invoices')
    .values({
      locale: 'en-US',
      currency: 'EUR',
      companyPrefix: PREFIX,
      numberPrefix: '2026',
      numberPrefixTemplate: '{{prefix}}.{{number}}',
      number: overrides.number ?? 900,
      paymentTermDays: 14,
      lines: JSON.stringify([]),
      companyDetails: JSON.stringify({ prefix: PREFIX }),
      clientDetails: JSON.stringify({}),
      taxSummary: JSON.stringify([]),
      totalIncludingTax: 10000,
      totalExcludingTax: 10000,
      status: overrides.status ?? InvoiceStatus.OPEN,
      companyId,
      clientId
    })
    .returningAll()
    .executeTakeFirstOrThrow()
  return { id: row.id, uuid: row.uuid }
}

interface MkPaymentOverrides {
  method?: PaymentMethod
  status?: PaymentStatus
  amount?: number
  paidAt?: string | null
  createdAt?: string
  transactionReference?: string | null
  externalId?: string | null
  settlementId?: string | null
  paymentServiceProvider?: 'mollie' | 'stripe' | null
  description?: string
}

const createdPaymentIds: number[] = []
const createdRefundIds: number[] = []
const createdInvoiceIds: number[] = []
const createdCompanyIds: number[] = []
const createdClientIds: number[] = []

const mkPayment = async (
  invoiceId: number | null,
  overrides: MkPaymentOverrides = {}
): Promise<number> => {
  const row = await testDb
    .insertInto('checkout.payments')
    .values({
      description: overrides.description ?? 'Test payment',
      method: overrides.method ?? PaymentMethod.cash,
      amount: overrides.amount ?? 5000,
      currency: 'EUR',
      status: overrides.status ?? PaymentStatus.PAID,
      invoiceId,
      paidAt:
        overrides.paidAt === undefined
          ? '2026-03-01T10:00:00Z'
          : overrides.paidAt,
      createdAt: overrides.createdAt ?? '2026-03-01 09:00:00+00',
      transactionReference: overrides.transactionReference ?? null,
      externalId: overrides.externalId ?? null,
      settlementId: overrides.settlementId ?? null,
      paymentServiceProvider: overrides.paymentServiceProvider ?? null
    })
    .returningAll()
    .executeTakeFirstOrThrow()
  createdPaymentIds.push(row.id)
  return row.id
}

const mkRefund = async (
  paymentId: number,
  overrides: Partial<{
    amount: number
    status: RefundStatus
    createdAt: string
    paymentServiceProvider: 'mollie' | 'stripe' | null
    externalId: string
    description: string
  }> = {}
): Promise<number> => {
  const row = await testDb
    .insertInto('checkout.refunds')
    .values({
      paymentId,
      description: overrides.description ?? 'Refund of test payment',
      paymentServiceProvider:
        overrides.paymentServiceProvider === undefined
          ? ('mollie' as const)
          : overrides.paymentServiceProvider,
      amount: overrides.amount ?? 1200,
      currency: 'EUR',
      status: overrides.status ?? RefundStatus.REFUNDED,
      createdAt: overrides.createdAt ?? '2026-03-05 12:00:00+00',
      externalId: overrides.externalId ?? `re-${Math.random()}`
    })
    .returningAll()
    .executeTakeFirstOrThrow()
  createdRefundIds.push(row.id)
  return row.id
}

afterEach(async () => {
  if (createdRefundIds.length) {
    await testDb
      .deleteFrom('checkout.refunds')
      .where('id', 'in', createdRefundIds.splice(0, createdRefundIds.length))
      .execute()
  }
  if (createdPaymentIds.length) {
    // Also sweep any bank-ref payments created outside tracked ids.
    await testDb
      .deleteFrom('checkout.payments')
      .where((eb) =>
        eb.or([
          eb(
            'checkout.payments.id',
            'in',
            createdPaymentIds.splice(0, createdPaymentIds.length)
          ),
          eb('transactionReference', 'like', 'pot-tx-%')
        ])
      )
      .execute()
  }
  if (createdInvoiceIds.length) {
    await testDb
      .deleteFrom('checkout.invoices')
      .where('id', 'in', createdInvoiceIds.splice(0, createdInvoiceIds.length))
      .execute()
  }
  if (createdClientIds.length) {
    await testDb
      .deleteFrom('clients')
      .where('id', 'in', createdClientIds.splice(0, createdClientIds.length))
      .execute()
  }
  if (createdCompanyIds.length) {
    await testDb
      .deleteFrom('companies')
      .where('id', 'in', createdCompanyIds.splice(0, createdCompanyIds.length))
      .execute()
  }
  vi.restoreAllMocks()
})

beforeEach(() => {
  vi.resetModules()
  process.env.BANKING_API_KEY = 'obk_test'
  process.env.BANKING_API_URL = 'http://banking-api'
  fakeClient = null
})

/* ------------------------------------------------------------------ */
/* Tests                                                               */
/* ------------------------------------------------------------------ */

describe('admin payments ledger', () => {
  it('lists payments and refunds newest-first with refunds negative', async () => {
    const companyId = await mkCompany()
    createdCompanyIds.push(companyId)
    const clientId = await mkClient(`${PREFIX} Client`)
    createdClientIds.push(clientId)
    const invoice = await mkInvoice(companyId, clientId)
    createdInvoiceIds.push(invoice.id)

    const token = uniqueToken()
    const paymentId = await mkPayment(invoice.id, {
      description: `${token} cash`
    })
    await mkRefund(paymentId, { description: `${token} refund` })

    const caller = await loadCaller()
    const result = await caller.listPayments({ q: token, limit: 50, offset: 0 })

    expect(result.rows).toHaveLength(2)
    const [top, second] = result.rows
    expect(top!.kind).toBe('refund')
    expect(top!.amountCents).toBe(-1200)
    expect(top!.method).toBe('refund')
    expect(top!.invoiceNumber).toBe('2026900')
    expect(top!.clientName).toBe(`${PREFIX} Client`)
    expect(second!.kind).toBe('payment')
    expect(second!.method).toBe(PaymentMethod.cash)
    expect(second!.amountCents).toBe(5000)
    expect(second!.date).toContain('2026-03-01')
  })

  it('filters by method, status and search query', async () => {
    const companyId = await mkCompany()
    createdCompanyIds.push(companyId)
    const clientId = await mkClient(`Zebra ${PREFIX}`)
    createdClientIds.push(clientId)
    const invoice = await mkInvoice(companyId, clientId)
    createdInvoiceIds.push(invoice.id)

    const token = uniqueToken()
    await mkPayment(invoice.id, {
      method: PaymentMethod.cash,
      description: `${token} cash`
    })
    await mkPayment(invoice.id, {
      method: PaymentMethod.ideal,
      description: `${token} ideal`,
      paymentServiceProvider: 'mollie'
    })

    const caller = await loadCaller()

    const byMethod = await caller.listPayments({
      q: token,
      methods: [PaymentMethod.ideal],
      limit: 50,
      offset: 0
    })
    expect(byMethod.rows).toHaveLength(1)
    expect(byMethod.rows[0]!.method).toBe(PaymentMethod.ideal)

    const bySearch = await caller.listPayments({
      q: token,
      limit: 50,
      offset: 0
    })
    expect(bySearch.rows).toHaveLength(2)

    const byPsp = await caller.listPayments({
      q: token,
      psps: ['mollie'],
      limit: 50,
      offset: 0
    })
    expect(byPsp.rows).toHaveLength(1)
  })

  it('computes aggregates over the filtered ledger', async () => {
    const companyId = await mkCompany()
    createdCompanyIds.push(companyId)
    const invoice = await mkInvoice(companyId, 0)
    createdInvoiceIds.push(invoice.id)

    const token = uniqueToken()
    const paid = await mkPayment(invoice.id, {
      amount: 4000,
      description: `${token} a`
    })
    await mkPayment(invoice.id, {
      amount: 2500,
      method: PaymentMethod.pin,
      description: `${token} b`
    })
    await mkRefund(paid, { amount: 1000, description: `${token} refund` })

    const caller = await loadCaller()
    const result = await caller.listPayments({ q: token, limit: 50, offset: 0 })

    expect(result.aggregates.inCents).toBe(6500)
    expect(result.aggregates.refundedCents).toBe(1000)
    expect(result.aggregates.netCents).toBe(5500)
    expect(result.aggregates.count).toBe(3)
    expect(result.total).toBe(3)

    const cashChip = result.aggregates.byMethod.find(
      (entry) => entry.method === PaymentMethod.cash
    )
    expect(cashChip?.cents).toBe(4000)
  })

  it('falls back to createdAt for attempts without paidAt', async () => {
    const companyId = await mkCompany()
    createdCompanyIds.push(companyId)
    const invoice = await mkInvoice(companyId, 0)
    createdInvoiceIds.push(invoice.id)

    const token = uniqueToken()
    await mkPayment(invoice.id, {
      status: PaymentStatus.FAILED,
      method: PaymentMethod.ideal,
      paidAt: null,
      description: token,
      createdAt: '2026-01-02 08:30:00+00'
    })

    const caller = await loadCaller()
    const result = await caller.listPayments({ q: token, limit: 50, offset: 0 })
    expect(result.rows[0]!.status).toBe(PaymentStatus.FAILED)
    expect(result.rows[0]!.date).toContain('2026-01-02')
  })

  it('rejects a date range wider than 366 days', async () => {
    const caller = await loadCaller()
    await expect(
      caller.listPayments({
        from: '2024-01-01',
        to: '2025-06-01',
        limit: 50,
        offset: 0
      })
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' })
  })

  it('always returns payments and refunds only', async () => {
    const caller = await loadCaller()
    const result = await caller.listPayments({
      limit: 50,
      offset: 0
    })
    expect(
      result.rows.every(
        (row) => row.kind === 'payment' || row.kind === 'refund'
      )
    ).toBe(true)
  })
})
