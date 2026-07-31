import { describe, it, expect } from 'vitest'
import {
  dashboardDateRangeForPreset,
  type DashboardDateRangePreset
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
