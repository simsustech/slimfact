import { TRPCError } from '@trpc/server'
import { t } from '../index.js'
import * as z from 'zod'
import type { FastifyInstance } from 'fastify'
import { InvoiceStatus, PaymentMethod } from '@modular-api/fastify-checkout'
import env from '@vitrify/tools/env'

const host = env.read('API_HOST') || env.read('VITE_API_HOST')
const redirectUrl = `https://${host}/checkout/success`

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
  //     if (fastify.checkout?.invoiceHandler) {
  //       const { uuid } = input
  //       const invoice = await fastify.checkout.invoiceHandler.getInvoice({
  //         uuid
  //       })
  //       if (invoice) {
  //         const pdfResult = downloadPdf(invoice)
  //       }
  //     }
  //     throw new TRPCError({
  //       code: 'BAD_REQUEST'
  //     })
  //   }),
  payWithIdeal: procedure
    .input(z.object({ uuid: z.string() }))
    .mutation(async ({ input }) => {
      if (fastify.checkout?.invoiceHandler) {
        const { uuid } = input
        const invoice = await fastify.checkout.invoiceHandler.getInvoice({
          uuid,
          options: {
            withAmountDue: true
          }
        })
        if (
          invoice?.status === InvoiceStatus.OPEN ||
          invoice?.status === InvoiceStatus.BILL
        ) {
          if (fastify.checkout.paymentHandlers?.mollie) {
            try {
              const paymentResult =
                await fastify.checkout.invoiceHandler.addPaymentToInvoice({
                  uuid,
                  payment: {
                    amount: invoice.amountDue
                      ? invoice.amountDue
                      : invoice.totalIncludingTax,
                    currency: invoice.currency,
                    description: invoice.number
                      ? `${invoice.numberPrefix}${invoice.number}`
                      : invoice.uuid,
                    method: PaymentMethod.ideal,
                    invoiceId: invoice.id,
                    redirectUrl
                  }
                })
              if (paymentResult.success) {
                return paymentResult.checkoutUrl
              } else {
                fastify.log.error(paymentResult.errorMessage)
              }
            } catch (e) {
              fastify.log.error(e)
              throw new TRPCError({
                code: 'BAD_REQUEST',
                message: e as string
              })
            }
          }
        }
      }
      throw new TRPCError({
        code: 'BAD_REQUEST'
      })
    }),
  payDownPaymentWithIdeal: procedure
    .input(z.object({ uuid: z.string() }))
    .mutation(async ({ input }) => {
      if (fastify.checkout?.invoiceHandler) {
        const { uuid } = input
        const invoice = await fastify.checkout.invoiceHandler.getInvoice({
          uuid,
          options: {
            withAmountPaid: true,
            withAmountDue: true
          }
        })
        if (
          (invoice?.status === InvoiceStatus.OPEN ||
            invoice?.status === InvoiceStatus.BILL) &&
          invoice.requiredDownPaymentAmount &&
          invoice.requiredDownPaymentAmount > (invoice.amountPaid || 0)
        ) {
          if (fastify.checkout.paymentHandlers?.mollie) {
            try {
              const paymentResult =
                await fastify.checkout.invoiceHandler.addPaymentToInvoice({
                  uuid,
                  payment: {
                    amount:
                      invoice.requiredDownPaymentAmount -
                      (invoice.amountPaid || 0),
                    currency: invoice.currency,
                    description: invoice.number
                      ? `${invoice.numberPrefix}${invoice.number}`
                      : invoice.uuid,
                    method: PaymentMethod.ideal,
                    invoiceId: invoice.id,
                    redirectUrl
                  }
                })
              if (paymentResult.success) {
                return paymentResult.checkoutUrl
              } else {
                fastify.log.error(paymentResult.errorMessage)
              }
            } catch (e) {
              fastify.log.error(e)
              throw new TRPCError({
                code: 'BAD_REQUEST',
                message: e as string
              })
            }
          }
        }
      }
      throw new TRPCError({
        code: 'BAD_REQUEST'
      })
    }),
  payWithSmartpin: procedure
    .input(z.object({ uuid: z.string() }))
    .mutation(async ({ input }) => {
      if (fastify.checkout?.invoiceHandler) {
        const { uuid } = input
        const invoice = await fastify.checkout.invoiceHandler.getInvoice({
          uuid,
          options: {
            withAmountDue: true
          }
        })

        if (
          invoice?.status === InvoiceStatus.OPEN ||
          invoice?.status === InvoiceStatus.BILL
        ) {
          if (fastify.checkout.paymentHandlers?.smartpin) {
            try {
              const paymentResult =
                await fastify.checkout.invoiceHandler.addPaymentToInvoice({
                  uuid,
                  payment: {
                    amount: invoice.amountDue
                      ? invoice.amountDue
                      : invoice.totalIncludingTax,
                    currency: invoice.currency,
                    description: invoice.number
                      ? `${invoice.numberPrefix}${invoice.number}`
                      : invoice.uuid,
                    method: PaymentMethod.smartpin,
                    invoiceId: invoice.id
                  }
                })
              if (paymentResult.success) {
                return paymentResult.checkoutUrl
              } else {
                fastify.log.error(paymentResult.errorMessage)
              }
            } catch (e) {
              fastify.log.error(e)
              throw new TRPCError({
                code: 'BAD_REQUEST',
                message: e as string
              })
            }
          }
        }
      }
      throw new TRPCError({
        code: 'BAD_REQUEST'
      })
    })
})
