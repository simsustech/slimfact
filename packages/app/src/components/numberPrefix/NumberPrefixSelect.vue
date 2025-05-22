<template>
  <q-select
    v-bind="attrs"
    :model-value="modelValue"
    :options="options"
    :label="`${label || lang.numberPrefix.numberPrefix}${required ? '*' : ''}`"
    emit-value
    map-options
    input-debounce="500"
    :hide-selected="Number.isNaN(modelValue)"
    :rules="required ? [requiredValidation] : []"
    @update:model-value="$emit('update:model-value', $event)"
  >
  </q-select>
</template>

<script lang="ts">
export default {
  name: 'NumberPrefixSelect'
}
</script>

<script setup lang="ts">
import { QSelect } from 'quasar'
import { computed, ref, toRefs, useAttrs } from 'vue'
import { useLang } from '../../lang/index.js'
import { NumberPrefix } from '@slimfact/api/zod'

export interface Props {
  modelValue?: string | null
  filteredOptions: NumberPrefix[]
  required?: boolean
  onFilter?: unknown
  multiple?: boolean
  label?: string
}
const props = defineProps<Props>()
const attrs = useAttrs()

const lang = useLang()

const { modelValue, filteredOptions } = toRefs(props)
const options = computed(() => {
  if (filteredOptions.value.length) {
    return filteredOptions.value?.map((numberPrefix) => ({
      label: numberPrefix.name,
      value: numberPrefix.template
    }))
  }
  return []
})

const requiredValidation = ref(
  (val: unknown) =>
    (Array.isArray(val) ? !!val.length : !!val) ||
    lang.value.company.validations.fieldRequired
)
</script>
