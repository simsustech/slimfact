import { TRPCError } from '@trpc/server'
import { t } from '../index.js'
import * as z from 'zod'
import type { FastifyInstance } from 'fastify'
import { InvoiceStatus, PaymentMethod } from '@modular-api/fastify-checkout'
import env from '@vitrify/tools/env'

const host = env.read('API_HOST') || env.read('VITE_API_HOST')
const redirectUrl = `https://${host}/checkout/success`

const createPayment = async (
  fastify: FastifyInstance,
  uuid: string,
  method: PaymentMethod,
  amount?: number
) => {
  if (!fastify.checkout?.invoiceHandler) {
    throw new TRPCError({ code: 'BAD_REQUEST' })
  }

  const invoice = await fastify.checkout.invoiceHandler.getInvoice({
    uuid,
    options: { withAmountDue: true }
  })

  if (
    !invoice ||
    (invoice.status !== InvoiceStatus.OPEN &&
      invoice.status !== InvoiceStatus.BILL)
  ) {
    throw new TRPCError({ code: 'BAD_REQUEST' })
  }

  const paymentResult =
    await fastify.checkout.invoiceHandler.addPaymentToInvoice({
      uuid,
      payment: {
        amount: amount ?? (invoice.amountDue || invoice.totalIncludingTax),
        currency: invoice.currency,
        description: invoice.number
          ? `${invoice.numberPrefix}${invoice.number}`
          : invoice.uuid,
        method,
        invoiceId: invoice.id,
        redirectUrl
      }
    })

  if (!paymentResult.success) {
    fastify.log.error(paymentResult.errorMessage)
    throw new TRPCError({ code: 'BAD_REQUEST' })
  }

  return paymentResult.checkoutUrl
}

export const publicInvoiceRoutes = ({
  fastify,
  procedure
}: {
  fastify: FastifyInstance
  procedure: typeof t.procedure
}) => ({
  getInvoice: procedure
    .input(
      z.object({
        uuid: z.string()
      })
    )
    .query(async ({ input }) => {
      if (fastify.checkout?.invoiceHandler) {
        const { uuid } = input
        const invoice = await fastify.checkout.invoiceHandler.getInvoice({
          uuid,
          options: {
            withAmountPaid: true,
            withAmountDue: true,
            withAmountRefunded: true
          }
        })
        if (
          invoice?.status &&
          ![InvoiceStatus.CANCELED].includes(invoice.status)
        )
          return invoice
      }
      throw new TRPCError({
        code: 'BAD_REQUEST'
      })
    }),
  // downloadInvoicePdf: procedure
  //   .input(z.object({ uuid: z.string() }))
  //   .query(async ({ input, ctx }) => {
  //     const { uuid } = input
  //     const stream = await fastify.checkout.invoiceHandler.downloadInvoicePdf({
  //       uuid
  //     })
  //     return stream
  //   }),
  sendInvoice: procedure
    .input(z.object({ uuid: z.string() }))
    .mutation(async ({ input }) => {
      const { uuid } = input
      if (fastify.checkout?.invoiceHandler) {
        await fastify.checkout.invoiceHandler.setInvoiceStatus({
          id: uuid,
          status: InvoiceStatus.OPEN
        })
      }
    }),

  payWithIdeal: procedure
    .input(z.object({ uuid: z.string() }))
    .mutation(async ({ input }) => {
      try {
        return await createPayment(fastify, input.uuid, PaymentMethod.ideal)
      } catch (e) {
        fastify.log.error(e)
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: e as string
        })
      }
    }),

  payWithCreditcard: procedure
    .input(z.object({ uuid: z.string() }))
    .mutation(async ({ input }) => {
      try {
        return await createPayment(
          fastify,
          input.uuid,
          PaymentMethod.creditcard
        )
      } catch (e) {
        fastify.log.error(e)
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: e as string
        })
      }
    }),

  payDownPaymentWithIdeal: procedure
    .input(z.object({ uuid: z.string() }))
    .mutation(async ({ input }) => {
      try {
        const invoice = await fastify.checkout?.invoiceHandler?.getInvoice({
          uuid: input.uuid,
          options: { withAmountDue: true }
        })

        if (
          !invoice ||
          !invoice.requiredDownPaymentAmount ||
          invoice.requiredDownPaymentAmount <= (invoice.amountPaid || 0)
        ) {
          throw new TRPCError({ code: 'BAD_REQUEST' })
        }

        return await createPayment(
          fastify,
          input.uuid,
          PaymentMethod.ideal,
          invoice.requiredDownPaymentAmount
        )
      } catch (e) {
        fastify.log.error(e)
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: e as string
        })
      }
    })
})
