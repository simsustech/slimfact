import {
  beforeAll,
  describe,
  it,
  expect,
  beforeEach,
  afterAll,
  vi
} from 'vitest'
import type { Mock } from 'vitest'
import { EventBus } from '@modular-api/event-bus'
import { bankEventSchemas } from '@slimfact/banking-api/events'
import { CamelCasePlugin, Kysely, PostgresDialect, sql } from 'kysely'
import pg from 'pg'
import {
  InvoiceStatus,
  PaymentMethod,
  PaymentStatus
} from '@modular-api/fastify-checkout'
import type {
  Account,
  Connection,
  Transaction
} from '../../../src/banking/client.js'
import type { DB } from '../../../src/kysely/types.js'
import type { BankingApi } from '../../../src/banking/client.js'
import type { InvoiceHandler } from '../../../src/banking/apply.js'

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
    console.warn(`sync.spec: test DB unavailable, skipping: ${String(error)}`)
    testDb = null
  }
}

afterAll(async () => {
  if (testDb) await testDb.destroy()
})

const mkTransaction = (overrides: Partial<Transaction> = {}): Transaction => ({
  id: 'txn-1',
  currency: 'EUR',
  creditDebitIndicator: 'CRDT',
  status: 'BOOK',
  bookingDate: '2026-06-30',
  valueDate: '2026-06-30',
  transactionDate: '2026-06-30',
  amount: '50.00',
  bankTransactionCode: null,
  creditorName: null,
  creditorIban: null,
  creditorBban: null,
  creditorAgentBic: null,
  debtorName: 'Beatrix Klant',
  debtorIban: 'NL00TEST0123456789',
  debtorBban: null,
  debtorAgentBic: null,
  remittanceInformation: null,
  note: 'Factuur 2026-0001',
  referenceNumber: null,
  exchangeRate: null,
  merchantCategoryCode: null,
  balanceAfterTransaction: null,
  balanceAfterCurrency: null,
  ...overrides
})

const mkApiAccount = (overrides: Partial<Account> = {}): Account =>
  ({
    id: 'acc-1',
    aspspName: 'Knab',
    aspspCountry: 'NL',
    currency: 'EUR',
    iban: 'NL00TEST0123456789',
    needsReconnect: false,
    ...overrides
  }) as unknown as Account

const mkConnection = (overrides: Partial<Connection> = {}): Connection => ({
  sessionId: 'conn-1',
  aspspName: 'Knab',
  aspspCountry: 'NL',
  validUntil: '2099-01-01',
  status: 'Active',
  accountCount: 1,
  lastSyncedAt: null,
  psuType: null,
  ...overrides
})

type Seed = { companyId: number; invoiceId: number }

const seed = async (db: Kysely<DB>): Promise<Seed> => {
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

  const { id: invoiceId } = await db
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
    .returning('id')
    .executeTakeFirstOrThrow()

  return { companyId, invoiceId }
}

const addBankTransferPayment = async (
  db: Kysely<DB>,
  invoiceId: number,
  transactionReference: string | null = null
): Promise<void> => {
  await db
    .insertInto('checkout.payments')
    .values({
      invoiceId,
      description: 'handmatig',
      paymentServiceProvider: null,
      method: PaymentMethod.banktransfer,
      externalId: null,
      transactionReference,
      amount: 5000,
      currency: 'EUR',
      status: PaymentStatus.PAID
    })
    .execute()
}

const makeClient = ({
  connections = [] as Connection[],
  apiAccounts = [] as Account[],
  transactionsByAccount = {} as Record<string, Transaction[]>
} = {}): BankingApi => ({
  getAccounts: vi.fn<BankingApi['getAccounts']>(async () => apiAccounts),
  getConnections: vi.fn<BankingApi['getConnections']>(async () => connections),
  getTransactions: vi.fn<BankingApi['getTransactions']>(async (accountId) => ({
    items: transactionsByAccount[accountId] ?? [],
    total: (transactionsByAccount[accountId] ?? []).length
  })),
  syncAll: vi.fn<BankingApi['syncAll']>(async () => ({
    queued: true,
    runId: 'run-1'
  })),
  getSyncStatus: vi.fn<BankingApi['getSyncStatus']>(async () => ({
    status: 'idle'
  })),
  getPspSettlements: vi.fn<BankingApi['getPspSettlements']>(async () => []),
  getPspPayments: vi.fn<BankingApi['getPspPayments']>(async () => [])
})

