<template>
  <q-card>
    <q-card-section>
      <div class="text-h6">
        {{ lang.dashboard.admin.statusChart.title }}
      </div>
      <div class="dashboard-status-chart">
        <Doughnut v-if="hasData" :data="chartData" :options="chartOptions" />
        <div v-else class="empty-chart">
          {{ lang.dashboard.admin.empty.noData }}
        </div>
      </div>
    </q-card-section>
  </q-card>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Doughnut } from 'vue-chartjs'
import {
  Chart as ChartJS,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  CategoryScale,
  LinearScale
} from 'chart.js'
import { useLang } from '../../lang/index.js'

ChartJS.register(Title, Tooltip, Legend, ArcElement, CategoryScale, LinearScale)

export interface Props {
  labels: string[]
  counts: number[]
  totalAmounts: number[]
}

const props = defineProps<Props>()

const lang = useLang()

const STATUS_COLORS = [
  '#9e9e9e',
  '#2196f3',
  '#4caf50',
  '#ff9800',
  '#f44336',
  '#607d8b',
  '#795548'
] as const

const hasData = computed(() => props.counts.some((count) => count > 0))

const chartData = computed(() => ({
  labels: props.labels,
  datasets: [
    {
      backgroundColor: STATUS_COLORS.slice(0, props.labels.length),
      data: props.counts
    }
  ]
}))

const formatAmount = (amount: number) =>
  new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 2,
    style: 'currency',
    currency: 'EUR'
  }).format(amount / 100)

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: 'bottom' as const
    },
    tooltip: {
      callbacks: {
        label: (ctx: { dataIndex: number; label: string; parsed: number }) => {
          const index = ctx.dataIndex
          const count = props.counts[index] ?? 0
          const amount = props.totalAmounts[index] ?? 0
          return `${ctx.label}: ${count} — ${formatAmount(amount)}`
        }
      }
    }
  }
}
</script>

<style scoped>
.dashboard-status-chart {
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
