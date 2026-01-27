import { PgBoss, Job } from 'pg-boss'
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
      .innerJoin(
        'checkout.payments',
        'checkout.payments.id',
        'checkout.refunds.paymentId'
      )
      .innerJoin(
        'checkout.invoices',
        'checkout.invoices.id',
        'checkout.payments.invoiceId'
      )
      .where((web) =>
        web.or([
          web('checkout.refunds.status', '=', RefundStatus.PENDING),
          web('checkout.refunds.status', '=', RefundStatus.PROCESSING),
          web('checkout.refunds.status', '=', RefundStatus.QUEUED)
        ])
      )
      .where('checkout.refunds.paymentServiceProvider', '=', 'mollie')
      .select((seb) => [
        'checkout.refunds.id',
        seb
          .ref('checkout.invoices.companyDetails', '->>')
          .key('prefix')
          .as('companyPrefix')
      ])
      .execute()

    for (const refund of refunds) {
      if (fastify.checkout?.paymentHandlers?.mollie) {
        await fastify.checkout.paymentHandlers
          .mollie(refund.companyPrefix)
          .getRefund({
            id: refund.id
          })
      }
    }
  }

export const initialize = async ({ fastify }: { fastify: FastifyInstance }) => {
  // https://github.com/timgit/pg-boss/issues/590
  boss = new PgBoss({
    connectionString: postgresConnectionString,
    schema: 'pgboss_v11'
  })

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

  if (!schedules.some((schedule) => schedule.name === 'checkRefunds')) {
    const queueName = `checkRefunds`

    if (!(await boss.getQueue(queueName))) {
      await boss.createQueue(queueName)
    }
    await boss.schedule(queueName, '0 0 * * *', {}, {})
  }
  const refundWorker = createRefundWorker({ fastify })
  await boss.work(
    'checkRefunds',
    { batchSize: 1, includeMetadata: true },
    refundWorker
  )
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
