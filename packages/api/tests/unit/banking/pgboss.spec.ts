import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type MockInstance
} from 'vitest'
import type { PgBoss } from 'pg-boss'

const DEFAULT_CRON = '*/15 7-23 * * *'

const setRequiredEnv = () => {
  // env.ts + config/postgres.ts require several base vars at module load.
  process.env.API_HOST = 'slimfact.test'
  process.env.OTP_SECRET = 'test-otp-secret'
  process.env.OIDC_CLIENT_SECRET = 'test-client-secret'
  process.env.OIDC_COOKIES_KEYS = 'test-cookie-keys'
  process.env.POSTGRES_PASSWORD = 'test'
  process.env.POSTGRES_DB = 'slimfact'
}

const makeFakeBoss = () => ({
  start: vi.fn().mockResolvedValue(undefined),
  getSchedules: vi.fn().mockResolvedValue([]),
  getQueue: vi.fn().mockResolvedValue(false),
  createQueue: vi.fn().mockResolvedValue(undefined),
  schedule: vi.fn().mockResolvedValue(undefined),
  work: vi.fn().mockResolvedValue(undefined),
  unschedule: vi.fn().mockResolvedValue(undefined),
  stop: vi.fn().mockResolvedValue(undefined)
})

// kysely/index.ts calls `Object.defineProperty(BigInt.prototype, 'toJSON', …)`
// at module load. After vi.resetModules() the second test re-evaluates kysely
// and that throws "Cannot redefine property: toJSON" because the property is
// non-configurable. Swallow that single redefinition: the property is already
// installed correctly.
let originalDefineProperty: typeof Object.defineProperty
let definePropertySpy: MockInstance

describe('pgboss initialize — open-banking registration', () => {
  const envBackup = { ...process.env }

  beforeEach(() => {
    originalDefineProperty = Object.defineProperty
    definePropertySpy = vi
      .spyOn(Object, 'defineProperty')
      .mockImplementation(
        (
          target: unknown,
          prop: PropertyKey,
          descriptor?: PropertyDescriptor & ThisType<unknown>
        ): unknown => {
          if (target === BigInt.prototype && prop === 'toJSON') {
            return target
          }
          return originalDefineProperty.call(
            Object,
            target as object,
            prop as PropertyKey,
            descriptor as PropertyDescriptor
          )
        }
      )

    vi.resetModules()
    vi.doMock('../../../src/kysely/index.js', () => ({
      db: {} as never,
      postgresConnectionString: 'postgres://test/test'
    }))
  })

  afterEach(() => {
    definePropertySpy.mockRestore()
    Object.defineProperty = originalDefineProperty
    vi.resetModules()
    process.env = { ...envBackup }
  })

  it('registers processBankSync queue + schedule + worker when banking is configured', async () => {
    setRequiredEnv()
    // bankingEnabled() requires key AND url (a key without a URL would start
    // a cron worker that can never reach the proxy).
    process.env.BANKING_API_KEY = 'obk_test_xxx'
    process.env.BANKING_API_URL = 'http://banking-api'
    const { initialize } = await import('../../../src/pgboss.js')
    const boss = makeFakeBoss()
    await initialize({ fastify: {} as never, boss: boss as unknown as PgBoss })

    expect(boss.getQueue).toHaveBeenCalledWith('processBankSync')
    expect(boss.createQueue).toHaveBeenCalledWith('processBankSync')
    expect(boss.schedule).toHaveBeenCalledWith(
      'processBankSync',
      DEFAULT_CRON,
      {},
      {}
    )
    expect(boss.work).toHaveBeenCalledWith(
      'processBankSync',
      { batchSize: 1, includeMetadata: true },
      expect.any(Function)
    )
  }, 15000)

  it('skips processBankSync entirely when banking is not configured', async () => {
    setRequiredEnv()
    delete process.env.BANKING_API_KEY
    const { initialize } = await import('../../../src/pgboss.js')
    const boss = makeFakeBoss()
    await initialize({ fastify: {} as never, boss: boss as unknown as PgBoss })

    expect(boss.getQueue).not.toHaveBeenCalledWith('processBankSync')
    expect(boss.createQueue).not.toHaveBeenCalledWith('processBankSync')
    expect(boss.schedule).not.toHaveBeenCalledWith('processBankSync')
    expect(boss.work).not.toHaveBeenCalledWith('processBankSync')
  })
})
