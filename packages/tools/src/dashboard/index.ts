// Aging buckets for overdue invoices: reminderCount -> label mapping.
// Single source of truth - both the api trpc and the app import this from
// @slimfact/tools/dashboard so the mapping can never diverge.

export const AGING_LABELS = ['needsReminder', 'reminder1', 'reminder2'] as const

export const agingLabelForReminderCount = (
  reminderCount: number
): 'needsReminder' | 'reminder1' | 'reminder2' | 'exhortation' => {
  if (reminderCount >= 3) return 'exhortation'
  const clamped = Math.min(Math.max(reminderCount, 0), AGING_LABELS.length - 1)
  return AGING_LABELS[clamped]!
}

export const EXHORTATION_THRESHOLD = 3
