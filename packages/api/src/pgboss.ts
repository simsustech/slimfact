import PgBoss, { Job } from 'pg-boss'
import { db, postgresConnectionString } from '../src/kysely/index.js'
import { InvoiceStatus, RawNewInvoice } from '@modular-api/fastify-checkout'
import { FastifyInstance } from 'fastify'

let boss: PgBoss
export const initialize = async ({ fastify }: { fastify: FastifyInstance }) => {
  boss = new PgBoss(postgresConnectionString)

  async function subscriptionWorker(
    job: Job<RawNewInvoice> | Job<RawNewInvoice>[]
  ) {
    if (!Array.isArray(job)) job = [job]

    console.log(job)
    for (const singleJob of job) {
      const result = await fastify?.checkout?.invoiceHandler?.createInvoice(
        singleJob.data
      )
      console.log(result)
    }
    return true
  }

  await boss.work(
    'subscription:*',
    { batchSize: 1, includeMetadata: true },
    subscriptionWorker
  )

  return boss
}

export const startSubscription = async (id: number) => {
  const subscription = await db
    .selectFrom('subscriptions')
    .where('id', '=', id)
    .selectAll()
    .executeTakeFirstOrThrow()

  const companyDetails = await db
    .selectFrom('companies')
    .where('id', '=', subscription.companyId)
    .selectAll()
    .executeTakeFirstOrThrow()

  const clientDetails = await db
    .selectFrom('clients')
    .where('id', '=', subscription.clientId)
    .selectAll()
    .executeTakeFirstOrThrow()

  console.log(subscription)
  const invoice: RawNewInvoice = {
    companyDetails,
    clientDetails,
    companyPrefix: companyDetails.prefix,
    numberPrefixTemplate: subscription.numberPrefixTemplate,
    currency: subscription.currency,
    lines: subscription.lines,
    discounts: subscription.discounts,
    surcharges: subscription.surcharges,
    paymentTermDays: subscription.paymentTermDays,
    locale: subscription.locale,
    companyId: companyDetails.id,
    clientId: clientDetails.id,
    status: subscription.type === 'bill' ? InvoiceStatus.BILL : undefined
  }
  console.log(invoice)

  await boss.schedule(
    `subscription:${subscription.uuid}`,
    subscription.cronSchedule,
    invoice,
    {}
  )
}

export const stopSubscription = async (id: number) => {
  const subscription = await db
    .selectFrom('subscriptions')
    .where('id', '=', id)
    .select('uuid')
    .executeTakeFirstOrThrow()

  await boss.unschedule(`subscription:${subscription.uuid}`)
}
