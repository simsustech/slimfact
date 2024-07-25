import PgBoss, { Job } from 'pg-boss'
import { db, postgresConnectionString } from '../src/kysely/index.js'
import { InvoiceStatus, RawNewInvoice } from '@modular-api/fastify-checkout'
import { FastifyInstance } from 'fastify'

const queueName = `subscriptions`

let boss: PgBoss
export const initialize = async ({ fastify }: { fastify: FastifyInstance }) => {
  boss = new PgBoss(postgresConnectionString)

  async function subscriptionWorker(
    job: Job<RawNewInvoice> | Job<RawNewInvoice>[]
  ) {
    if (!Array.isArray(job)) job = [job]

    for (const singleJob of job) {
      await fastify?.checkout?.invoiceHandler?.createInvoice(singleJob.data)
    }
    return true
  }

  await boss.work(
    queueName,
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

  if (!(await boss.getQueue(queueName))) {
    await boss.createQueue(queueName)
  }
  await boss.schedule(queueName, subscription.cronSchedule, invoice, {})
}

export const stopSubscription = async (id: number) => {
  await db
    .selectFrom('subscriptions')
    .where('id', '=', id)
    .select('uuid')
    .executeTakeFirstOrThrow()

  await boss.unschedule(queueName)
}
