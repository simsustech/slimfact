// Date-range helpers for the dashboard revenue section.
// Kept in a plain module so unit tests can exercise them without mounting
// the Vue component.

export type DashboardPreset = 'today' | 'week' | 'month' | 'quarter' | 'year'

export const toIso = (value: Date): string => {
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const day = String(value.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// ISO date range for a fixed preset. `now` is injectable for tests.
export const presetDateRange = (
  preset: DashboardPreset,
  now: Date = new Date()
): { dateFrom: string; dateTo: string } => {
  let dateFrom: Date
  const dateTo = now
  switch (preset) {
    case 'today':
      dateFrom = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      break
    case 'week': {
      const day = (now.getDay() + 6) % 7
      dateFrom = new Date(now)
      dateFrom.setDate(now.getDate() - day)
      dateFrom.setHours(0, 0, 0, 0)
      break
    }
    case 'month':
      dateFrom = new Date(now.getFullYear(), now.getMonth(), 1)
      break
    case 'quarter': {
      const q = Math.floor(now.getMonth() / 3) * 3
      dateFrom = new Date(now.getFullYear(), q, 1)
      break
    }
    case 'year':
      dateFrom = new Date(now.getFullYear(), 0, 1)
      break
    default:
      dateFrom = new Date(now.getFullYear(), now.getMonth(), 1)
      break
  }
  return { dateFrom: toIso(dateFrom), dateTo: toIso(dateTo) }
}
