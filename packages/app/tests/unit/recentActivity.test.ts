import { describe, it, expect } from 'vitest'
import {
  colorForActivity,
  filterActivity,
  iconForActivity,
  paginateEntries
} from '../../src/components/dashboard/recentActivity.js'

const entries = [
  { type: 'payment', id: 1 },
  { type: 'payment', id: 2 },
  { type: 'reminder', id: 3 },
  { type: 'billCreated', id: 4 },
  { type: 'invoiceOpened', id: 5 },
  { type: 'exhortation', id: 6 },
  { type: 'payment', id: 7 }
]

describe('dashboard.recentActivity.filterActivity', () => {
  it('returns all entries for "all"', () => {
    expect(filterActivity(entries, 'all')).toHaveLength(7)
  })
  it('filters by event type', () => {
    expect(filterActivity(entries, 'payment').map((e) => e.id)).toEqual([
      1, 2, 7
    ])
    expect(filterActivity(entries, 'reminder').map((e) => e.id)).toEqual([3])
  })
  it('returns [] for a type with no matches', () => {
    expect(filterActivity(entries, 'exhortation2')).toEqual([])
  })
  it('handles empty input', () => {
    expect(filterActivity([], 'all')).toEqual([])
  })
})

describe('dashboard.recentActivity.paginateEntries', () => {
  const items = Array.from({ length: 12 }, (_, i) => ({ id: i + 1 }))

  it('returns the first page', () => {
    expect(paginateEntries(items, 1, 5).map((e) => e.id)).toEqual([
      1, 2, 3, 4, 5
    ])
  })
  it('returns a later page', () => {
    expect(paginateEntries(items, 3, 5).map((e) => e.id)).toEqual([11, 12])
  })
  it('clamps page below 1', () => {
    expect(paginateEntries(items, 0, 5).map((e) => e.id)).toEqual([
      1, 2, 3, 4, 5
    ])
    expect(paginateEntries(items, -3, 5).map((e) => e.id)).toEqual([
      1, 2, 3, 4, 5
    ])
  })
  it('clamps rowsPerPage below 1', () => {
    expect(paginateEntries(items, 1, 0)).toHaveLength(1)
  })
  it('returns [] past the last page', () => {
    expect(paginateEntries(items, 99, 5)).toEqual([])
  })
  it('handles empty input', () => {
    expect(paginateEntries([], 1, 5)).toEqual([])
  })
})

describe('dashboard.recentActivity icons/colors', () => {
  it('maps known types to distinct icons', () => {
    expect(iconForActivity('invoiceOpened')).toBe('mdi-file-document-outline')
    expect(iconForActivity('billCreated')).toBe('mdi-receipt-text-outline')
    expect(iconForActivity('payment')).toBe('mdi-credit-card-check-outline')
    expect(iconForActivity('reminder')).toBe('mdi-bell-outline')
    expect(iconForActivity('exhortation')).toBe('mdi-alert-octagon-outline')
  })
  it('falls back for unknown types', () => {
    expect(iconForActivity('mystery')).toBe('mdi-circle-medium')
  })
  it('maps known types to distinct colors', () => {
    expect(colorForActivity('invoiceOpened')).toBe('primary')
    expect(colorForActivity('billCreated')).toBe('teal')
    expect(colorForActivity('payment')).toBe('green')
    expect(colorForActivity('reminder')).toBe('orange')
    expect(colorForActivity('exhortation')).toBe('red')
  })
  it('falls back for unknown types', () => {
    expect(colorForActivity('mystery')).toBe('grey')
  })
})
