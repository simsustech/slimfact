<template>
  <filtered-model-select
    v-bind="attrs"
    :label="lang.account.name"
    :filtered-options="filteredOptions"
    label-key="email"
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
  name: 'AccountSelect'
}
</script>

<script setup lang="ts">
import { FilteredModelSelect } from '@simsustech/quasar-components/form'
import { useAttrs } from 'vue'
import { useLang } from '../../lang/index.js'

export interface Props {
  filteredOptions: { id: number; [key: string]: unknown }[]
}
defineProps<Props>()
const attrs = useAttrs()
const lang = useLang()
</script>
