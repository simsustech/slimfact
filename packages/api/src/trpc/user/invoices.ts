import { z } from 'zod'
import { t } from '../index.js'
import type { FastifyInstance } from 'fastify'
import { findClient } from 'src/repositories/client.js'
import { InvoiceStatus } from '@modular-api/fastify-checkout'

const paginationSchema = z
  .object({
    limit: z.number(),
    offset: z.number(),
    sortBy: z.union([
      z.literal('id'),
      z.literal('totalIncludingTax'),
      z.literal('createdAt')
    ]),
    descending: z.boolean()
  })
  .optional()

export const userInvoiceRoutes = ({
  fastify,
  procedure
}: {
  fastify: FastifyInstance
  procedure: typeof t.procedure
}) => ({
  getInvoices: procedure
    .input(
      z
        .object({
          pagination: paginationSchema
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      if (fastify.checkout?.invoiceHandler) {
        const accountId = Number(ctx.account?.id)
        const client = await findClient({
          criteria: {
            accountId
          }
        })
        if (client?.id) {
          const { pagination } = input || {}
          const invoices = await fastify.checkout.invoiceHandler.getInvoices({
            statuses: [InvoiceStatus.OPEN, InvoiceStatus.PAID],
            clientId: client.id,
            pagination,
            options: {
              withPayments: true,
              withAmountPaid: true,
              withAmountDue: true,
              withRefunds: true,
              withAmountRefunded: true
            }
          })
          return invoices
        }
      }
      return []
    }),
  getReceipts: procedure
    .input(
      z
        .object({
          pagination: paginationSchema
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      if (fastify.checkout?.invoiceHandler) {
        const accountId = Number(ctx.account?.id)
        const client = await findClient({
          criteria: {
            accountId
          }
        })
        if (client?.id) {
          const { pagination } = input || {}
          const invoices = await fastify.checkout.invoiceHandler.getInvoices({
            clientId: client.id,
            status: InvoiceStatus.RECEIPT,
            pagination,
            options: {
              withPayments: true,
              withAmountPaid: true,
              withAmountDue: true,
              withRefunds: true,
              withAmountRefunded: true
            }
          })
          return invoices
        }
      }
      return []
    }),
  getBills: procedure
    .input(
      z
        .object({
          pagination: paginationSchema
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      if (fastify.checkout?.invoiceHandler) {
        const accountId = Number(ctx.account?.id)
        const client = await findClient({
          criteria: {
            accountId
          }
        })
        if (client?.id) {
          const { pagination } = input || {}
          const invoices = await fastify.checkout.invoiceHandler.getInvoices({
            clientId: client.id,
            status: InvoiceStatus.BILL,
            pagination,
            options: {
              withPayments: true,
              withAmountPaid: true,
              withAmountDue: true,
              withRefunds: true,
              withAmountRefunded: true
            }
          })
          return invoices
        }
      }
      return []
    })
})
