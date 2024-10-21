<template>
  <filtered-model-select
    :label="`${lang.client.client}`"
    :filtered-options="filteredOptions"
    label-key="companyName"
    :label-function="
      (option) => `${option.companyName || option.contactPersonName}`
    "
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
  name: 'ClientSelect'
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
