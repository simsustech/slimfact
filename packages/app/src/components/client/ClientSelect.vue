<template>
  <filtered-model-select
    :label="`${lang.client.client}`"
    :filtered-options="
      filteredOptions as { id: number; [key: string]: unknown }[]
    "
    label-key="companyName"
    :label-function="
      (option: unknown) => {
        const o = option as {
          companyName?: string | null
          contactPersonName?: string | null
        }
        return `${o.companyName || o.contactPersonName}`
      }
    "
  >
    <template
      v-for="(slot, index) of Object.keys($slots)"
      :key="index"
      #[slot]="scope"
    >
      <slot :scope="scope" :name="slot"></slot>
    </template>
    <template #no-option>
      <q-item>
        <q-item-section class="text-italic text-gray">
          {{ lang.noResultsAvailable }}
          <router-link to="/admin/clients">{{
            lang.client.messages.addClient
          }}</router-link>
        </q-item-section>
      </q-item>
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
  filteredOptions: readonly { id?: number }[]
  /**
   * Typed for parents that reference `$props['onFilter']` when typing their
   * `@filter` handlers. Not forwarded as FilteredModelSelect's onFilter prop:
   * parents pass `@filter` which binds to FilteredModelSelect's own filter
   * emit (plain dropdown stays open); typing-to-filter is driven by
   * FilteredModelSelect's filter emit reaching the parent's handler.
   */
  onFilter?: (args: {
    searchPhrase: string
    done: (success?: boolean) => void
  }) => unknown
}
defineProps<Props>()

const lang = useLang()
</script>
