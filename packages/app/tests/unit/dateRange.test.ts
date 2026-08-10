import { describe, it, expect } from 'vitest'
import {
  presetDateRange,
  toIso
} from '../../src/components/dashboard/dateRange.js'

describe('dashboard.dateRange.toIso', () => {
  it('formats a date as YYYY-MM-DD', () => {
    expect(toIso(new Date(2025, 5, 15))).toBe('2025-06-15')
    expect(toIso(new Date(2025, 0, 1))).toBe('2025-01-01')
    expect(toIso(new Date(2025, 11, 31))).toBe('2025-12-31')
  })

  it('zero-pads month and day', () => {
    expect(toIso(new Date(2025, 2, 7))).toBe('2025-03-07')
  })
})

describe('dashboard.dateRange.presetDateRange', () => {
  const NOW = new Date(2025, 5, 15, 10, 30, 0) // June 15 2025 (Sunday)

  it('today covers the current day', () => {
    const r = presetDateRange('today', NOW)
    expect(r.dateFrom).toBe('2025-06-15')
    expect(r.dateTo).toBe('2025-06-15')
  })

  it('week covers Monday..Sunday of the current week', () => {
    // June 2025: 15th is a Sunday; the week runs Monday June 9..June 15
    const r = presetDateRange('week', NOW)
    expect(r.dateFrom).toBe('2025-06-09')
    expect(r.dateTo).toBe('2025-06-15')
  })

  it('week covers the full week for a mid-week day', () => {
    const r = presetDateRange('week', new Date(2025, 5, 18)) // Wednesday
    expect(r.dateFrom).toBe('2025-06-16')
    expect(r.dateTo).toBe('2025-06-22')
  })

  it('month covers the first to the last day of the month', () => {
    const r = presetDateRange('month', NOW)
    expect(r.dateFrom).toBe('2025-06-01')
    expect(r.dateTo).toBe('2025-06-30')
  })

  it('month covers the last day of a short month', () => {
    const r = presetDateRange('month', new Date(2025, 1, 10)) // February
    expect(r.dateTo).toBe('2025-02-28')
  })

  it('quarter covers the first to the last day of the quarter', () => {
    const r = presetDateRange('quarter', NOW)
    expect(r.dateFrom).toBe('2025-04-01')
    expect(r.dateTo).toBe('2025-06-30')
  })

  it('year covers Jan 1 to Dec 31', () => {
    const r = presetDateRange('year', NOW)
    expect(r.dateFrom).toBe('2025-01-01')
    expect(r.dateTo).toBe('2025-12-31')
  })

  it('always produces dateFrom <= dateTo', () => {
    for (const preset of [
      'today',
      'week',
      'month',
      'quarter',
      'year'
    ] as const) {
      const r = presetDateRange(preset, NOW)
      expect(r.dateFrom <= r.dateTo).toBe(true)
    }
  })
})
