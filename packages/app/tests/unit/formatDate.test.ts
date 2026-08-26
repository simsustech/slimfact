import { describe, it, expect } from 'vitest'
import { formatDate } from '@slimfact/tools'

describe('tools.formatDate', () => {
  it('formats DD-MM-YYYY (default DATE_FORMAT)', () => {
    expect(formatDate('2026-08-01', 'DD-MM-YYYY')).toBe('01-08-2026')
    expect(formatDate('2026-12-31', 'DD-MM-YYYY')).toBe('31-12-2026')
  })

  it('keeps leading zeros', () => {
    expect(formatDate('2026-03-07', 'DD-MM-YYYY')).toBe('07-03-2026')
  })

  it('supports other separators', () => {
    expect(formatDate('2026-08-01', 'MM/DD/YYYY')).toBe('08/01/2026')
  })

  it('supports a two-digit year', () => {
    expect(formatDate('2026-08-01', 'DD-MM-YY')).toBe('01-08-26')
  })

  it('returns the input unchanged for invalid dates', () => {
    expect(formatDate('', 'DD-MM-YYYY')).toBe('')
    expect(formatDate('2026-08', 'DD-MM-YYYY')).toBe('2026-08')
  })
})
