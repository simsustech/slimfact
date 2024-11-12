import { t } from '../index.js'
import type { FastifyInstance } from 'fastify'
import { findClient } from 'src/repositories/client.js'
import { InvoiceStatus } from '@modular-api/fastify-checkout'

export const userInvoiceRoutes = ({
  fastify,
  procedure
}: {
  fastify: FastifyInstance
  procedure: typeof t.procedure
}) => ({
  getInvoices: procedure.query(async ({ ctx }) => {
    if (fastify.checkout?.invoiceHandler) {
      const accountId = Number(ctx.account?.id)
      const client = await findClient({
        criteria: {
          accountId
        }
      })
      if (client?.id) {
        const invoices = await fastify.checkout.invoiceHandler.getInvoices({
          statuses: [InvoiceStatus.OPEN, InvoiceStatus.PAID],
          clientId: client.id,
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
  getReceipts: procedure.query(async ({ ctx }) => {
    if (fastify.checkout?.invoiceHandler) {
      const accountId = Number(ctx.account?.id)
      const client = await findClient({
        criteria: {
          accountId
        }
      })
      if (client?.id) {
        const invoices = await fastify.checkout.invoiceHandler.getInvoices({
          clientId: client.id,
          status: InvoiceStatus.RECEIPT,
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
  getBills: procedure.query(async ({ ctx }) => {
    if (fastify.checkout?.invoiceHandler) {
      const accountId = Number(ctx.account?.id)
      const client = await findClient({
        criteria: {
          accountId
        }
      })
      if (client?.id) {
        const invoices = await fastify.checkout.invoiceHandler.getInvoices({
          clientId: client.id,
          status: InvoiceStatus.BILL,
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
