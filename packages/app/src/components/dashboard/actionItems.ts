// Action-item aggregation for the dashboard.
// Sums the per-company statusCounts / overdueAging rows (from
// getDashboardStats) into the single ActionItemsProps shape shown in the
// action items card. Kept in a plain module so unit tests can verify the
// multi-company aggregation (a past bug used .find()/assignment and only
// kept the FIRST company's row per bucket).

import { agingLabelForReminderCount } from '../../dashboard/aging.js'

export interface AggBucket {
  count: number
  totalAmount: number
}

export interface ActionItemsData {
  open: AggBucket
  overdue: {
    needsReminder: AggBucket
    reminder1: AggBucket
    reminder2: AggBucket
    exhortation: AggBucket
  }
}

export interface StatusCountRow {
  companyId: number | null
  companyName: string | null
  status: string
  count: number | string
  totalAmount: number | string
}

export interface OverdueAgingRow {
  companyId: number | null
  companyName: string | null
  reminderCount: number
  count: number | string
  totalAmount: number | string
}

const empty = (): AggBucket => ({ count: 0, totalAmount: 0 })

// Sum rows for a status across all companies. count/totalAmount arrive as
// strings from Postgres (count(*) is bigint), so coerce to numbers.
const sumStatus = (rows: StatusCountRow[], status: string): AggBucket =>
  rows
    .filter((row) => row.status === status)
    .reduce<AggBucket>(
      (acc, row) => ({
        count: acc.count + Number(row.count),
        totalAmount: acc.totalAmount + Number(row.totalAmount)
      }),
      empty()
    )

// Sum overdue-aging rows per reminder bucket across all companies.
const sumAging = (rows: OverdueAgingRow[]): ActionItemsData['overdue'] => {
  const buckets: ActionItemsData['overdue'] = {
    needsReminder: empty(),
    reminder1: empty(),
    reminder2: empty(),
    exhortation: empty()
  }
  for (const row of rows) {
    const bucket = agingLabelForReminderCount(row.reminderCount)
    buckets[bucket].count += Number(row.count)
    buckets[bucket].totalAmount += Number(row.totalAmount)
  }
  return buckets
}

export const aggregateActionItems = (
  statusCounts: StatusCountRow[],
  overdueAging: OverdueAgingRow[]
): ActionItemsData => ({
  open: sumStatus(statusCounts, 'open'),
  overdue: sumAging(overdueAging)
})

// Combined overdue total (all four reminder buckets) so the dashboard can
// show "upcoming + overdue = outstanding".
export const sumOverdueBuckets = (
  overdue: ActionItemsData['overdue']
): AggBucket => ({
  count:
    overdue.needsReminder.count +
    overdue.reminder1.count +
    overdue.reminder2.count +
    overdue.exhortation.count,
  totalAmount:
    overdue.needsReminder.totalAmount +
    overdue.reminder1.totalAmount +
    overdue.reminder2.totalAmount +
    overdue.exhortation.totalAmount
})
