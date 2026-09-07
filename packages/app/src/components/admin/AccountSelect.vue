<template>
  <filtered-model-select
    v-bind="attrs"
    :label="lang.account.name"
    :filtered-options="indexedOptions"
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
import { computed, useAttrs } from 'vue'
import { useLang } from '../../lang/index.js'

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
const attrs = useAttrs()
const lang = useLang()
</script>
