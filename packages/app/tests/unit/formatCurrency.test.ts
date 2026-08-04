import { describe, it, expect } from 'vitest'
import { formatCurrency } from '../../src/components/dashboard/formatCurrency.js'

describe('dashboard.formatCurrency', () => {
  it('converts cents to euros with two decimals', () => {
    expect(formatCurrency(40009)).toBe('€ 400.09')
    expect(formatCurrency(32081)).toBe('€ 320.81')
    expect(formatCurrency(0)).toBe('€ 0.00')
  })

  it('adds thousands separators for large amounts', () => {
    expect(formatCurrency(318560)).toBe('€ 3,185.60')
    expect(formatCurrency(123456789)).toBe('€ 1,234,567.89')
  })

  it('handles string input', () => {
    expect(formatCurrency('40009')).toBe('€ 400.09')
    expect(formatCurrency('')).toBe('')
  })

  it('returns empty string for non-numeric input', () => {
    expect(formatCurrency('abc')).toBe('')
    expect(formatCurrency(Number.NaN)).toBe('')
  })

  it('supports a custom currency symbol', () => {
    expect(formatCurrency(40009, '$')).toBe('$ 400.09')
  })
})
