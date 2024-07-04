<template>
  <filtered-model-select
    :label="lang.company.company"
    :filtered-options="filteredOptions"
    label-key="name"
  >
    <template
      v-for="(slot, index) of Object.keys($slots)"
      :key="index"
      #[slot]="scope"
    >
      <slot :scope="scope" :name="slot"></slot>
    </template>
  </filtered-model-select>
</template>

<script lang="ts">
export default {
  name: 'CompanySelect'
}
</script>

<script setup lang="ts">
import { useLang } from '../../lang/index.js'
import { FilteredModelSelect } from '@simsustech/quasar-components/form'

export interface Props {
  filteredOptions: { id: number; [key: string]: unknown }[]
}
defineProps<Props>()

const lang = useLang()
</script>
