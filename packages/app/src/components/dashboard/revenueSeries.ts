// Revenue series helpers for the dashboard.
// Extracts the paid-revenue series manipulation from DashboardPage into a
// testable module: series lookup by status, period totals, and chart dataset
// building.

export interface RevenueSeries {
  labels: string[]
  series: { status: string; data: number[] }[]
}

export interface ChartDataset {
  label: string
  data: number[]
  borderColor: string
  backgroundColor: string
}

// Sum a series' values to get the period total for one document type.
export const sumSeries = (
  data: (number | null | undefined)[] | undefined
): number => (data ?? []).reduce<number>((acc, value) => acc + (value ?? 0), 0)

// Find the data array for a status (the backend returns one series per
// status, so this is a lookup, not an aggregation).
export const seriesDataForStatus = (
  revenue: RevenueSeries | null | undefined,
  status: string
): number[] => revenue?.series.find((s) => s.status === status)?.data ?? []

// Period total for one status.
export const revenueForStatus = (
  revenue: RevenueSeries | null | undefined,
  status: string
): number => sumSeries(seriesDataForStatus(revenue, status))

// Build the grouped-bar chart datasets (one per document type), keeping the
// labels and reusing each series' data array (length-aligned with labels).
export const buildRevenueChartDatasets = (
  revenue: RevenueSeries | null | undefined,
  labels: { invoices: string; bills: string; receipts: string }
): { labels: string[]; datasets: ChartDataset[] } => {
  const datasets: ChartDataset[] = [
    {
      label: labels.invoices,
      data: seriesDataForStatus(revenue, 'paid'),
      borderColor: '#4caf50',
      backgroundColor: '#4caf50'
    },
    {
      label: labels.bills,
      data: seriesDataForStatus(revenue, 'bill'),
      borderColor: '#2196f3',
      backgroundColor: '#2196f3'
    },
    {
      label: labels.receipts,
      data: seriesDataForStatus(revenue, 'receipt'),
      borderColor: '#ff9800',
      backgroundColor: '#ff9800'
    }
  ]
  return { labels: revenue?.labels ?? [], datasets }
}
