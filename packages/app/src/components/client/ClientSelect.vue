<template>
  <filtered-model-select
    :label="`${lang.client.client}`"
    :filtered-options="indexedOptions"
    :on-filter="onFilter"
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
import { computed } from 'vue'
import { useLang } from '../../lang/index.js'
import { FilteredModelSelect } from '@simsustech/quasar-components/form'

type ClientOption = {
  id?: number
  companyName?: string | null
  contactPersonName?: string | null
}

interface Props {
  filteredOptions: ClientOption[]
  onFilter?: (args: {
    ids: number[]
    searchPhrase: string
    done: (success?: boolean) => void
  }) => unknown
}
const props = defineProps<Props>()

/** Upstream expects a required `id`; runtime rows always carry one. */
const indexedOptions = computed<{ id: number; [key: string]: unknown }[]>(
  () =>
    props.filteredOptions as unknown as { id: number; [key: string]: unknown }[]
)

const lang = useLang()
</script>
