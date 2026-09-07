import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { CamelCasePlugin, Kysely, PostgresDialect, sql } from 'kysely'
import pg from 'pg'
import type { DB } from '../../../src/kysely/types.js'
import type * as demoData from '../../../src/kysely/seeds/demoData.js'
import type * as fake from '../../../src/kysely/seeds/fake.js'
import type * as testSeed from '../../../src/kysely/seeds/test.js'
import { PaymentMethod } from '@modular-api/fastify-checkout'

// The seed modules transitively import the banking-api package, whose config
// throws at module load without POSTGRES_PASSWORD. Dynamic-import them only
// when the test DB is actually available (same pattern as the banking-api
// unit specs), so `pnpm test` still skips cleanly on machines without it.
let demoCore: typeof demoData.demoCore
let seedFake: typeof fake.seedFake
let seedTest: typeof testSeed.seedTest

const { Pool } = pg
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
    await testDb.selectFrom('companies').select('id').limit(1).execute()
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn(
      `demo-seed.spec: test DB unavailable, skipping: ${String(error)}`
    )
    testDb = null
  }
}

const describeDb = testDb ? describe : describe.skip
if (testDb) {
  process.env.POSTGRES_PASSWORD ??= 'unused-by-url-based-connection'
  ;({ demoCore } = await import('../../../src/kysely/seeds/demoData.js'))
  ;({ seedFake } = await import('../../../src/kysely/seeds/fake.js'))
  ;({ seedTest } = await import('../../../src/kysely/seeds/test.js'))
}

// Destroy the shared pool once, after all describe blocks (the seed:fake and
// seed:test determinism blocks share testDb).
afterAll(async () => {
  if (testDb) await testDb.destroy()
})

const truncate = async () => {
  if (!testDb) return
  await sql`TRUNCATE TABLE companies, clients, number_prefixes, initial_number_for_prefixes,
    accounts, authentication_methods, bank_account_companies,
    "checkout".invoices, "checkout".payments, "checkout".refunds CASCADE`.execute(
    testDb
  )
}

describeDb('demo seed:fake (fixture-driven)', () => {
  beforeAll(async () => {
    await truncate()
    await seedFake()
  })

  afterAll(async () => {
    await truncate()
  })

  it('creates the fixture companies, clients and number prefixes', async () => {
    const companies = await testDb!
      .selectFrom('companies')
      .selectAll()
      .execute()
    expect(companies.length).toBe(demoCore.companies.length)
    const clients = await testDb!.selectFrom('clients').selectAll().execute()
    expect(clients.length).toBe(demoCore.clients.length)
  })

  it('numbered invoices carry the fixture numbers and statuses', async () => {
    const numbered = demoCore.invoices.filter((inv) => inv.number !== null)
    expect(numbered.length).toBeGreaterThan(0)
    for (const inv of numbered) {
      const row = await testDb!
        .selectFrom('checkout.invoices')
        .selectAll()
        .where('numberPrefix', '=', '2026-')
        .where('number', '=', inv.number!)
        .executeTakeFirst()
      expect(row).toBeDefined()
      expect(row!.status).toBe(inv.status)
    }
  })

  it('unnumbered bills/receipts carry no number', async () => {
    const rows = await testDb!
      .selectFrom('checkout.invoices')
      .selectAll()
      .execute()
    expect(rows.length).toBe(demoCore.invoices.length)
    const unnumberedRows = rows.filter((r) => r.number === null)
    const unnumbered = demoCore.invoices.filter((inv) => inv.number === null)
    expect(unnumberedRows.length).toBe(unnumbered.length)
  })

  it('checkout.payments link to the fixture settlement/psp-payment ids', async () => {
    const pspPayments = demoCore.payments.filter(
      (p) => p.externalId !== null && p.settlementId !== null
    )
    expect(pspPayments.length).toBeGreaterThan(0)
    for (const p of pspPayments) {
      const row = await testDb!
        .selectFrom('checkout.payments')
        .selectAll()
        .where('externalId', '=', p.externalId!)
        .executeTakeFirst()
      expect(row).toBeDefined()
      expect(row!.settlementId).toBe(p.settlementId)
      expect(row!.amount).toBe(p.amountCents)
    }
  })

  it('re-running is a no-op (numbers unchanged)', async () => {
    const before = await testDb!
      .selectFrom('checkout.invoices')
      .selectAll()
      .where('numberPrefix', '=', '2026-')
      .orderBy('number')
      .execute()
    await seedFake()
    const after = await testDb!
      .selectFrom('checkout.invoices')
      .selectAll()
      .where('numberPrefix', '=', '2026-')
      .orderBy('number')
      .execute()
    expect(after.map((r) => r.number)).toEqual(before.map((r) => r.number))
    expect(after.length).toBe(before.length)
  })
})

