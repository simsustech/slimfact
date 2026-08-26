import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { CamelCasePlugin, Kysely, PostgresDialect } from 'kysely'
import pg from 'pg'
import type { OnInvoicePaidArgs } from '@modular-api/fastify-checkout'
import { sendInvoicePaidNotification } from '../../../src/notifications/invoicePaid.js'
import type { DB } from '../../../src/kysely/types.js'

const { Pool } = pg

pg.types.setTypeParser(1700, (value: string) => parseFloat(value))
pg.types.setTypeParser(1114, (value: string) => value)
pg.types.setTypeParser(1082, (value: string) => value)

type Mailer = {
  sendMail: (opts: {
    to: string
    subject: string
    html: string
  }) => Promise<unknown>
}

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
      `invoicePaidNotification.spec: test DB unavailable, skipping: ${String(error)}`
    )
    testDb = null
  }
}

if (testDb) {
  afterAll(async () => {
    await testDb!.destroy()
  })
}

const describeDb = testDb ? describe : describe.skip

const paidArgs = (
  email: string,
  overrides: { locale?: string } = {}
): OnInvoicePaidArgs =>
  ({
    invoice: {
      numberPrefix: '2026-000',
      number: 12,
      locale: overrides.locale ?? 'en-US',
      currency: 'EUR',
      totalIncludingTax: 12100,
      uuid: 'test-uuid',
      companyDetails: { name: 'Acme BV', email },
      clientDetails: { companyName: 'Client BV', email: 'client@x.local' }
    },
    previousStatus: 'open'
  }) as unknown as OnInvoicePaidArgs

describeDb('sendInvoicePaidNotification recipient resolution', () => {
  it('uses ADMIN_NOTIFICATION_EMAIL over companyDetails.email', async () => {
    const sendMail = vi.fn<(opts: { to: string }) => Promise<void>>(
      async () => {}
    )
    await sendInvoicePaidNotification(paidArgs('company@x.local'), {
      logger: { warn: vi.fn(), info: vi.fn() },
      mailer: { sendMail },
      adminNotificationEmail: 'admin@notify.local',
      host: 'slimfact.test'
    })
    expect(sendMail).toHaveBeenCalledTimes(1)
    expect(vi.mocked(sendMail).mock.calls[0]![0]!.to).toBe('admin@notify.local')
  })

  it('falls back to companyDetails.email when no env address is set', async () => {
    const sendMail = vi.fn<(opts: { to: string }) => Promise<void>>(
      async () => {}
    )
    await sendInvoicePaidNotification(paidArgs('company@x.local'), {
      logger: { warn: vi.fn(), info: vi.fn() },
      mailer: { sendMail },
      adminNotificationEmail: undefined,
      host: 'slimfact.test'
    })
    expect(sendMail).toHaveBeenCalledTimes(1)
    expect(vi.mocked(sendMail).mock.calls[0]![0]!.to).toBe('company@x.local')
  })

  it('skips with exactly one warning when no recipient can be resolved', async () => {
    const sendMail = vi.fn<(opts: { to: string }) => Promise<void>>(
      async () => {}
    )
    const warn = vi.fn()
    await sendInvoicePaidNotification(paidArgs(''), {
      logger: { warn, info: vi.fn() },
      mailer: { sendMail },
      adminNotificationEmail: undefined,
      host: 'slimfact.test'
    })
    expect(sendMail).not.toHaveBeenCalled()
    expect(warn).toHaveBeenCalledTimes(1)
  })

  it('skips with exactly one warning when the mailer is not configured', async () => {
    const warn = vi.fn()
    await sendInvoicePaidNotification(paidArgs('company@x.local'), {
      logger: { warn, info: vi.fn() },
      mailer: undefined,
      adminNotificationEmail: 'admin@notify.local',
      host: 'slimfact.test'
    })
    expect(warn).toHaveBeenCalledTimes(1)
  })
})

describeDb('invoice-paid email rendering (real template glob)', () => {
  const sent: Array<{ to: string; subject: string; html: string }> = []
  let sendMail: ReturnType<typeof vi.fn>

  beforeAll(() => {
    sendMail = vi.fn(
      async (opts: { to: string; subject: string; html: string }) => {
        sent.push(opts)
      }
    )
  })

  it('renders en-US subject with compiled number and price', async () => {
    await sendInvoicePaidNotification(paidArgs('company@x.local'), {
      logger: { warn: vi.fn(), info: vi.fn() },
      mailer: { sendMail } as unknown as Mailer,
      adminNotificationEmail: 'admin@notify.local',
      host: 'slimfact.test'
    })
    expect(sent[0]!.subject).toBe('Invoice 2026-00012 paid · €121.00')
    expect(sent[0]!.html).toContain('Client BV')
    expect(sent[0]!.html).toContain('/invoice/test-uuid')
  })

  it('renders nl-NL and de-DE variants by invoice locale', async () => {
    await sendInvoicePaidNotification(
      paidArgs('company@x.local', { locale: 'nl-NL' }),
      {
        logger: { warn: vi.fn(), info: vi.fn() },
        mailer: { sendMail } as unknown as Mailer,
        adminNotificationEmail: 'admin@notify.local',
        host: 'slimfact.test'
      }
    )
    expect(sent[1]!.subject).toContain('betaald')

    await sendInvoicePaidNotification(
      paidArgs('company@x.local', { locale: 'de-DE' }),
      {
        logger: { warn: vi.fn(), info: vi.fn() },
        mailer: { sendMail } as unknown as Mailer,
        adminNotificationEmail: 'admin@notify.local',
        host: 'slimfact.test'
      }
    )
    expect(sent[2]!.subject).toContain('bezahlt')
  })
})
