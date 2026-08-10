// Debtor/creditor data for the dashboard.
// Groups the per-company statusCounts rows (from getInvoiceStatusCounts) into
// a sorted list of companies with their totals for a given status. Used for
// both the "outstanding invoices" (status=open, clients owe us) and "bills to
// pay" (status=bill, we owe suppliers) overviews. Kept in a plain module so
// unit tests can verify grouping/sorting without mounting the Vue component.

export interface DebtorRow {
  companyId: number | null
  companyName: string | null
  totalAmount: number
}

export interface StatusCountRow {
  companyId: number | null
  companyName: string | null
  status: string
  count: number | string
  totalAmount: number | string
}

// Filter to the given status, coerce amounts to numbers (Postgres returns
// strings), group by company and sort by total descending.
export const topByStatusFromStatusCounts = (
  rows: StatusCountRow[],
  status: string,
  limit = 5
): DebtorRow[] => {
  const grouped = new Map<number | null, DebtorRow>()
  for (const row of rows) {
    if (row.status !== status) continue
    const totalAmount = Number(row.totalAmount) || 0
    const existing = grouped.get(row.companyId)
    if (existing) {
      existing.totalAmount += totalAmount
    } else {
      grouped.set(row.companyId, {
        companyId: row.companyId,
        companyName: row.companyName,
        totalAmount
      })
    }
  }
  return Array.from(grouped.values())
    .sort((a, b) => b.totalAmount - a.totalAmount)
    .slice(0, limit)
}

// Convenience wrappers for the two dashboard overviews.
export const topDebtorsFromStatusCounts = (
  rows: StatusCountRow[],
  limit = 5
): DebtorRow[] => topByStatusFromStatusCounts(rows, 'open', limit)

export const topBillsFromStatusCounts = (
  rows: StatusCountRow[],
  limit = 5
): DebtorRow[] => topByStatusFromStatusCounts(rows, 'bill', limit)
