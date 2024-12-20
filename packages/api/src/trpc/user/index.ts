import { t } from '../index.js'
import type { FastifyInstance } from 'fastify'
import { userInvoiceRoutes } from './invoices.js'
export const userRoutes = ({
  fastify,
  procedure
}: {
  fastify: FastifyInstance
  procedure: typeof t.procedure
}) => ({
  ...userInvoiceRoutes({ fastify, procedure })
})
