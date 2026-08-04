// Recent-activity helpers for the dashboard.
// Pure functions for filtering, paginating and styling activity entries,
// extracted so unit tests can cover the edge cases (filter, empty lists,
// page boundaries, unknown event types).

export interface ActivityEntryLike {
  type: string
  [key: string]: unknown
}

export type ActivityEventType =
  | 'invoiceOpened'
  | 'billCreated'
  | 'payment'
  | 'reminder'
  | 'exhortation'

export const filterActivity = <T extends ActivityEntryLike>(
  entries: T[],
  eventType: string
): T[] =>
  eventType === 'all' ? entries : entries.filter((e) => e.type === eventType)

export const paginateEntries = <T>(
  entries: T[],
  page: number,
  rowsPerPage: number
): T[] => {
  const safePage = Math.max(1, page)
  const safeRows = Math.max(1, rowsPerPage)
  const start = (safePage - 1) * safeRows
  return entries.slice(start, start + safeRows)
}

export const iconForActivity = (type: string): string => {
  switch (type) {
    case 'invoiceOpened':
      return 'mdi-file-document-outline'
    case 'billCreated':
      return 'mdi-receipt-text-outline'
    case 'payment':
      return 'mdi-credit-card-check-outline'
    case 'reminder':
      return 'mdi-bell-outline'
    case 'exhortation':
      return 'mdi-alert-octagon-outline'
    default:
      return 'mdi-circle-medium'
  }
}

export const colorForActivity = (type: string): string => {
  switch (type) {
    case 'invoiceOpened':
      return 'primary'
    case 'billCreated':
      return 'teal'
    case 'payment':
      return 'green'
    case 'reminder':
      return 'orange'
    case 'exhortation':
      return 'red'
    default:
      return 'grey'
  }
}