describeDb('demo seed:test determinism', () => {
  const capture = async () => {
    const invoices = await testDb!
      .selectFrom('checkout.invoices')
      .selectAll()
      .where('numberPrefix', '=', '2026-')
      .orderBy('number')
      .execute()
    const payments = await testDb!
      .selectFrom('checkout.payments')
      .selectAll()
      .where('externalId', 'is not', null)
      .orderBy('id')
      .execute()
    return {
      invoiceUuids: invoices.map((i) => i.uuid),
      paymentUuids: payments.map((p) => p.uuid)
    }
  }

  it('produces identical uuids across two fresh runs', async () => {
    await truncate()
    await seedTest()
    const first = await capture()
    await truncate()
    await seedTest()
    const second = await capture()
    expect(second.invoiceUuids).toEqual(first.invoiceUuids)
    expect(second.paymentUuids).toEqual(first.paymentUuids)
    // The pinned scheme: invoice 2026-1 gets the deterministic uuid.
    expect(first.invoiceUuids[0]).toBe('00000000-0000-4000-8000-000000000001')
  })
})

describeDb(
  'demo seed:test multi-candidate adoption fixture (credit-011)',
  () => {
    beforeAll(async () => {
      process.env.API_HOST ??= 'slimfact.test'
      process.env.OTP_SECRET ??= 'test-otp-secret'
      process.env.OIDC_CLIENT_SECRET ??= 'test-client-secret'
      process.env.OIDC_COOKIES_KEYS ??= 'test-cookie-keys'
      process.env.BANKING_API_URL ??= 'http://banking-api'
      delete process.env.BANKING_API_KEY
      await truncate()
      await seedTest()
    })

    const acme = async () =>
      testDb!
        .selectFrom('companies')
        .select('id')
        .where('name', '=', 'Acme Inc')
        .executeTakeFirstOrThrow()

    it('seeds paid €130 invoices 2026-13/14 with manual banktransfer payments', async () => {
      const companyId = (await acme()).id
      const { listCompanyInvoices } =
        await import('../../../src/banking/sync.js')
      const invoices = await listCompanyInvoices(testDb!, companyId)
      const m = invoices.find((inv) => inv.number === '2026-13')
      const n = invoices.find((inv) => inv.number === '2026-14')
      expect(m).toBeDefined()
      expect(n).toBeDefined()
      expect(m!.status).toBe('paid')
      expect(n!.status).toBe('paid')
      expect(m!.amountDueCents).toBe(0)
      expect(n!.amountDueCents).toBe(0)
      // M has no ref; N has the bookkeeper-style day-month ref.
      const payments = await testDb!
        .selectFrom('checkout.payments')
        .select(['invoiceId', 'transactionReference'])
        .where('invoiceId', 'in', [m!.id, n!.id])
        .where('method', '=', PaymentMethod.banktransfer)
        .execute()
      expect(payments.length).toBe(2)
      const nPay = payments.find((p) => p.invoiceId === n!.id)
      expect(nPay?.transactionReference).toBe('29-6')
    })

    it('suggestForCredit adopts N (explicit ref) at 0.98 and scores M at 0.75', async () => {
      const companyId = (await acme()).id
      const { listCompanyInvoices } =
        await import('../../../src/banking/sync.js')
      const { suggestForCredit, scoreInvoiceCandidates } =
        await import('@slimfact/tools/banking/suggest')
      const invoices = await listCompanyInvoices(testDb!, companyId)
      const payments = await testDb!
        .selectFrom('checkout.payments')
        .select([
          'id',
          'invoiceId',
          'transactionReference',
          'amount',
          'method',
          'status',
          'externalId',
          'settlementId',
          'paymentServiceProvider'
        ])
        .where(
          'invoiceId',
          'in',
          invoices.map((inv) => inv.id)
        )
        .execute()

      // Mirror the MatchTransaction the api builds for seed-credit-011.
      const transaction = {
        externalId: 'seed-credit-011',
        accountExternalId: 'knab-acc',
        companyId,
        creditDebit: 'CRDT',
        status: 'BOOK',
        amountCents: 13000,
        currency: 'EUR',
        bookingDate: new Date(Date.now() - 86400000).toISOString().slice(0, 10),
        description: 'FACTUUR 2026-14',
        remittanceInformation: null,
        referenceNumber: null,
        counterpartyName: 'Jane Doe',
        counterpartyIban: null
      } as any

      const suggestion = suggestForCredit({
        transaction,
        invoices,
        payments,
        config: { referenceWindowDays: 14 }
      })
      expect(suggestion).not.toBeNull()
      const n = invoices.find((inv) => inv.number === '2026-14')
      expect(suggestion!.invoiceId).toBe(n!.id)
      expect(suggestion!.score).toBe(0.98)
      expect(suggestion!.evidence.numRefHit).toBe(true)

      // Dialog candidate scores: N 0.98 first, M 0.75 second.
      const candidates = scoreInvoiceCandidates({
        transaction,
        invoices,
        payments
      })
      const m = invoices.find((inv) => inv.number === '2026-13')
      const byId = new Map(candidates.map((c) => [c.invoiceId, c.score]))
      expect(byId.get(n!.id)).toBe(0.98)
      expect(byId.get(m!.id)).toBe(0.75)
      // Sorted descending: N before M.
      const sorted = [...candidates].sort((a, b) => b.score - a.score)
      expect(sorted[0]?.invoiceId).toBe(n!.id)
      expect(sorted[1]?.invoiceId).toBe(m!.id)
    })
  }
)
