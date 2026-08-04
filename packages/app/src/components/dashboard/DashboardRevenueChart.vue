<template>
  <div class="dashboard-revenue-chart">
    <Line v-if="hasData" :data="chartData" :options="chartOptions" />
    <div v-else class="empty-chart">
      {{ lang.dashboard.admin.revenue.chart.noData }}
    </div>
    <div v-if="hasData && binLabel" class="chart-caption">
      {{ binLabel }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Line } from 'vue-chartjs'
import {
  Chart as ChartJS,
  Title,
  Tooltip,
  Legend,
  LineElement,
  PointElement,
  CategoryScale,
  LinearScale,
  Filler
} from 'chart.js'
import { useLang } from '../../lang/index.js'

ChartJS.register(
  Title,
  Tooltip,
  Legend,
  LineElement,
  PointElement,
  CategoryScale,
  LinearScale,
  Filler
)

export interface Props {
  labels: string[]
  datasets: {
    label: string
    data: number[]
    borderColor: string
    backgroundColor: string
  }[]
  currency?: string
  binLabel?: string
}

const props = withDefaults(defineProps<Props>(), { currency: '€' })

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
    borderColor: dataset.borderColor,
    backgroundColor: dataset.backgroundColor,
    tension: 0.3,
    pointRadius: 3,
    pointHoverRadius: 5,
    fill: false
  }))
}))

const formatCurrency = (value: number | string): string => {
  const num = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(num)) return ''
  // Amounts are stored in cents; convert to whole units for display.
  const units = num / 100
  const fixed = Math.round(units * 100) / 100
  const [intPart, decPart] = fixed.toFixed(2).split('.')
  const withThousands = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return decPart
    ? `${props.currency} ${withThousands}.${decPart}`
    : `${props.currency} ${withThousands}`
}

const chartOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  interaction: { mode: 'index' as const, intersect: false },
  plugins: {
    legend: {
      position: 'bottom' as const
    },
    tooltip: {
      callbacks: {
        label: (ctx: { dataset: { label?: string }; parsed: { y: number } }) =>
          `${ctx.dataset.label ?? ''}: ${formatCurrency(ctx.parsed.y)}`
      }
    }
  },
  scales: {
    x: {
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
        callback: (value: number | string) => formatCurrency(value)
      }
    }
  }
}))
</script>

<style scoped>
.dashboard-revenue-chart {
  height: 280px;
  width: 100%;
}
.empty-chart {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: rgba(0, 0, 0, 0.6);
  font-style: italic;
}
</style>
.chart-caption { margin-top: 8px; text-align: center; color: rgba(0, 0, 0, 0.6);
font-size: 0.85rem; font-style: italic; }
