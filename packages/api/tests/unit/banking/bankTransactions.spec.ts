import { initTRPC } from '@trpc/server'
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type MockInstance
} from 'vitest'
import type { Kysely } from 'kysely'
import { sql } from 'kysely'
import {
  InvoiceStatus,
  PaymentMethod,
  PaymentStatus
} from '@modular-api/fastify-checkout'
import type { DB } from '../../../src/kysely/types.js'
import type { BankingApi, Transaction } from '../../../src/banking/client.js'
import type { InvoiceHandler } from '../../../src/banking/apply.js'

const setEnv = (key?: string) => {
  process.env.API_HOST = 'slimfact.test'
  process.env.OTP_SECRET = 'test-otp-secret'
  process.env.OIDC_CLIENT_SECRET = 'test-client-secret'
  process.env.OIDC_COOKIES_KEYS = 'test-cookie-keys'
  process.env.POSTGRES_PASSWORD = process.env.POSTGRES_PASSWORD || 'test'
  process.env.POSTGRES_DB = process.env.POSTGRES_DB || 'slimfact'
  if (key) process.env.BANKING_API_KEY = key
  else delete process.env.BANKING_API_KEY
  process.env.BANKING_API_URL = 'http://banking-api'
}

const t = initTRPC
  .context<{
    account: { id: string; roles?: string[] } | null
    session: { exp: number } | null
  }>()
  .create()

describe('admin bank transaction routes', () => {
  const envBackup = { ...process.env }
  let routesFactory: (typeof import('../../../src/trpc/admin/bankTransactions.js'))['adminBankTransactionRoutes']
  let fakeBoss: { send: ReturnType<typeof vi.fn> }
  let fakeClient: BankingApi
  let originalDefineProperty: typeof Object.defineProperty
  let definePropertySpy: MockInstance

  beforeEach(() => {
    vi.resetModules()
    originalDefineProperty = Object.defineProperty
    definePropertySpy = vi
      .spyOn(Object, 'defineProperty')
      .mockImplementation(
        (
          target: unknown,
          prop: PropertyKey,
          descriptor: PropertyDescriptor
        ) => {
          if (target === BigInt.prototype && prop === 'toJSON') return target
          return originalDefineProperty.call(
            Object,
            target as object,
            prop as PropertyKey,
            descriptor as PropertyDescriptor
          )
        }
      )
    setEnv()
    fakeBoss = { send: vi.fn(async () => 'job-1') }
    fakeClient = {
      getAccounts: vi.fn(async () => []),
      getTransactions: vi.fn(async () => ({ items: [], total: 0 })),
      getConnections: vi.fn(async () => [
        {
          sessionId: 'conn-1',
          aspspName: 'Knab',
          aspspCountry: 'NL',
          status: 'RequiresReauth',
          validUntil: '2020-01-01',
          accountCount: 1,
          lastSyncedAt: null,
          psuType: 'Business'
        }
      ]),
      syncAll: vi.fn(async () => ({ queued: true, runId: 'run-xyz' })),
      getSyncStatus: vi.fn(async () => ({ status: 'idle' })),
      getPspSettlements: vi.fn(async () => []),
      getPspPayments: vi.fn(async () => [])
    } as BankingApi
  })

  afterEach(() => {
    definePropertySpy?.mockRestore()
    Object.defineProperty = originalDefineProperty
    vi.resetModules()
    process.env = { ...envBackup }
  })

  const loadAndCall = async () => {
    const module = await import('../../../src/trpc/admin/bankTransactions.js')
    routesFactory = module.adminBankTransactionRoutes
    const fastify = {
      banking: { getClient: () => fakeClient }
    }
    const router = t.router(
      routesFactory({ fastify: fastify as never, procedure: t.procedure })
    )
    return router.createCaller({ account: null, session: null })
  }

  it('returns disabled + empty connections when banking is not configured', async () => {
    setEnv() // no BANKING_API_KEY
    const caller = await loadAndCall()
    const result = await caller.getConnections()
    expect(result).toEqual({ enabled: false, connections: [] })
  }, 30000)

  it('returns proxy connections with status + validUntil when configured', async () => {
    setEnv('obk_test_key')
    const caller = await loadAndCall()
    const result = await caller.getConnections()
    expect(result.enabled).toBe(true)
    expect(result.connections).toHaveLength(1)
    expect(result.connections[0]).toMatchObject({
      sessionId: 'conn-1',
      status: 'RequiresReauth',
      validUntil: '2020-01-01'
    })
    expect(fakeClient.getConnections).toHaveBeenCalled()
  }, 30000)

  it('requestSync enqueues on the proxy and schedules the local ingest job', async () => {
    setEnv('obk_test_key')
    // initialize pgboss so getBossOrThrow returns the fake
    const pgboss = await import('../../../src/pgboss.js')
    const boss = {
      send: vi.fn(async () => 'job-1'),
      start: vi.fn(async () => {}),
      getSchedules: vi.fn(async () => []),
      getQueue: vi.fn(async () => false),
      createQueue: vi.fn(async () => {}),
      schedule: vi.fn(async () => {}),
      work: vi.fn(async () => {}),
      stop: vi.fn(async () => {})
    }
    await pgboss.initialize({
      fastify: {
        banking: { getClient: () => fakeClient },
        checkout: { invoiceHandler: { createInvoice: vi.fn() } },
        log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() }
      } as never,
      boss: boss as never
    })
    fakeBoss.send = boss.send

    const caller = await loadAndCall()
    const result = await caller.requestSync()

    expect(result).toEqual({ queued: true, runId: 'run-xyz' })
    expect(fakeClient.syncAll).toHaveBeenCalled()
    expect(boss.send).toHaveBeenCalledWith(
      'processBankSync',
      { runId: 'run-xyz' },
      expect.objectContaining({ singletonKey: 'process-sync' })
    )
  })

  it('requestSync throws NOT_FOUND when banking is not configured', async () => {
    setEnv() // no BANKING_API_KEY
    const module = await import('../../../src/trpc/admin/bankTransactions.js')
    const fastify = { banking: { getClient: () => null } }
    const router = t.router(
      module.adminBankTransactionRoutes({
        fastify: fastify as never,
        procedure: t.procedure
      })
    )
    const caller = router.createCaller({ account: null, session: null })

    await expect(caller.requestSync()).rejects.toMatchObject({
      code: 'NOT_FOUND'
    })
  })
})

