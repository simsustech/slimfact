import { describe, it, expect } from 'vitest'
import {
  AGING_LABELS,
  agingLabelForReminderCount,
  EXHORTATION_THRESHOLD
} from '@slimfact/tools/dashboard'

describe('dashboard.aging.agingLabelForReminderCount', () => {
  it('maps reminder counts to the four action-item buckets', () => {
    expect(agingLabelForReminderCount(0)).toBe('needsReminder')
    expect(agingLabelForReminderCount(1)).toBe('reminder1')
    expect(agingLabelForReminderCount(2)).toBe('reminder2')
    expect(agingLabelForReminderCount(3)).toBe('exhortation')
  })

  it('clamps counts beyond the exhortation threshold', () => {
    // The backend clamps reminder_sent_dates length to 3, but the mapping
    // should be safe for any larger input.
    expect(agingLabelForReminderCount(4)).toBe('exhortation')
    expect(agingLabelForReminderCount(10)).toBe('exhortation')
  })

  it('clamps negative counts to needsReminder', () => {
    expect(agingLabelForReminderCount(-1)).toBe('needsReminder')
  })

  it('exposes a consistent label list and threshold', () => {
    expect(AGING_LABELS).toEqual(['needsReminder', 'reminder1', 'reminder2'])
    expect(EXHORTATION_THRESHOLD).toBe(3)
    // Buckets = 3 labels + 1 exhortation bucket.
    expect(AGING_LABELS.length + 1).toBe(4)
  })
})
