<template>
  <filtered-model-select
    :label="lang.company.company"
    :filtered-options="
      filteredOptions as { id: number; [key: string]: unknown }[]
    "
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
  filteredOptions: readonly { id?: number }[]
  /**
   * Typed for parents that reference `$props['onFilter']` when typing their
   * `@filter` handlers. Not forwarded as FilteredModelSelect's onFilter prop:
   * parents pass `@filter` which binds to FilteredModelSelect's own filter
   * emit (plain dropdown stays open).
   */
  onFilter?: (args: {
    searchPhrase: string
    done: (success?: boolean) => void
  }) => unknown
}
defineProps<Props>()

const lang = useLang()
</script>
