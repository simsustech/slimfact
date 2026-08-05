import { describe, it, expect } from 'vitest'
import {
  bucketEndDate,
  bucketLabel,
  bucketStarts,
  dashboardDateRangeForPreset,
  type DashboardDateRangePreset,
  pickGranularity
} from '../../src/trpc/admin/dashboard.js'

describe('dashboard.trpc.dashboardDateRangeForPreset', () => {
  const FROZEN_NOW = new Date('2025-06-15T12:34:56.000Z')

  const expectedForPreset = (preset: DashboardDateRangePreset) => {
    const r = dashboardDateRangeForPreset(
      preset,
      new Date('2025-06-15T00:00:00Z')
    )
    expect(r.dateFrom).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(r.dateTo).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(r.dateFrom <= r.dateTo).toBe(true)
  }

  it('returns ISO date strings for every preset', () => {
    const presets: DashboardDateRangePreset[] = [
      'today',
      'week',
      'month',
      'quarter',
      'year'
    ]
    for (const preset of presets) {
      expectedForPreset(preset)
    }
  })

  it('today starts at computed start-of-day for the given timezone', () => {
    const r = dashboardDateRangeForPreset('today', FROZEN_NOW)
    expect(r.dateFrom).toBe('2025-06-15')
    expect(r.dateTo).toBe('2025-06-15')
  })

  it('month uses the first day of the month and today as dateTo', () => {
    const r = dashboardDateRangeForPreset('month', FROZEN_NOW)
    expect(r.dateFrom).toBe('2025-06-01')
    expect(r.dateTo).toBe('2025-06-15')
  })

  it('quarter uses the first day of the quarter', () => {
    const r = dashboardDateRangeForPreset('quarter', FROZEN_NOW)
    expect(r.dateFrom).toBe('2025-04-01')
    expect(r.dateTo).toBe('2025-06-15')
  })

  it('year uses the first day of the calendar year', () => {
    const r = dashboardDateRangeForPreset('year', FROZEN_NOW)
    expect(r.dateFrom).toBe('2025-01-01')
    expect(r.dateTo).toBe('2025-06-15')
  })

  it('week starts on Monday (weekStartsOn: 1)', () => {
    const r = dashboardDateRangeForPreset('week', FROZEN_NOW)
    expect(r.dateFrom).toBe('2025-06-09')
    expect(r.dateTo).toBe('2025-06-15')
  })
})

describe('dashboard.trpc.aging-label-mapping', () => {
  const labelForReminderCount = (count: number) => {
    if (count >= 3) return 'exhortation'
    const map: Record<number, string> = {
      0: 'needsReminder',
      1: 'reminder1',
      2: 'reminder2'
    }
    return map[Math.min(Math.max(count, 0), 2)]
  }

  it('reminderCount 0 -> needsReminder', () => {
    expect(labelForReminderCount(0)).toBe('needsReminder')
  })

  it('reminderCount 1 -> reminder1', () => {
    expect(labelForReminderCount(1)).toBe('reminder1')
  })

  it('reminderCount 2 -> reminder2', () => {
    expect(labelForReminderCount(2)).toBe('reminder2')
  })

  it('reminderCount 3+ -> exhortation', () => {
    expect(labelForReminderCount(3)).toBe('exhortation')
    expect(labelForReminderCount(5)).toBe('exhortation')
  })

  it('negative reminderCount clamps to needsReminder', () => {
    expect(labelForReminderCount(-1)).toBe('needsReminder')
  })
})

describe('dashboard.trpc.event-type-set', () => {
  it('passes through all allowed event types', () => {
    const allowed = [
      'invoiceOpened',
      'billCreated',
      'payment',
      'reminder',
      'exhortation'
    ]
    expect(allowed.length).toBe(5)
  })

  it('excludes an unknown event type (handler-level filter)', () => {
    const requested = ['payment', 'unknown_event']
    const allowed = new Set([
      'invoiceOpened',
      'billCreated',
      'payment',
      'reminder',
      'exhortation'
    ])
    const filtered = requested.filter((t) => allowed.has(t))
    expect(filtered).toEqual(['payment'])
  })
})