type AddPaymentSpy = Mock<InvoiceHandler['addPaymentToInvoice']>

/**
 * Realistic default handler: actually inserts the checkout.payments row so the
 * worker's bank-link dedupe (refs from checkout.payments) behaves like prod.
 */
const makeFastify = ({
  client,
  addPaymentToInvoice
}: {
  client: ReturnType<typeof makeClient>
  addPaymentToInvoice?: AddPaymentSpy
}) => ({
  banking: { getClient: () => client },
  checkout: {
    invoiceHandler: {
      addPaymentToInvoice:
        addPaymentToInvoice ??
        (async ({ id, payment }) => {
          const row = await testDb!
            .insertInto('checkout.payments')
            .values({
              invoiceId: id,
              description: payment.description,
              paymentServiceProvider: null,
              method: payment.method,
              externalId: null,
              transactionReference: payment.transactionReference ?? null,
              amount: payment.amount,
              currency: payment.currency,
              status: PaymentStatus.PAID
            })
            .returning('id')
            .executeTakeFirstOrThrow()
          return { success: true, payment: { id: row.id } } as const
        })
    }
  },
  eventBus: { bus: new EventBus(bankEventSchemas) },
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() }
})

const describeDb = testDb ? describe : describe.skip

let processBankSync: (typeof import('../../../src/banking/sync.js'))['processBankSync']
let resetRelay: (typeof import('../../../src/banking/events.js'))['resetRelay']

