import { describe, it, expect } from 'vitest'
import { formatPrice } from '@slimfact/tools'

describe('tools.formatPrice', () => {
  it('converts cents to whole units with two decimals', () => {
    expect(formatPrice({ value: 40009, locale: 'en-US' })).toBe('400.09')
    expect(formatPrice({ value: 32081, locale: 'en-US' })).toBe('320.81')
    expect(formatPrice({ value: 0, locale: 'en-US' })).toBe('0.00')
  })

  it('localizes the number (comma decimal for nl-NL)', () => {
    expect(formatPrice({ value: 40009, locale: 'nl-NL' })).toBe('400,09')
    expect(formatPrice({ value: 318560, locale: 'nl-NL' })).toBe('3.185,60')
  })

  it('adds thousands separators for large amounts', () => {
    expect(formatPrice({ value: 318560, locale: 'en-US' })).toBe('3,185.60')
    expect(formatPrice({ value: 123456789, locale: 'en-US' })).toBe(
      '1,234,567.89'
    )
  })

  it('omits the currency code by default (DigiBoox export style)', () => {
    expect(formatPrice({ value: 40009, locale: 'en-US' })).not.toContain('EUR')
    expect(formatPrice({ value: 40009, locale: 'nl-NL' })).toBe('400,09')
  })

  it('includes the currency symbol when requested', () => {
    expect(
      formatPrice({ value: 40009, locale: 'en-US', includeSymbol: true })
    ).toBe('€400.09')
    expect(
      formatPrice({ value: 318560, locale: 'nl-NL', includeSymbol: true })
    ).toBe('€\u00A03.185,60') // nl-NL inserts a non-breaking space
  })

  it('supports a custom ISO currency', () => {
    expect(
      formatPrice({
        value: 40009,
        locale: 'en-US',
        currency: 'USD',
        includeSymbol: true
      })
    ).toBe('$400.09')
  })
})
