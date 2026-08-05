import { describe, it, expect } from 'vitest'
import {
  labelPaymentMethods,
  withPercentages
} from '../../src/components/dashboard/paymentMethods.js'

describe('dashboard.paymentMethods.withPercentages', () => {
  it('computes share percentages of the total', () => {
    const rows = [
      { method: 'banktransfer', totalAmount: 70000, count: 7 },
      { method: 'cash', totalAmount: 30000, count: 3 }
    ]
    const result = withPercentages(rows)
    expect(result).toHaveLength(2)
    expect(result[0]).toMatchObject({ method: 'banktransfer', percent: 70 })
    expect(result[1]).toMatchObject({ method: 'cash', percent: 30 })
  })

  it('sorts by total amount descending', () => {
    const rows = [
      { method: 'cash', totalAmount: 1000, count: 1 },
      { method: 'ideal', totalAmount: 9000, count: 9 },
      { method: 'banktransfer', totalAmount: 5000, count: 5 }
    ]
    const result = withPercentages(rows)
    expect(result.map((r) => r.method)).toEqual([
      'ideal',
      'banktransfer',
      'cash'
    ])
  })

  it('keeps one decimal for uneven shares', () => {
    const rows = [
      { method: 'a', totalAmount: 1, count: 1 },
      { method: 'b', totalAmount: 2, count: 1 },
      { method: 'c', totalAmount: 3, count: 1 }
    ]
    const result = withPercentages(rows)
    const sum = result.reduce((acc, r) => acc + r.percent, 0)
    // 16.7 + 33.3 + 50 = 100 (rounding to one decimal is close enough)
    expect(Math.round(sum)).toBe(100)
  })

  it('returns [] when the total is zero', () => {
    expect(withPercentages([])).toEqual([])
    expect(
      withPercentages([{ method: 'cash', totalAmount: 0, count: 0 }])
    ).toEqual([])
  })
})

describe('dashboard.paymentMethods.labelPaymentMethods', () => {
  it('maps known methods to their labels', () => {
    const rows = [
      {
        method: 'banktransfer',
        label: '',
        totalAmount: 100,
        count: 1,
        percent: 100
      }
    ]
    const result = labelPaymentMethods(rows, {
      banktransfer: 'Bank transfer',
      cash: 'Cash'
    })
    expect(result[0].label).toBe('Bank transfer')
  })

  it('falls back to the raw method string for unknown methods', () => {
    const rows = [
      {
        method: 'smartpin',
        label: '',
        totalAmount: 100,
        count: 1,
        percent: 100
      }
    ]
    const result = labelPaymentMethods(rows, {
      cash: 'Cash'
    })
    expect(result[0].label).toBe('smartpin')
  })
})