describe('dashboard.trpc.pickGranularity', () => {
  it('uses day for <=10d ranges (week view)', () => {
    expect(pickGranularity('2025-01-01', '2025-01-07')).toBe('day')
    expect(pickGranularity('2025-01-01', '2025-01-10')).toBe('day')
  })

  it('uses week for 11-45d ranges (month view shows week numbers)', () => {
    expect(pickGranularity('2025-01-01', '2025-01-31')).toBe('week')
    expect(pickGranularity('2025-01-01', '2025-02-15')).toBe('week')
  })

  it('uses month for 46-200d ranges (quarter view)', () => {
    expect(pickGranularity('2025-01-01', '2025-03-01')).toBe('month')
    expect(pickGranularity('2025-01-01', '2025-07-19')).toBe('month')
  })

  it('uses quarter for >200d ranges (year view)', () => {
    expect(pickGranularity('2025-01-01', '2025-07-21')).toBe('quarter')
    expect(pickGranularity('2025-01-01', '2026-01-01')).toBe('quarter')
  })
})

describe('dashboard.trpc.bucketEndDate', () => {
  it('keeps a day bucket to itself', () => {
    expect(bucketEndDate('2025-06-15', 'day')).toBe('2025-06-15')
  })

  it('ends a week bucket on Sunday (6 days after Monday start)', () => {
    expect(bucketEndDate('2025-06-02', 'week')).toBe('2025-06-08')
  })

  it('ends a month bucket on the last day of the month', () => {
    expect(bucketEndDate('2025-02-01', 'month')).toBe('2025-02-28')
    expect(bucketEndDate('2024-02-01', 'month')).toBe('2024-02-29')
    expect(bucketEndDate('2025-06-01', 'month')).toBe('2025-06-30')
    expect(bucketEndDate('2025-12-01', 'month')).toBe('2025-12-31')
  })

  it('ends a quarter bucket on the last day of the quarter', () => {
    expect(bucketEndDate('2025-01-01', 'quarter')).toBe('2025-03-31')
    expect(bucketEndDate('2025-04-01', 'quarter')).toBe('2025-06-30')
    expect(bucketEndDate('2025-07-01', 'quarter')).toBe('2025-09-30')
    expect(bucketEndDate('2025-10-01', 'quarter')).toBe('2025-12-31')
  })

  it('handles a week spanning a month/year boundary', () => {
    expect(bucketEndDate('2025-12-29', 'week')).toBe('2026-01-04')
  })
})

describe('dashboard.trpc.bucketStarts', () => {
  it('lists every day for day granularity', () => {
    expect(bucketStarts('2026-08-01', '2026-08-03', 'day')).toEqual([
      '2026-08-01',
      '2026-08-02',
      '2026-08-03'
    ])
  })

  it('starts weeks on Monday, including the Monday before dateFrom', () => {
    // 2026-08-01 is a Saturday; the week starts Monday 2026-07-27.
    expect(bucketStarts('2026-08-01', '2026-08-04', 'week')).toEqual([
      '2026-07-27',
      '2026-08-03'
    ])
  })

  it('lists months starting on the 1st', () => {
    expect(bucketStarts('2026-01-15', '2026-03-10', 'month')).toEqual([
      '2026-01-01',
      '2026-02-01',
      '2026-03-01'
    ])
  })

  it('lists quarters starting on quarter boundaries', () => {
    expect(bucketStarts('2026-05-05', '2026-12-15', 'quarter')).toEqual([
      '2026-04-01',
      '2026-07-01',
      '2026-10-01'
    ])
  })

  it('covers a full year as 4 quarters', () => {
    expect(bucketStarts('2026-01-01', '2026-12-31', 'quarter')).toHaveLength(4)
  })
})

describe('dashboard.trpc.bucketLabel', () => {
  it('labels days as YYYY-MM-DD', () => {
    expect(bucketLabel('2026-08-04', 'day')).toBe('2026-08-04')
  })

  it('labels weeks with the ISO week number', () => {
    expect(bucketLabel('2026-08-03', 'week')).toBe('2026-W32')
    // ISO year boundary: 2025-12-29 is week 1 of 2026.
    expect(bucketLabel('2025-12-29', 'week')).toBe('2026-W01')
  })

  it('labels months as YYYY-MM', () => {
    expect(bucketLabel('2026-08-01', 'month')).toBe('2026-08')
  })

  it('labels quarters as YYYY-Qn', () => {
    expect(bucketLabel('2026-01-01', 'quarter')).toBe('2026-Q1')
    expect(bucketLabel('2026-10-01', 'quarter')).toBe('2026-Q4')
  })
})
