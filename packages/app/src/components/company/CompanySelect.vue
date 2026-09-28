<template>
  <filtered-model-select
    :label="lang.company.company"
    :filtered-options="
      filteredOptions as { id: number; [key: string]: unknown }[]
    "
    label-key="name"
    @filter="onFilter"
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
   * `@filter` handlers. MUST be forwarded to FilteredModelSelect (see the
   * `@filter` binding in the template): declaring it as a prop here intercepts
   * the listener out of $attrs, and without the forward FilteredModelSelect's
   * `use-input` goes false (readonly field, cannot search) and its filter
   * emit reaches nobody (searchPhrase never refreshes → stale results).
   */
  onFilter?: (args: {
    searchPhrase: string
    done: (success?: boolean) => void
  }) => unknown
}
defineProps<Props>()

const lang = useLang()
</script>
