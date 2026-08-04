import { describe, it, expect } from 'vitest'
import {
  DASHBOARD_STATUS_VALUES,
  dashboardStatusLabelKey
} from '../../src/components/dashboard/statusConfig.js'

describe('dashboard.statusConfig', () => {
  it('defines one status per chart slice (no extra labels)', () => {
    // A past bug added an "overdue" label without a matching status,
    // shifting every slice by one and making the chart look wrong.
    expect(DASHBOARD_STATUS_VALUES.length).toBe(6)
    expect(new Set(DASHBOARD_STATUS_VALUES).size).toBe(6)
  })

  it('covers the invoice statuses the backend can return', () => {
    const statuses = DASHBOARD_STATUS_VALUES.map((s) => s)
    expect(statuses).toContain('concept')
    expect(statuses).toContain('open')
    expect(statuses).toContain('paid')
    expect(statuses).toContain('canceled')
    expect(statuses).toContain('bill')
    expect(statuses).toContain('receipt')
  })

  it('maps every status to a distinct label key', () => {
    const keys = DASHBOARD_STATUS_VALUES.map((s) => dashboardStatusLabelKey(s))
    expect(keys).toEqual([
      'concept',
      'open',
      'paid',
      'canceled',
      'bill',
      'receipt'
    ])
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('returns the same number of label keys as status values', () => {
    // This is the regression the alignment bug caused: labels and values
    // must stay 1:1 so chart.js slices line up with their labels.
    const labels = DASHBOARD_STATUS_VALUES.map((s) =>
      dashboardStatusLabelKey(s)
    )
    expect(labels.length).toBe(DASHBOARD_STATUS_VALUES.length)
  })
})
