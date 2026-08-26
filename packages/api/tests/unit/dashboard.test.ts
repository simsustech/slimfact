import { describe, it, expect } from 'vitest'
import {
  eventTypeEnum,
  dateSchema,
  getDashboardActivityInput,
  getDashboardStatsInput
} from '../../src/zod/dashboard.js'

describe('dashboard.zod', () => {
  describe('dateSchema', () => {
    it('accepts valid YYYY-MM-DD', () => {
      expect(dateSchema.safeParse('2025-01-15').success).toBe(true)
    })

    it('rejects malformed dates', () => {
      expect(dateSchema.safeParse('2025/01/15').success).toBe(false)
      expect(dateSchema.safeParse('abc').success).toBe(false)
      expect(dateSchema.safeParse('25-01-15').success).toBe(false)
    })
  })

  describe('eventTypeEnum', () => {
    it('accepts known event types', () => {
      expect(eventTypeEnum.safeParse('invoiceOpened').success).toBe(true)
      expect(eventTypeEnum.safeParse('payment').success).toBe(true)
    })

    it('rejects unknown types', () => {
      expect(eventTypeEnum.safeParse('unknown').success).toBe(false)
    })
  })

  describe('getDashboardStatsInput', () => {
    const valid = {
      companyIds: [1, 2],
      dateFrom: '2025-01-01',
      dateTo: '2025-01-31'
    }

    it('accepts valid input', () => {
      const result = getDashboardStatsInput.safeParse(valid)
      expect(result.success).toBe(true)
    })

    it('accepts minimal input (only dates, no companies)', () => {
      const result = getDashboardStatsInput.safeParse({
        dateFrom: '2025-01-01',
        dateTo: '2025-01-31'
      })
      expect(result.success).toBe(true)
    })

    it('rejects invalid date format', () => {
      const result = getDashboardStatsInput.safeParse({
        ...valid,
        dateFrom: '2025-13-99'
      })
      expect(result.success).toBe(false)
    })

    it('rejects when dateFrom is after dateTo', () => {
      const result = getDashboardStatsInput.safeParse({
        dateFrom: '2025-02-01',
        dateTo: '2025-01-31'
      })
      expect(result.success).toBe(false)
    })

    it('accepts when dateFrom equals dateTo', () => {
      const result = getDashboardStatsInput.safeParse({
        dateFrom: '2025-01-01',
        dateTo: '2025-01-01'
      })
      expect(result.success).toBe(true)
    })

    it('rejects missing required dates', () => {
      expect(getDashboardStatsInput.safeParse({}).success).toBe(false)
    })
  })

  describe('getDashboardActivityInput', () => {
    it('defaults limit to 20 when omitted', () => {
      const result = getDashboardActivityInput.parse({})
      expect(result.limit).toBe(20)
    })

    it('accepts valid limit within bounds', () => {
      const result = getDashboardActivityInput.parse({ limit: 10 })
      expect(result.limit).toBe(10)
    })

    it('rejects limit below 1', () => {
      expect(getDashboardActivityInput.safeParse({ limit: 0 }).success).toBe(
        false
      )
    })

    it('rejects limit above 50', () => {
      expect(getDashboardActivityInput.safeParse({ limit: 100 }).success).toBe(
        false
      )
      expect(getDashboardActivityInput.safeParse({ limit: 51 }).success).toBe(
        false
      )
    })

    it('accepts eventTypes array', () => {
      const result = getDashboardActivityInput.parse({
        eventTypes: ['payment', 'invoiceOpened']
      })
      expect(result.eventTypes).toEqual(['payment', 'invoiceOpened'])
    })
  })
})
