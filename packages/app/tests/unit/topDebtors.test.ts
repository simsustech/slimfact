import { describe, it, expect } from 'vitest'
import {
  topByStatusFromStatusCounts,
  topDebtorsFromStatusCounts,
  topBillsFromStatusCounts,
  type StatusCountRow
} from '../../src/components/dashboard/topDebtors.js'

const row = (
  companyId: number,
  companyName: string,
  status: string,
  count: number | string,
  totalAmount: number | string
): StatusCountRow => ({ companyId, companyName, status, count, totalAmount })

describe('dashboard.topDebtors', () => {
  const rows: StatusCountRow[] = [
    row(1, 'Acme Inc', 'open', '8', '349699'),
    row(2, 'Stanton', 'open', '6', '321571'),
    row(1, 'Acme Inc', 'open', '2', '4468'),
    row(3, 'Muller', 'bill', '14', '711574'),
    row(2, 'Stanton', 'bill', '22', '1017127'),
    row(4, 'Schmitt', 'paid', '1', '5000')
  ]

  it('sums OPEN amounts per company (coercing string totals)', () => {
    const result = topDebtorsFromStatusCounts(rows)
    // Acme: 349699 + 4468 = 354167
    expect(result[0]).toEqual({
      companyId: 1,
      companyName: 'Acme Inc',
      totalAmount: 354167
    })
    expect(result[1].companyId).toBe(2)
    expect(result[1].totalAmount).toBe(321571)
  })

  it('excludes non-OPEN statuses for the debtors list', () => {
    const result = topDebtorsFromStatusCounts(rows)
    expect(result.some((r) => r.companyId === 3)).toBe(false) // Muller is bill
    expect(result.some((r) => r.companyId === 4)).toBe(false) // Schmitt is paid
  })

  it('sums BILL amounts per company separately', () => {
    const result = topBillsFromStatusCounts(rows)
    expect(result[0]).toEqual({
      companyId: 2,
      companyName: 'Stanton',
      totalAmount: 1017127
    })
    expect(result[1].companyId).toBe(3)
    expect(result[1].totalAmount).toBe(711574)
  })

  it('sorts by total descending and respects the limit', () => {
    const result = topByStatusFromStatusCounts(rows, 'open', 1)
    expect(result.length).toBe(1)
    expect(result[0].companyId).toBe(1)
  })

  it('handles missing amounts and empty input', () => {
    const empty = topByStatusFromStatusCounts([], 'open')
    expect(empty).toEqual([])
    const zero = topByStatusFromStatusCounts(
      [row(1, 'A', 'open', '1', '0')],
      'open'
    )
    expect(zero[0].totalAmount).toBe(0)
  })
})
