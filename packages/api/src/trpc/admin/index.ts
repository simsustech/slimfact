import { adminAccountRoutes } from './accounts.js'
import { adminInvoiceRoutes } from './invoices.js'
import { adminCompanyRoutes } from './companies.js'
import { adminClientRoutes } from './clients.js'
import { adminNumberPrefixRoutes } from './numberPrefixes.js'
import { adminInitialNumberForPrefixRoutes } from './initialNumberForPrefixes.js'
import { adminSubscriptionRoutes } from './subscriptions.js'
import { adminInvoiceEventsRoutes } from './invoiceEvents.js'
import { t } from '../../trpc/index.js'
import type { FastifyInstance } from 'fastify'
import { adminHealthRoutes } from './health.js'
import { adminExportRoutes } from './export.js'

export const adminRoutes = ({
  fastify,
  procedure
}: {
  fastify: FastifyInstance
  procedure: typeof t.procedure
}) => ({
  ...adminAccountRoutes({ fastify, procedure }),
  ...adminInvoiceRoutes({ fastify, procedure }),
  ...adminCompanyRoutes({ fastify, procedure }),
  ...adminClientRoutes({ fastify, procedure }),
  ...adminNumberPrefixRoutes({ fastify, procedure }),
  ...adminInitialNumberForPrefixRoutes({ fastify, procedure }),
  ...adminSubscriptionRoutes({ fastify, procedure }),
  ...adminHealthRoutes({ fastify, procedure }),
  ...adminExportRoutes({ fastify, procedure }),
  ...adminInvoiceEventsRoutes({ fastify, procedure })
})