describeDb('processBankSync', () => {
  beforeAll(async () => {
    process.env.API_HOST = 'slimfact.test'
    process.env.OTP_SECRET = 'test-otp-secret'
    process.env.OIDC_CLIENT_SECRET = 'test-client-secret'
    process.env.OIDC_COOKIES_KEYS = 'test-cookie-keys'
    const sync = await import('../../../src/banking/sync.js')
    processBankSync = sync.processBankSync
    const events = await import('../../../src/banking/events.js')
    resetRelay = events.resetRelay
  })

  beforeEach(async () => {
    resetRelay()
    if (!testDb) return
    await sql`TRUNCATE TABLE companies, "checkout".invoices, "checkout".payments,
      "checkout".refunds, invoice_events, bank_account_companies CASCADE`.execute(
      testDb
    )
  })

  it('strict-matches a new credit to the matching open invoice (creates a bank: payment)', async () => {
    if (!testDb) return
    const { invoiceId } = await seed(testDb!)
    const addPaymentToInvoice: AddPaymentSpy = vi.fn(async () => ({
      success: true,
      payment: { id: 4242 }
    }))
    const client = makeClient({
      apiAccounts: [mkApiAccount()],
      transactionsByAccount: { 'acc-1': [mkTransaction()] }
    })
    const fastify = makeFastify({ client, addPaymentToInvoice })

    const result = await processBankSync({ fastify, db: testDb! })

    expect(result.accounts).toBe(1)
    expect(result.fetched).toBe(1)
    expect(result.applied).toBe(1)
    expect(result.adopted).toBe(0)
    expect(addPaymentToInvoice).toHaveBeenCalledTimes(1)
    const call = addPaymentToInvoice.mock.calls[0]![0]
    expect(call.id).toBe(invoiceId)
    expect(call.payment.amount).toBe(5000)
    expect(call.payment.currency).toBe('EUR')
    expect(call.payment.method).toBe(PaymentMethod.banktransfer)
    expect(call.payment.description).toBe('Factuur 2026-0001')
    expect(call.payment.transactionReference).toBe('bank:txn-1')
  })

  it('leaves a non-strict credit (overpay) unapplied for the review queue', async () => {
    if (!testDb) return
    await seed(testDb!)
    const addPaymentToInvoice: AddPaymentSpy = vi.fn(async () => ({
      success: true,
      payment: { id: 4242 }
    }))
    const client = makeClient({
      apiAccounts: [mkApiAccount()],
      transactionsByAccount: { 'acc-1': [mkTransaction({ amount: '60.00' })] }
    })
    const fastify = makeFastify({ client, addPaymentToInvoice })

    const result = await processBankSync({ fastify, db: testDb! })

    expect(result.fetched).toBe(1) // considered once
    expect(result.applied).toBe(0)
    expect(result.adopted).toBe(0)
    expect(addPaymentToInvoice).not.toHaveBeenCalled()
  })

  it('adopts an exact-amount manual banktransfer payment instead of creating a second one', async () => {
    if (!testDb) return
    const { invoiceId } = await seed(testDb!)
    await addBankTransferPayment(testDb!, invoiceId)
    const addPaymentToInvoice: AddPaymentSpy = vi.fn(async () => ({
      success: true,
      payment: { id: 4242 }
    }))
    const client = makeClient({
      apiAccounts: [mkApiAccount()],
      transactionsByAccount: { 'acc-1': [mkTransaction()] }
    })
    const fastify = makeFastify({ client, addPaymentToInvoice })

    const result = await processBankSync({ fastify, db: testDb! })

    expect(result.fetched).toBe(1)
    expect(result.adopted).toBe(1)
    expect(result.applied).toBe(0)
    expect(addPaymentToInvoice).not.toHaveBeenCalled()
    const rows = await testDb!
      .selectFrom('checkout.payments')
      .select('transactionReference')
      .execute()
    expect(rows).toHaveLength(1)
    expect(rows[0]!.transactionReference).toBe('bank:txn-1')
  })

  it('dedupes a re-run: linked transactions are never fetched or applied twice', async () => {
    if (!testDb) return
    const { invoiceId } = await seed(testDb!)
    const client = makeClient({
      apiAccounts: [mkApiAccount()],
      transactionsByAccount: { 'acc-1': [mkTransaction()] }
    })
    const fastify = makeFastify({ client })

    const first = await processBankSync({ fastify, db: testDb! })
    expect(first.applied).toBe(1)
    expect(first.fetched).toBe(1)

    const second = await processBankSync({ fastify, db: testDb! })
    expect(second.fetched).toBe(0)
    expect(second.applied).toBe(0)
    expect(second.adopted).toBe(0)

    const rows = await testDb!
      .selectFrom('checkout.payments')
      .select('transactionReference')
      .where('invoiceId', '=', invoiceId)
      .execute()
    expect(rows).toHaveLength(1)
    expect(rows[0]!.transactionReference).toBe('bank:txn-1')
  })

  it('skips accounts whose IBAN matches no company (never auto-applied)', async () => {
    if (!testDb) return
    await seed(testDb!)
    const addPaymentToInvoice: AddPaymentSpy = vi.fn(async () => ({
      success: true,
      payment: { id: 4242 }
    }))
    const client = makeClient({
      apiAccounts: [
        mkApiAccount({ id: 'acc-unknown', iban: 'NL99UNKNOWN0000000000' })
      ],
      transactionsByAccount: { 'acc-unknown': [mkTransaction()] }
    })
    const fastify = makeFastify({ client, addPaymentToInvoice })

    const result = await processBankSync({ fastify, db: testDb! })

    expect(result.accounts).toBe(0)
    expect(result.fetched).toBe(0)
    expect(result.applied).toBe(0)
    expect(addPaymentToInvoice).not.toHaveBeenCalled()
  })

  it('resolves an account by explicit link even when its IBAN matches another company (link-first)', async () => {
    if (!testDb) return
    const { companyId, invoiceId } = await seed(testDb!)
    // A second company sharing the IBAN would win under pure IBAN resolution
    // (map last-wins) — it has no invoice, so a wrongly resolved worker applies
    // nothing. The explicit link must pin the account to the first company.
    const { id: ibanShadowCompanyId } = await testDb!
      .insertInto('companies')
      .values({
        prefix: 'SH',
        name: 'Shadow BV',
        address: 'Straat 2',
        postalCode: '1234AB',
        city: 'Den Haag',
        country: 'NL',
        email: 'shadow@test.nl',
        cocNumber: '11112222',
        vatIdNumber: 'NL111122222B01',
        iban: 'NL00TEST0123456789',
        bic: 'TESTNL2A'
      })
      .returning('id')
      .executeTakeFirstOrThrow()
    await testDb!
      .insertInto('bankAccountCompanies')
      .values({ accountExternalId: 'acc-1', companyId })
      .execute()
    const addPaymentToInvoice: AddPaymentSpy = vi.fn(async () => ({
      success: true,
      payment: { id: 4242 }
    }))
    const client = makeClient({
      apiAccounts: [mkApiAccount()],
      transactionsByAccount: { 'acc-1': [mkTransaction()] }
    })
    const fastify = makeFastify({ client, addPaymentToInvoice })

    const result = await processBankSync({ fastify, db: testDb! })

    expect(result.accounts).toBe(1)
    expect(result.applied).toBe(1)
    expect(ibanShadowCompanyId).not.toBe(companyId)
    // The payment landed on the LINKED company's invoice, not the IBAN match.
    const call = addPaymentToInvoice.mock.calls[0]![0]
    expect(call.id).toBe(invoiceId)
  })

  it('skips and surfaces RequiresReauth connections without syncing', async () => {
    if (!testDb) return
    await seed(testDb!)
    const addPaymentToInvoice: AddPaymentSpy = vi.fn(async () => ({
      success: true,
      payment: { id: 4242 }
    }))
    const client = makeClient({
      connections: [mkConnection({ status: 'RequiresReauth' })],
      apiAccounts: [mkApiAccount()],
      transactionsByAccount: { 'acc-1': [mkTransaction()] }
    })
    const fastify = makeFastify({ client, addPaymentToInvoice })

    const result = await processBankSync({ fastify, db: testDb! })

    expect(result.skippedRequiresReauth.length).toBeGreaterThan(0)
    expect(result.skippedRequiresReauth.join()).toContain('RequiresReauth')
    expect(result.accounts).toBe(0)
    expect(client.getTransactions).not.toHaveBeenCalled()
    expect(addPaymentToInvoice).not.toHaveBeenCalled()
  })

  it('waits for the proxy sync run (runId) before ingesting', async () => {
    if (!testDb) return
    await seed(testDb!)
    const addPaymentToInvoice: AddPaymentSpy = vi.fn(async () => ({
      success: true,
      payment: { id: 4242 }
    }))
    const client = makeClient({
      connections: [],
      apiAccounts: [mkApiAccount()],
      transactionsByAccount: { 'acc-1': [mkTransaction()] }
    })
    const bus = new EventBus(bankEventSchemas)
    const fastify = {
      ...makeFastify({ client, addPaymentToInvoice }),
      eventBus: { bus }
    }

    const worker = processBankSync({ fastify, db: testDb!, runId: 'run-42' })
    await new Promise((resolve) => setTimeout(resolve, 30))
    bus.publish('bank.sync.finished', {
      runId: 'run-42',
      status: 'finished',
      accountsSynced: 1,
      accountsSkippedReauth: 0,
      newTransactions: 1
    })
    const result = await worker

    expect(result.applied).toBe(1)
    expect(client.getTransactions).toHaveBeenCalled()
  })

  it('is a no-op when BANKING_INGEST_DISABLED is set (never calls the client)', async () => {
    process.env.BANKING_INGEST_DISABLED = 'true'
    try {
      vi.resetModules()
      const { processBankSync: guardedSync } =
        await import('../../../src/banking/sync.js')
      const client = makeClient({
        apiAccounts: [mkApiAccount()],
        transactionsByAccount: { 'acc-1': [mkTransaction()] }
      })
      const fastify = makeFastify({ client })

      const result = await guardedSync({ fastify, db: testDb! })

      expect(result).toEqual({
        accounts: 0,
        fetched: 0,
        applied: 0,
        adopted: 0,
        skippedRequiresReauth: []
      })
      expect(client.getAccounts).not.toHaveBeenCalled()
      expect(client.getTransactions).not.toHaveBeenCalled()
    } finally {
      delete process.env.BANKING_INGEST_DISABLED
    }
  })
})
