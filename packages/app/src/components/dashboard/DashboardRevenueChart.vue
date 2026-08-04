<template>
  <div class="dashboard-revenue-chart" :data-chart-labels="labels.join('|')">
    <div class="chart-canvas-wrap">
      <Bar v-if="hasData" :data="chartData" :options="chartOptions" />
      <div v-else class="empty-chart">
        {{ lang.dashboard.admin.revenue.chart.noData }}
      </div>
    </div>
    <div v-if="hasData && binLabel" class="chart-caption">
      {{ binLabel }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Bar } from 'vue-chartjs'
import {
  Chart as ChartJS,
  Title,
  Tooltip,
  Legend,
  BarElement,
  CategoryScale,
  LinearScale
} from 'chart.js'
import { useLang } from '../../lang/index.js'
import { formatPrice } from '@slimfact/tools'

ChartJS.register(Title, Tooltip, Legend, BarElement, CategoryScale, LinearScale)

export interface Props {
  labels: string[]
  datasets: {
    label: string
    data: number[]
    borderColor: string
    backgroundColor: string
  }[]
  buckets?: { start: string; end: string }[]
  binLabel?: string
}

const props = defineProps<Props>()

const emit = defineEmits<{
  select: [range: { start: string; end: string }]
}>()

const lang = useLang()

const hasData = computed(() => {
  return (
    props.labels.length > 0 &&
    props.datasets.length > 0 &&
    props.datasets.some((dataset) => dataset.data.some((v) => v > 0))
  )
})

const chartData = computed(() => ({
  labels: props.labels,
  datasets: props.datasets.map((dataset) => ({
    label: dataset.label,
    data: dataset.data,
    backgroundColor: dataset.backgroundColor,
    borderColor: dataset.borderColor,
    borderWidth: 1
  }))
}))

// Amounts are stored in cents; formatPrice converts to whole units using
// the current locale (with the currency symbol, e.g. "€ 1.234,56").
const formatChartPrice = (value: number | string): string =>
  formatPrice({
    value: Number(value),
    locale: lang.value.isoName,
    includeSymbol: true
  })

const chartOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  interaction: { mode: 'index' as const, intersect: false },
  // The interaction mode above ('index', intersect: false) makes ANY click
  // within a category's x-band select that category, so the whole bar
  // column is a click target for zooming into that period.
  onClick: (_event: unknown, elements: { index?: number }[]) => {
    const index = elements[0]?.index
    const bucket = index === undefined ? undefined : props.buckets?.[index]
    if (bucket) emit('select', bucket)
  },
  onHover: (
    event: { native?: { target?: { style?: { cursor?: string } } } },
    elements: unknown[]
  ) => {
    const target = event.native?.target as HTMLElement | null
    if (target)
      target.style.cursor = elements.length > 0 ? 'pointer' : 'default'
  },
  plugins: {
    legend: {
      position: 'bottom' as const
    },
    tooltip: {
      callbacks: {
        label: (ctx: { dataset: { label?: string }; parsed: { y: number } }) =>
          `${ctx.dataset.label ?? ''}: ${formatChartPrice(ctx.parsed.y)}`
      }
    }
  },
  scales: {
    x: {
      stacked: false,
      title: {
        display: true,
        text: lang.value.dashboard.admin.revenue.chart.title
      }
    },
    y: {
      beginAtZero: true,
      title: {
        display: true,
        text: lang.value.dashboard.admin.revenue.chart.title
      },
      ticks: {
        callback: (value: number | string) => formatChartPrice(value)
      }
    }
  }
}))
</script>

<style scoped>
.dashboard-revenue-chart {
  width: 100%;
}
/* The canvas wrapper has a fixed height: with maintainAspectRatio: false
   and no height constraint the canvas grows unboundedly on every refetch. */
.chart-canvas-wrap {
  height: 280px;
  position: relative;
}
.empty-chart {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: rgba(0, 0, 0, 0.6);
  font-style: italic;
}
.chart-caption {
  margin-top: 8px;
  text-align: center;
  color: rgba(0, 0, 0, 0.6);
  font-size: 0.85rem;
  font-style: italic;
}
</style>
