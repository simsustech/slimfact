// Status chart configuration for the dashboard.
// Kept in a plain module so unit tests can verify that every status value
// has exactly one label and vice versa (a past bug added an "overdue"
// label without a matching status, shifting every chart slice by one).

import { InvoiceStatus } from '@modular-api/fastify-checkout/types'

export const DASHBOARD_STATUS_VALUES = [
  InvoiceStatus.CONCEPT,
  InvoiceStatus.OPEN,
  InvoiceStatus.PAID,
  InvoiceStatus.CANCELED,
  InvoiceStatus.BILL,
  InvoiceStatus.RECEIPT
] as const satisfies readonly InvoiceStatus[]

export type DashboardStatusValue = (typeof DASHBOARD_STATUS_VALUES)[number]

// Resolve the i18n label key for a status value. Must stay index-aligned
// with DASHBOARD_STATUS_VALUES.
export const dashboardStatusLabelKey = (
  status: DashboardStatusValue
): string => {
  switch (status) {
    case InvoiceStatus.CONCEPT:
      return 'concept'
    case InvoiceStatus.OPEN:
      return 'open'
    case InvoiceStatus.PAID:
      return 'paid'
    case InvoiceStatus.CANCELED:
      return 'canceled'
    case InvoiceStatus.BILL:
      return 'bill'
    case InvoiceStatus.RECEIPT:
      return 'receipt'
    default:
      return 'concept'
  }
}
