<template>
  <div class="dashboard-revenue-chart">
    <Bar v-if="hasData" :data="chartData" :options="chartOptions" />
    <div v-else class="empty-chart">
      {{ lang.dashboard.admin.empty.noData }}
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

ChartJS.register(Title, Tooltip, Legend, BarElement, CategoryScale, LinearScale)

export interface Props {
  labels: string[]
  datasets: {
    label: string
    data: number[]
    backgroundColor: string
  }[]
}

const props = defineProps<Props>()

const lang = useLang()

const hasData = computed(() => {
  return (
    props.datasets.length > 0 &&
    props.datasets.some((dataset) => dataset.data.length > 0)
  )
})

const chartData = computed(() => ({
  labels: props.labels,
  datasets: props.datasets.map((dataset) => ({
    label: dataset.label,
    data: dataset.data,
    backgroundColor: dataset.backgroundColor
  }))
}))

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: 'bottom' as const
    }
  },
  scales: {
    y: {
      beginAtZero: true
    }
  }
}
</script>

<style scoped>
.dashboard-revenue-chart {
  height: 240px;
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
