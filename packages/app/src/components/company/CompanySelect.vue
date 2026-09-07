<template>
  <filtered-model-select
    :label="lang.company.company"
    :filtered-options="indexedOptions"
    :on-filter="onFilter"
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
import { computed } from 'vue'
import { useLang } from '../../lang/index.js'
import { FilteredModelSelect } from '@simsustech/quasar-components/form'

export interface Props {
  filteredOptions: readonly { id?: number }[]
  onFilter?: (args: {
    ids: number[]
    searchPhrase: string
    done: (success?: boolean) => void
  }) => unknown
}
const props = defineProps<Props>()
/** Upstream expects required id; runtime rows always carry one. */
const indexedOptions = computed<{ id: number; [key: string]: unknown }[]>(
  () =>
    props.filteredOptions as unknown as { id: number; [key: string]: unknown }[]
)

const lang = useLang()
</script>
