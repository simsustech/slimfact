import { describe, it, expect } from 'vitest'
import {
  parseAmountToCents,
  centsToAmountString
} from '../../../src/banking/money.js'

describe('parseAmountToCents', () => {
  it('parses negative amounts with 2dp', () => {
    expect(parseAmountToCents('-9.73')).toBe(-973)
  })

  it('parses amounts with 1dp', () => {
    expect(parseAmountToCents('123.4')).toBe(12340)
  })

  it('parses amounts with 2dp', () => {
    expect(parseAmountToCents('123.40')).toBe(12340)
    expect(parseAmountToCents('123.45')).toBe(12345)
  })

  it('parses whole amounts as euros', () => {
    expect(parseAmountToCents('0')).toBe(0)
    expect(parseAmountToCents('1')).toBe(100)
    expect(parseAmountToCents('-1')).toBe(-100)
  })

  it('parses tiny negative amounts', () => {
    expect(parseAmountToCents('-0.01')).toBe(-1)
  })

  it('rejects malformed input', () => {
    expect(() => parseAmountToCents('')).toThrow()
    expect(() => parseAmountToCents('abc')).toThrow()
    expect(() => parseAmountToCents('12.345')).toThrow()
    expect(() => parseAmountToCents('1.')).toThrow()
    expect(() => parseAmountToCents('.5')).toThrow()
    expect(() => parseAmountToCents('1,5')).toThrow()
  })
})

describe('centsToAmountString', () => {
  it('formats negative cents', () => {
    expect(centsToAmountString(-973)).toBe('-9.73')
  })

  it('strips trailing zeros in the fraction', () => {
    expect(centsToAmountString(12340)).toBe('123.4')
  })

  it('keeps needed fraction digits', () => {
    expect(centsToAmountString(12345)).toBe('123.45')
    expect(centsToAmountString(5)).toBe('0.05')
    expect(centsToAmountString(-5)).toBe('-0.05')
  })

  it('formats zero', () => {
    expect(centsToAmountString(0)).toBe('0')
  })

  it('round-trips with parseAmountToCents', () => {
    for (const cents of [-973, -1, 0, 5, 100, 12340, 12345]) {
      expect(parseAmountToCents(centsToAmountString(cents))).toBe(cents)
    }
  })
})
