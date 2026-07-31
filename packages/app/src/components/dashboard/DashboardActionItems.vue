<template>
  <q-card>
    <q-card-section>
      <div class="text-h6">{{ lang.dashboard.admin.actionItems.title }}</div>

      <q-list>
        <q-item
          v-for="item in items"
          :key="item.type"
          clickable
          @click="onItemClick(item)"
        >
          <q-item-section avatar>
            <q-icon :name="item.icon" :color="item.color" />
          </q-item-section>
          <q-item-section>
            <q-item-label>{{ item.label }}</q-item-label>
            <q-item-label caption>
              {{ item.count }} —
              <Price :model-value="item.totalAmount" currency="EUR" />
            </q-item-label>
          </q-item-section>
        </q-item>
      </q-list>
    </q-card-section>
  </q-card>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import Price from '../Price.vue'
import { useLang } from '../../lang/index.js'

export interface AgingBucket {
  count: number
  totalAmount: number
}

export interface ActionItemsProps {
  open: { count: number; totalAmount: number }
  overdue: {
    needsReminder: AgingBucket
    reminder1: AgingBucket
    reminder2: AgingBucket
    exhortation: AgingBucket
  }
}

type NavigateType = 'open' | 'overdue'

const props = defineProps<{
  items: ActionItemsProps
}>()

const emit = defineEmits<{
  navigate: [type: NavigateType, label?: string]
}>()

const lang = useLang()

const items = computed(() => [
  {
    type: 'open' as const,
    label: lang.value.dashboard.admin.actionItems.open,
    count: props.items.open.count,
    totalAmount: props.items.open.totalAmount,
    icon: 'mdi-file-document-outline',
    color: 'primary'
  },
  {
    type: 'overdue' as const,
    label: lang.value.dashboard.admin.actionItems.overdue.needsReminder,
    count: props.items.overdue.needsReminder.count,
    totalAmount: props.items.overdue.needsReminder.totalAmount,
    icon: 'mdi-bell-outline',
    color: 'orange',
    labelKey: 'needsReminder'
  },
  {
    type: 'overdue' as const,
    label: lang.value.dashboard.admin.actionItems.overdue.reminder1,
    count: props.items.overdue.reminder1.count,
    totalAmount: props.items.overdue.reminder1.totalAmount,
    icon: 'mdi-bell-ring-outline',
    color: 'deep-orange',
    labelKey: 'reminder1'
  },
  {
    type: 'overdue' as const,
    label: lang.value.dashboard.admin.actionItems.overdue.reminder2,
    count: props.items.overdue.reminder2.count,
    totalAmount: props.items.overdue.reminder2.totalAmount,
    icon: 'mdi-bell-alert-outline',
    color: 'red',
    labelKey: 'reminder2'
  },
  {
    type: 'overdue' as const,
    label: lang.value.dashboard.admin.actionItems.overdue.exhortation,
    count: props.items.overdue.exhortation.count,
    totalAmount: props.items.overdue.exhortation.totalAmount,
    icon: 'mdi-alert-octagon-outline',
    color: 'red-10',
    labelKey: 'exhortation'
  }
])

const onItemClick = (item: { type: NavigateType; labelKey?: string }) => {
  emit('navigate', item.type, item.labelKey)
}
</script>
