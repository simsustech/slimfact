import { describe, it, expect } from 'vitest'
import { buildReminderSentDates } from '@modular-api/fastify-checkout'

describe('fastify-checkout.buildReminderSentDates', () => {
  it('accepts valid YYYY-MM-DD date strings', () => {
    expect(buildReminderSentDates(['2026-06-06', '2026-06-16'])).toEqual([
      '2026-06-06',
      '2026-06-16'
    ])
  })

  it('accepts an empty array', () => {
    expect(buildReminderSentDates([])).toEqual([])
  })

  it('returns a copy, not the caller array', () => {
    const input = ['2026-06-06']
    const result = buildReminderSentDates(input)
    expect(result).not.toBe(input)
    result.push('2026-06-16')
    expect(input).toEqual(['2026-06-06'])
  })

  it('throws on non-string entries', () => {
    expect(() =>
      buildReminderSentDates(['2026-06-06', null as unknown as string])
    ).toThrow(/Invalid reminder date/)
  })

  it('throws on malformed formats', () => {
    expect(() => buildReminderSentDates(['01-01-2026'])).toThrow()
    expect(() => buildReminderSentDates(['2026-6-1'])).toThrow()
    expect(() => buildReminderSentDates(['yesterday'])).toThrow()
  })

  it('throws on impossible calendar dates', () => {
    expect(() => buildReminderSentDates(['2026-13-45'])).toThrow()
    expect(() => buildReminderSentDates(['2026-02-30'])).toThrow()
  })
})
