import { describe, it, expect } from 'vitest'
import {
  buildRevenueChartDatasets,
  revenueForStatus,
  seriesDataForStatus,
  sumSeries,
  type RevenueSeries
} from '../../src/components/dashboard/revenueSeries.js'

const series: RevenueSeries = {
  labels: ['2026-08-01', '2026-08-02'],
  series: [
    { status: 'paid', data: [100, 200] },
    { status: 'bill', data: [300, 400] },
    { status: 'receipt', data: [500, 600] }
  ]
}

const LABELS = { invoices: 'Invoices', bills: 'Bills', receipts: 'Receipts' }

describe('dashboard.revenueSeries', () => {
  describe('sumSeries', () => {
    it('sums numbers', () => {
      expect(sumSeries([100, 200, 300])).toBe(600)
    })
    it('treats null/undefined values as zero', () => {
      expect(sumSeries([100, null, 200])).toBe(300)
    })
    it('returns 0 for undefined/empty', () => {
      expect(sumSeries(undefined)).toBe(0)
      expect(sumSeries([])).toBe(0)
    })
  })

  describe('seriesDataForStatus', () => {
    it('returns the data array for the requested status', () => {
      expect(seriesDataForStatus(series, 'bill')).toEqual([300, 400])
    })
    it('returns [] for a missing status', () => {
      expect(seriesDataForStatus(series, 'canceled')).toEqual([])
    })
    it('returns [] for null/undefined input', () => {
      expect(seriesDataForStatus(null, 'paid')).toEqual([])
      expect(seriesDataForStatus(undefined, 'paid')).toEqual([])
    })
  })

  describe('revenueForStatus', () => {
    it('sums the series for a status', () => {
      expect(revenueForStatus(series, 'paid')).toBe(300)
      expect(revenueForStatus(series, 'bill')).toBe(700)
      expect(revenueForStatus(series, 'receipt')).toBe(1100)
    })
    it('returns 0 for a missing status', () => {
      expect(revenueForStatus(series, 'canceled')).toBe(0)
    })
    it('returns 0 for null input', () => {
      expect(revenueForStatus(null, 'paid')).toBe(0)
    })
  })

  describe('buildRevenueChartDatasets', () => {
    it('builds one dataset per document type with matching data', () => {
      const { labels, datasets } = buildRevenueChartDatasets(series, LABELS)
      expect(labels).toEqual(['2026-08-01', '2026-08-02'])
      expect(datasets).toHaveLength(3)
      expect(datasets[0].label).toBe('Invoices')
      expect(datasets[0].data).toEqual([100, 200])
      expect(datasets[1].label).toBe('Bills')
      expect(datasets[1].data).toEqual([300, 400])
      expect(datasets[2].label).toBe('Receipts')
      expect(datasets[2].data).toEqual([500, 600])
    })
    it('maps invoices dataset to status paid (not open/concept)', () => {
      const { datasets } = buildRevenueChartDatasets(series, LABELS)
      expect(datasets[0].data).toEqual(seriesDataForStatus(series, 'paid'))
    })
    it('returns empty labels/datasets for null input', () => {
      const { labels, datasets } = buildRevenueChartDatasets(null, LABELS)
      expect(labels).toEqual([])
      expect(datasets.map((d) => d.data)).toEqual([[], [], []])
    })
    it('aligns every dataset to the same label length', () => {
      const { labels, datasets } = buildRevenueChartDatasets(series, LABELS)
      for (const d of datasets) {
        expect(d.data.length).toBe(labels.length)
      }
    })
  })
})
