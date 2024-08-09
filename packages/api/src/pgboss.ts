import PgBoss, { Job } from 'pg-boss'
import { db, postgresConnectionString } from '../src/kysely/index.js'
import { InvoiceStatus, RawNewInvoice } from '@modular-api/fastify-checkout'
import { FastifyInstance } from 'fastify'
import { RefundStatus } from '@modular-api/fastify-checkout/types'

let boss: PgBoss
const createSubscriptionWorker = ({ fastify }: { fastify: FastifyInstance }) =>
  async function subscriptionWorker(
    job: Job<RawNewInvoice> | Job<RawNewInvoice>[]
  ) {
    if (!Array.isArray(job)) job = [job]

    for (const singleJob of job) {
      await fastify?.checkout?.invoiceHandler?.createInvoice(singleJob.data)
    }
    return true
  }

const createRefundWorker = ({ fastify }: { fastify: FastifyInstance }) =>
  async function refundWorker() {
    const refunds = await db
      .selectFrom('checkout.refunds')
      .where((web) =>
        web.or([
          web('status', '=', RefundStatus.PENDING),
          web('status', '=', RefundStatus.PROCESSING),
          web('status', '=', RefundStatus.QUEUED)
        ])
      )
      .select('id')
      .execute()

    for (const refund of refunds) {
      await fastify.checkout?.paymentHandlers?.mollie?.getRefund({
        id: refund.id
      })
    }
  }

export const initialize = async ({ fastify }: { fastify: FastifyInstance }) => {
  boss = new PgBoss(postgresConnectionString)

  await boss.start()

  const subscriptionWorker = createSubscriptionWorker({ fastify })

  const schedules = await boss.getSchedules()

  schedules
    .filter((schedule) => schedule.name.includes('subscription:'))
    .forEach(async (schedule) => {
      await boss.work(
        schedule.name,
        { batchSize: 1, includeMetadata: true },
        subscriptionWorker
      )
    })

  const refundWorker = createRefundWorker({ fastify })
  await boss.work(
    'checkRefunds',
    { batchSize: 1, includeMetadata: true },
    refundWorker
  )
  if (!schedules.some((schedule) => schedule.name === 'checkRefunds')) {
    const queueName = `checkRefunds`

    if (!(await boss.getQueue(queueName))) {
      await boss.createQueue(queueName)
    }
    await boss.schedule(queueName, '0 0 * * *', {}, {})
  }
  // await boss.work(
  //   'subscription:*',
  //   { batchSize: 1, includeMetadata: true },
  //   subscriptionWorker
  // )

  return boss
}

export const startSubscription = async ({
  id,
  fastify
}: {
  id: number
  fastify: FastifyInstance
}) => {
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
  const queueName = `subscription:${subscription.uuid}`

  if (!(await boss.getQueue(queueName))) {
    await boss.createQueue(queueName)
  }
  const subscriptionWorker = createSubscriptionWorker({ fastify })

  await boss.work(
    queueName,
    { batchSize: 1, includeMetadata: true },
    subscriptionWorker
  )
  await boss.schedule(queueName, subscription.cronSchedule, invoice, {})
}

export const stopSubscription = async (id: number) => {
  const subscription = await db
    .selectFrom('subscriptions')
    .where('id', '=', id)
    .select('uuid')
    .executeTakeFirstOrThrow()

  const queueName = `subscription:${subscription.uuid}`

  await boss.unschedule(queueName)
}
