import { t } from '../index.js'
import { publicInvoiceRoutes } from './invoices.js'
import type { FastifyInstance } from 'fastify'

export const publicRoutes = ({
  fastify,
  procedure
}: {
  fastify: FastifyInstance
  procedure: typeof t.procedure
}) => ({
  ...publicInvoiceRoutes({ fastify, procedure })
})
