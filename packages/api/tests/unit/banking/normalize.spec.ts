import { describe, it, expect } from 'vitest'
import {
  normalizeReference,
  containsInvoiceNumber
} from '@slimfact/tools/banking'

describe('normalizeReference', () => {
  it('lowercases and strips non-alphanumerics', () => {
    expect(normalizeReference('Factuur 2026-0001')).toBe('factuur20260001')
  })

  it('strips separators and punctuation', () => {
    expect(normalizeReference('INV-2026/0001')).toBe('inv20260001')
    expect(normalizeReference('A.b-c_d')).toBe('abcd')
  })

  it('handles empty input', () => {
    expect(normalizeReference('')).toBe('')
  })
})

describe('containsInvoiceNumber', () => {
  it('matches a normalized reference against the invoice number digit run', () => {
    expect(containsInvoiceNumber('factuur20260001', '2026-0001')).toBe(true)
  })

  it('matches when the invoice number has no separators', () => {
    expect(containsInvoiceNumber('factuur20260001', '20260001')).toBe(true)
  })

  it('matches a bare number inside the reference', () => {
    expect(containsInvoiceNumber('factuur20260001', '2026')).toBe(true)
  })

  it('rejects a different invoice number', () => {
    expect(containsInvoiceNumber('factuur20260002', '2026-0001')).toBe(false)
  })

  it('rejects an unrelated reference', () => {
    expect(containsInvoiceNumber('onbekendebetaling', '2026-0001')).toBe(false)
  })

  it('rejects when the invoice number has no digits', () => {
    expect(containsInvoiceNumber('factuur', 'ABC')).toBe(false)
  })
})
