import { type FastifyInstance } from 'fastify'
// import { TRPCError } from '@trpc/server'
import { t } from '../index.js'
import { z } from 'zod'
import { exportDigibooxInvoices } from '@slimfact/tools/digiboox'
import { InvoiceStatus } from '@modular-api/fastify-checkout'

export const adminExportRoutes = ({
  fastify,
  procedure
}: {
  fastify: FastifyInstance
  procedure: typeof t.procedure
}) => ({
  exportDigibooxInvoices: procedure
    .input(
      z.object({
        companyId: z.number(),
        startDate: z.string(),
        endDate: z.string()
      })
    )
    .query(async ({ input }) => {
      const { companyId, startDate, endDate } = input
      if (fastify.checkout?.invoiceHandler) {
        const invoices = await fastify.checkout?.invoiceHandler.getInvoices({
          companyId,
          statuses: [InvoiceStatus.OPEN, InvoiceStatus.PAID],
          startDate,
          endDate
        })

        return exportDigibooxInvoices(invoices)
      }
      throw new Error('No invoice handler')
    })
})
