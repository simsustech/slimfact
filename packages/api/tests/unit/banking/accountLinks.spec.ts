import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { CamelCasePlugin, Kysely, PostgresDialect, sql } from 'kysely'
import pg from 'pg'
import type { DB } from '../../../src/kysely/types.js'

const { Pool } = pg

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
      `accountLinks.spec: test DB unavailable, skipping: ${String(error)}`
    )
    testDb = null
  }
}

afterAll(async () => {
  if (testDb) await testDb.destroy()
})

// accountLinks.js pulls sync.js → events.js → config, which requires env vars.
// Mirror the sync.spec pattern: set them before the dynamic import.
let resolveCompanyIds: (typeof import('../../../src/banking/accountLinks.js'))['resolveCompanyIds']
let fetchAccountCompanyLinks: (typeof import('../../../src/banking/accountLinks.js'))['fetchAccountCompanyLinks']
let setAccountCompanies: (typeof import('../../../src/banking/accountLinks.js'))['setAccountCompanies']

beforeAll(async () => {
  process.env.API_HOST = 'slimfact.test'
  process.env.OTP_SECRET = 'test-otp-secret'
  process.env.OIDC_CLIENT_SECRET = 'test-client-secret'
  process.env.OIDC_COOKIES_KEYS = 'test-cookie-keys'
  const links = await import('../../../src/banking/accountLinks.js')
  resolveCompanyIds = links.resolveCompanyIds
  fetchAccountCompanyLinks = links.fetchAccountCompanyLinks
  setAccountCompanies = links.setAccountCompanies
})

const mkAccount = (
  overrides: Partial<{ id: string; iban: string | null }> = {}
): { id: string; iban: string | null } => ({
  id: 'acc-1',
  iban: 'NL00TEST0123456789',
  ...overrides
})

describe('resolveCompanyIds (pure)', () => {
  it('prefers the explicit link over a different IBAN match', () => {
    const links = new Map([['acc-1', [7]]])
    const ibans = new Map([['NL00TEST0123456789', 3]])
    expect(resolveCompanyIds(links, ibans, mkAccount())).toEqual([7])
  })

  it('falls back to the IBAN company when there is no link', () => {
    const links = new Map<string, number[]>()
    const ibans = new Map([['NL00TEST0123456789', 3]])
    expect(resolveCompanyIds(links, ibans, mkAccount())).toEqual([3])
  })

  it('returns every linked company (many-to-many)', () => {
    const links = new Map([['acc-1', [7, 8]]])
    const ibans = new Map<string, number>()
    expect(resolveCompanyIds(links, ibans, mkAccount())).toEqual([7, 8])
  })

  it('returns [] when neither a link nor an IBAN match exists', () => {
    const links = new Map<string, number[]>()
    const ibans = new Map<string, number>()
    expect(resolveCompanyIds(links, ibans, mkAccount())).toEqual([])
  })

  it('returns [] for an account without an IBAN and no link', () => {
    const links = new Map<string, number[]>()
    const ibans = new Map<string, number>()
    expect(resolveCompanyIds(links, ibans, mkAccount({ iban: null }))).toEqual(
      []
    )
  })
})

const insertCompany = async (db: Kysely<DB>, name: string): Promise<number> => {
  const { id } = await db
    .insertInto('companies')
    .values({
      prefix: name.slice(0, 2).toUpperCase(),
      name,
      address: 'Straat 1',
      postalCode: '1234AB',
      city: 'Amsterdam',
      country: 'NL',
      email: `${name.toLowerCase()}@test.nl`,
      cocNumber: '12345678',
      vatIdNumber: 'NL123456789B01',
      iban: name === 'Eerste' ? 'NL00TEST0123456789' : 'NL00TEST9876543210',
      bic: 'TESTNL2A'
    })
    .returning('id')
    .executeTakeFirstOrThrow()
  return id
}

const describeDb = testDb ? describe : describe.skip

describeDb('bank_account_companies (DB-backed)', () => {
  beforeEach(async () => {
    if (!testDb) return
    await sql`TRUNCATE TABLE companies, bank_account_companies CASCADE`.execute(
      testDb
    )
  })

  it('round-trips setAccountCompanies + fetchAccountCompanyLinks', async () => {
    if (!testDb) return
    const first = await insertCompany(testDb!, 'Eerste')
    const second = await insertCompany(testDb!, 'Tweede')
    await setAccountCompanies(testDb!, 'acc-1', [first, second])
    await setAccountCompanies(testDb!, 'acc-2', [second])
    const links = await fetchAccountCompanyLinks(testDb!)
    expect(links.get('acc-1')).toEqual([first, second])
    expect(links.get('acc-2')).toEqual([second])
  })

  it('clearing the link set removes every row (IBAN fallback resumes)', async () => {
    if (!testDb) return
    const first = await insertCompany(testDb!, 'Eerste')
    await setAccountCompanies(testDb!, 'acc-1', [first])
    await setAccountCompanies(testDb!, 'acc-1', [])
    const links = await fetchAccountCompanyLinks(testDb!)
    expect(links.get('acc-1')).toBeUndefined()
  })

  it('replacing the set drops stale links', async () => {
    if (!testDb) return
    const first = await insertCompany(testDb!, 'Eerste')
    const second = await insertCompany(testDb!, 'Tweede')
    await setAccountCompanies(testDb!, 'acc-1', [first, second])
    await setAccountCompanies(testDb!, 'acc-1', [second])
    const links = await fetchAccountCompanyLinks(testDb!)
    expect(links.get('acc-1')).toEqual([second])
  })
})