describe.skipIf(!process.env.TEST_DATABASE_URL)(
  'admin bank transaction routes (DB)',
  () => {
    const envBackup = { ...process.env }
    const fakeClient = {
      getAccounts: vi.fn(async () => []),
      getConnections: vi.fn(async () => []),
      getTransactions: vi.fn(async () => ({ items: [], total: 0 })),
      syncAll: vi.fn(async () => ({ queued: true, runId: 'x' })),
      getSyncStatus: vi.fn(async () => ({ status: 'idle' })),
      getPspSettlements: vi.fn<BankingApi['getPspSettlements']>(async () => []),
      getPspPayments: vi.fn<BankingApi['getPspPayments']>(async () => [])
    } as BankingApi
    let testDb: Kysely<DB> | null = null

    beforeAll(async () => {
      setEnv('obk_test_key')
      const kysely = await import('../../../src/kysely/index.js')
      testDb = kysely.db as Kysely<DB>
    })

    afterAll(async () => {
      await testDb?.destroy()
      process.env = { ...envBackup }
    })

    const seedCompany = async (): Promise<{ companyId: number }> => {
      const { id: companyId } = await testDb!
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
      return { companyId }
    }

    const seedInvoice = async (
      companyId: number,
      number: number,
      amountCents = number === 1 ? 5000 : 2500
    ) => {
      return testDb!
        .insertInto('checkout.invoices')
        .values({
          locale: 'nl-NL',
          currency: 'EUR',
          companyPrefix: 'X',
          numberPrefix: '2026-000',
          numberPrefixTemplate: 'template',
          number,
          paymentTermDays: 14,
          dueDate: '2026-07-01',
          lines: '[]',
          companyDetails: '{}',
          clientDetails: '{}',
          taxSummary: '[]',
          totalIncludingTax: amountCents,
          totalExcludingTax: amountCents,
          status: InvoiceStatus.OPEN,
          companyId
        })
        .returning(['id', 'uuid'])
        .executeTakeFirstOrThrow()
    }

    const makeAccount = () =>
      ({
        id: 'acc-1',
        aspspName: 'Knab',
        aspspCountry: 'NL',
        currency: 'EUR',
        iban: 'NL00TEST0123456789'
      }) as never

    const makeTransaction = () =>
      ({
        id: 'txn-1',
        currency: 'EUR',
        creditDebitIndicator: 'CRDT',
        status: 'BOOK',
        bookingDate: '2026-06-30',
        amount: '50.00',
        note: 'Factuur 2026-0001'
      }) as unknown as Transaction

    beforeEach(async () => {
      // The shared Postgres also holds the E2E seeded world (initial_number_for_prefixes
      // rows) — CASCADE clears every table referencing companies.
      await sql`TRUNCATE TABLE companies, "checkout".invoices, "checkout".payments CASCADE`.execute(
        testDb!
      )
    })

    const loadCaller = async (
      addPaymentToInvoice: unknown = async () => ({
        success: true,
        payment: { id: 4242 }
      })
    ) => {
      const module = await import('../../../src/trpc/admin/bankTransactions.js')
      const fastify = {
        banking: { getClient: () => fakeClient },
        checkout: { invoiceHandler: { addPaymentToInvoice } }
      }
      const router = t.router(
        module.adminBankTransactionRoutes({
          fastify: fastify as never,
          procedure: t.procedure
        })
      )
      return router.createCaller({ account: null, session: null })
    }

    it('listTransactions returns coverage + suggestion per credit row', async () => {
      const { companyId } = await seedCompany()
      await seedInvoice(companyId, 1)
      fakeClient.getAccounts = vi.fn(async () => [makeAccount()])
      fakeClient.getTransactions = vi.fn(async () => ({
        items: [makeTransaction()],
        total: 1
      }))
      fakeClient.getPspSettlements = vi.fn<BankingApi['getPspSettlements']>(
        async () => []
      )
      fakeClient.getPspPayments = vi.fn(async () => [])

      const caller = await loadCaller()
      const result = await caller.listTransactions({})

      expect(result.enabled).toBe(true)
      expect(result.items).toHaveLength(1)
      expect(result.items[0]).toMatchObject({
        coverage: 'unlinked',
        linkedInvoices: []
      })
      expect(result.items[0]!.suggestion).toMatchObject({ type: 'single' })
    }, 30000)

    it('applyLink(direct) links two invoices sharing the bank reference', async () => {
      const { companyId } = await seedCompany()
      const invoiceA = await seedInvoice(companyId, 2)
      const invoiceB = await seedInvoice(companyId, 3)
      fakeClient.getAccounts = vi.fn(async () => [makeAccount()])
      fakeClient.getTransactions = vi.fn(async () => ({
        items: [makeTransaction()],
        total: 1
      }))
      const addPaymentToInvoice = vi.fn<InvoiceHandler['addPaymentToInvoice']>(
        async () => ({
          success: true,
          payment: { id: 4242 }
        })
      )

      const caller = await loadCaller(addPaymentToInvoice)
      const result = await caller.applyLink({
        mode: 'direct',
        accountExternalId: 'acc-1',
        transactionExternalId: 'txn-1',
        invoiceIds: [invoiceA.id, invoiceB.id]
      })

      expect(result.mode).toBe('direct')
      expect(result.results).toHaveLength(2)
      expect(addPaymentToInvoice).toHaveBeenCalledTimes(2)
      const references = addPaymentToInvoice.mock.calls.map(
        (call) => call[0].payment.transactionReference
      )
      expect(references).toEqual(['bank:txn-1', 'bank:txn-1'])
    }, 30000)

    it('listTransactions recognizes a PSP settlement payout as settled (read-time)', async () => {
      const { companyId } = await seedCompany()
      const invoice = await seedInvoice(companyId, 1)
      // The invoice was paid ONLINE via Mollie — the payout lands in the
      // bank later. No bank:<txid> row exists; recognition must come from
      // psp_settlements + checkout.payments alone.
      await testDb!
        .insertInto('checkout.payments')
        .values({
          invoiceId: invoice.id,
          description: 'iDEAL',
          amount: 4950,
          currency: 'EUR',
          method: PaymentMethod.ideal,
          status: PaymentStatus.PAID,
          externalId: 'tr_abc',
          settlementId: 'setl-1',
          paymentServiceProvider: 'mollie'
        })
        .execute()
      fakeClient.getAccounts = vi.fn(async () => [makeAccount()])
      fakeClient.getTransactions = vi.fn(async () => ({
        items: [
          {
            ...makeTransaction(),
            amount: '49.50',
            note: null,
            counterpartyName: 'Mollie B.V.'
          }
        ],
        total: 1
      }))
      fakeClient.getPspSettlements = vi.fn<BankingApi['getPspSettlements']>(
        async () => [
          {
            externalId: 'setl-1',
            psp: 'mollie' as const,
            amountCents: 4950,
            feeCents: 50,
            currency: 'EUR',
            payoutDate: '2026-07-02',
            status: 'paidout',
            syncedAt: new Date('2026-07-03T00:00:00Z'),
            metadata: null
          }
        ]
      )
      fakeClient.getPspPayments = vi.fn(async () => [
        {
          psp: 'mollie' as const,
          externalId: 'tr_abc',
          settlementId: 'setl-1',
          amountCents: 4950,
          currency: 'EUR',
          description: null,
          status: 'paid',
          paidAt: null,
          syncedAt: null
        }
      ])

      const caller = await loadCaller()
      const result = await caller.listTransactions({})

      expect(result.items).toHaveLength(1)
      expect(result.items[0]).toMatchObject({ coverage: 'settled' })
      expect(result.items[0]!.suggestion).toBeNull()
      expect(result.items[0]!.psp?.settlement.externalId).toBe('setl-1')

      // Recognized payouts are excluded from the suggestions-only queue.
      const suggestionsOnly = await caller.listTransactions({
        suggestionsOnly: true
      })
      expect(suggestionsOnly.items).toHaveLength(0)
    }, 30000)

    it('a credit that already carries a bank ref never consumes a settlement', async () => {
      // Mirrors the seeded trap: seed-credit-001 (already linked to an
      // invoice) and seed-credit-006 (the genuine payout) have IDENTICAL
      // amount/date. The linked credit must keep its earned coverage and
      // leave setl-1 for the unreconciled payout.
      const { companyId } = await seedCompany()
      const invoiceA = await seedInvoice(companyId, 1)
      const invoiceB = await seedInvoice(companyId, 2)
      // Invoice A paid by plain bank transfer already coupled to its credit.
      await testDb!
        .insertInto('checkout.payments')
        .values({
          invoiceId: invoiceA.id,
          description: 'bank transfer',
          // Must equal invoiceA's totalIncludingTax (seedInvoice default 5000)
          // so the linked credit earns full coverage.
          amount: 5000,
          currency: 'EUR',
          method: PaymentMethod.banktransfer,
          status: PaymentStatus.PAID,
          transactionReference: 'bank:txn-linked'
        })
        .execute()
      // Invoice B paid ONLINE via Mollie — its payout is still unreconciled.
      await testDb!
        .insertInto('checkout.payments')
        .values({
          invoiceId: invoiceB.id,
          description: 'iDEAL',
          amount: 4950,
          currency: 'EUR',
          method: PaymentMethod.ideal,
          status: PaymentStatus.PAID,
          externalId: 'tr_abc',
          settlementId: 'setl-1',
          paymentServiceProvider: 'mollie'
        })
        .execute()
      fakeClient.getAccounts = vi.fn(async () => [makeAccount()])
      fakeClient.getTransactions = vi.fn(async () => ({
        items: [
          {
            ...makeTransaction(),
            id: 'txn-linked',
            note: 'Factuur 2026-0001'
          },
          {
            ...makeTransaction(),
            amount: '49.50',
            note: null,
            counterpartyName: 'Mollie B.V.'
          }
        ],
        total: 2
      }))
      fakeClient.getPspSettlements = vi.fn<BankingApi['getPspSettlements']>(
        async () => [
          {
            externalId: 'setl-1',
            psp: 'mollie' as const,
            amountCents: 4950,
            feeCents: 50,
            currency: 'EUR',
            payoutDate: '2026-07-02',
            status: 'paidout',
            syncedAt: new Date('2026-07-03T00:00:00Z'),
            metadata: null
          }
        ]
      )
      fakeClient.getPspPayments = vi.fn(async () => [])

      const caller = await loadCaller()
      const result = await caller.listTransactions({})

      expect(result.items).toHaveLength(2)
      const linkedRow = result.items.find(
        (row) => row.transaction.externalId === 'txn-linked'
      )!
      const payoutRow = result.items.find(
        (row) => row.transaction.externalId === 'txn-1'
      )!
      // The linked credit keeps full coverage via its bank ref…
      expect(linkedRow.coverage).toBe('full')
      // …and does NOT steal the settlement from the genuine payout.
      expect(payoutRow.coverage).toBe('settled')
      expect(payoutRow.psp?.settlement.externalId).toBe('setl-1')
    }, 30000)

    it('listTransactions still settles legacy applied rows (bank:<txid> + settlementId)', async () => {
      const { companyId } = await seedCompany()
      const invoice = await seedInvoice(companyId, 1)
      await testDb!
        .insertInto('checkout.payments')
        .values({
          invoiceId: invoice.id,
          description: 'PSP payout (pre-refactor apply)',
          amount: 5000,
          currency: 'EUR',
          method: PaymentMethod.ideal,
          status: PaymentStatus.PAID,
          externalId: 'tr_legacy',
          settlementId: 'setl-legacy',
          paymentServiceProvider: 'mollie',
          transactionReference: 'bank:txn-1'
        })
        .execute()
      fakeClient.getAccounts = vi.fn(async () => [makeAccount()])
      fakeClient.getTransactions = vi.fn(async () => ({
        items: [makeTransaction()],
        total: 1
      }))
      fakeClient.getPspSettlements = vi.fn<BankingApi['getPspSettlements']>(
        async () => [
          {
            externalId: 'setl-legacy',
            psp: 'mollie' as const,
            amountCents: 5000,
            feeCents: 0,
            currency: 'EUR',
            payoutDate: '2026-06-30',
            status: 'paidout',
            syncedAt: new Date('2026-07-01T00:00:00Z'),
            metadata: null
          }
        ]
      )
      fakeClient.getPspPayments = vi.fn(async () => [])

      const caller = await loadCaller()
      const result = await caller.listTransactions({})

      expect(result.items[0]).toMatchObject({ coverage: 'settled' })
      expect(result.items[0]!.psp?.settlement.externalId).toBe('setl-legacy')
    }, 30000)

    it('listTransactions exposes uuid on linkedInvoices', async () => {
      const { companyId } = await seedCompany()
      // Invoice 1 (2026-0001) is fully paid via the bank credit — the engine
      // filters it (amountDue 0). A second open invoice (2026-0002) is an
      // exact strict match, so the engine still proposes a link on a row that
      // is already 'full' — the stale-suggestion data state.
      const linked = await seedInvoice(companyId, 1)
      const openTarget = await seedInvoice(companyId, 2, 5000)
      await testDb!
        .insertInto('checkout.payments')
        .values({
          invoiceId: linked.id,
          description: 'Bank credit 2026-0001',
          amount: 5000,
          currency: 'EUR',
          method: PaymentMethod.banktransfer,
          status: PaymentStatus.PAID,
          transactionReference: 'bank:txn-1'
        })
        .execute()
      fakeClient.getAccounts = vi.fn(async () => [makeAccount()])
      fakeClient.getTransactions = vi.fn(async () => ({
        items: [{ ...makeTransaction(), note: 'Factuur 2026-0002' }],
        total: 1
      }))
      fakeClient.getPspSettlements = vi.fn<BankingApi['getPspSettlements']>(
        async () => []
      )
      fakeClient.getPspPayments = vi.fn(async () => [])

      const caller = await loadCaller()
      const result = await caller.listTransactions({})

      expect(result.enabled).toBe(true)
      expect(result.items).toHaveLength(1)
      const row = result.items[0]!
      expect(row.coverage).toBe('full')
      // The linked invoice carries its uuid + number so the overview can build
      // a drill-down router link.
      expect(row.linkedInvoices).toEqual([
        { id: linked.id, uuid: linked.uuid, number: '2026-0001' }
      ])
      // Stale-suggestion data state: the engine still proposes the open
      // invoice (2026-0002) — the UI must not offer Link on a 'full' row.
      expect(row.suggestion).toMatchObject({ type: 'single' })
      expect(row.suggestion).toMatchObject({
        invoice: { id: openTarget.id, number: '2026-0002' }
      })
    }, 30000)
  }
)
