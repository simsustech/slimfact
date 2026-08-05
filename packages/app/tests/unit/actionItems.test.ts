import { describe, it, expect } from 'vitest'
import {
  aggregateActionItems,
  sumOverdueBuckets,
  type OverdueAgingRow,
  type StatusCountRow
} from '../../src/components/dashboard/actionItems.js'

const statusRow = (
  companyId: number,
  status: string,
  count: number | string,
  totalAmount: number | string
): StatusCountRow => ({
  companyId,
  companyName: `Company ${companyId}`,
  status,
  count,
  totalAmount
})

const agingRow = (
  companyId: number,
  reminderCount: number,
  count: number | string,
  totalAmount: number | string
): OverdueAgingRow => ({
  companyId,
  companyName: `Company ${companyId}`,
  reminderCount,
  count,
  totalAmount
})

describe('dashboard.aggregateActionItems', () => {
  it('sums OPEN across ALL companies (not just the first)', () => {
    const statusCounts = [
      statusRow(1, 'open', '2', '1000'),
      statusRow(2, 'open', '7', '265074'),
      statusRow(3, 'open', '1', '5000'),
      statusRow(4, 'paid', '21', '986454')
    ]
    const result = aggregateActionItems(statusCounts, [])
    // The past bug used .find() which only kept the first OPEN row.
    expect(result.open).toEqual({ count: 10, totalAmount: 271074 })
  })

  it('coerces string counts/totals (Postgres bigint) when summing', () => {
    const statusCounts = [
      statusRow(1, 'open', '1', '100'),
      statusRow(2, 'open', '2', '200'),
      statusRow(3, 'open', '3', '300')
    ]
    const result = aggregateActionItems(statusCounts, [])
    expect(result.open).toEqual({ count: 6, totalAmount: 600 })
  })

  it('sums each overdue bucket across all companies', () => {
    const overdueAging = [
      agingRow(1, 0, '1', '100'), // needsReminder
      agingRow(2, 0, '2', '200'), // needsReminder
      agingRow(3, 1, '4', '400'), // reminder1
      agingRow(4, 3, '5', '500') // exhortation (>=3)
    ]
    const result = aggregateActionItems([], overdueAging)
    expect(result.overdue.needsReminder).toEqual({ count: 3, totalAmount: 300 })
    expect(result.overdue.reminder1).toEqual({ count: 4, totalAmount: 400 })
    expect(result.overdue.reminder2).toEqual({ count: 0, totalAmount: 0 })
    expect(result.overdue.exhortation).toEqual({ count: 5, totalAmount: 500 })
  })

  it('sums all four overdue buckets into a single overdue total', () => {
    const overdue = {
      needsReminder: { count: 2, totalAmount: 300 },
      reminder1: { count: 4, totalAmount: 400 },
      reminder2: { count: 6, totalAmount: 500 },
      exhortation: { count: 8, totalAmount: 600 }
    }
    expect(sumOverdueBuckets(overdue)).toEqual({
      count: 20,
      totalAmount: 1800
    })
  })

  it('sumOverdueBuckets handles empty buckets', () => {
    const overdue = {
      needsReminder: { count: 0, totalAmount: 0 },
      reminder1: { count: 0, totalAmount: 0 },
      reminder2: { count: 0, totalAmount: 0 },
      exhortation: { count: 0, totalAmount: 0 }
    }
    expect(sumOverdueBuckets(overdue)).toEqual({ count: 0, totalAmount: 0 })
  })

  it('returns zeroed buckets for empty input', () => {
    const result = aggregateActionItems([], [])
    expect(result.open).toEqual({ count: 0, totalAmount: 0 })
    expect(result.overdue.needsReminder).toEqual({ count: 0, totalAmount: 0 })
    expect(result.overdue.exhortation).toEqual({ count: 0, totalAmount: 0 })
  })
})
