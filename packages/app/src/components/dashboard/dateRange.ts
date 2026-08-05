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

// ISO date range for a fixed preset. Presets cover the WHOLE calendar
// period (e.g. 'week' = Monday..Sunday, 'year' = Jan 1..Dec 31) so the
// revenue chart axis always shows the complete period. `now` is injectable
// for tests.
export const presetDateRange = (
  preset: DashboardPreset,
  now: Date = new Date()
): { dateFrom: string; dateTo: string } => {
  const start = new Date(now)
  const end = new Date(now)
  switch (preset) {
    case 'today':
      break
    case 'week': {
      const day = (now.getDay() + 6) % 7 // Monday = 0
      start.setDate(now.getDate() - day)
      end.setDate(start.getDate() + 6)
      break
    }
    case 'month': {
      start.setDate(1)
      end.setMonth(end.getMonth() + 1, 0) // day 0 of next month = last day
      break
    }
    case 'quarter': {
      const q = Math.floor(now.getMonth() / 3) * 3 // first month of quarter
      start.setMonth(q, 1)
      end.setMonth(q + 3, 0) // day 0 after quarter = last day of quarter
      break
    }
    case 'year':
      start.setMonth(0, 1)
      end.setMonth(11, 31)
      break
    default:
      start.setDate(1)
      end.setMonth(end.getMonth() + 1, 0)
  }
  start.setHours(0, 0, 0, 0)
  end.setHours(0, 0, 0, 0)
  return { dateFrom: toIso(start), dateTo: toIso(end) }
}
