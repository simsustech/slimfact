// MUST STAY IN SYNC with packages/app/src/dashboard/aging.ts.
// The reminderCount → bucket mapping is duplicated on the frontend
// (DashboardPage.vue computed `actionItems` if/else cascade) until a
// `@slimfact/tools/dashboard` subpath export is added.
export const AGING_LABELS = ['needsReminder', 'reminder1', 'reminder2'] as const

export const agingLabelForReminderCount = (
  reminderCount: number
): 'needsReminder' | 'reminder1' | 'reminder2' | 'exhortation' => {
  if (reminderCount >= 3) return 'exhortation'
  const clamped = Math.min(Math.max(reminderCount, 0), AGING_LABELS.length - 1)
  return AGING_LABELS[clamped]!
}

export const EXHORTATION_THRESHOLD = 3
