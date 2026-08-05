// Payment-method split helpers for the dashboard.
// Normalizes the { method, totalAmount, count } rows from getDashboardStats
// into display rows with a share percentage and a lang label, sorted by
// amount descending.

export interface PaymentMethodRow {
  method: string
  totalAmount: number
  count: number
}

export interface DisplayMethodRow {
  method: string
  label: string
  totalAmount: number
  count: number
  percent: number
}

// Share of each method in the total (0-100), one decimal.
export const withPercentages = (
  rows: PaymentMethodRow[]
): DisplayMethodRow[] => {
  const total = rows.reduce((acc, row) => acc + row.totalAmount, 0)
  if (total === 0) return []
  return rows
    .map((row) => ({
      ...row,
      label: '', // filled by the caller with the lang label
      percent: Math.round((row.totalAmount / total) * 1000) / 10
    }))
    .sort((a, b) => b.totalAmount - a.totalAmount)
}

// Attach lang labels; unknown methods fall back to the raw method string.
export const labelPaymentMethods = (
  rows: DisplayMethodRow[],
  labels: Record<string, string>
): DisplayMethodRow[] =>
  rows.map((row) => ({
    ...row,
    label: labels[row.method] ?? row.method
  }))
