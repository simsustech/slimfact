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
import { QSelect, useQuasar } from 'quasar'
import { computed, ref, toRefs, useAttrs, watch } from 'vue'
import { loadLang, useLang } from '../../lang/index.js'
import { NumberPrefix } from '@slimfact/api/zod'

export interface Props {
  modelValue?: string
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

const $q = useQuasar()
if (lang.value.isoName !== $q.lang.isoName) loadLang($q.lang.isoName)
watch($q.lang, (val) => {
  loadLang($q.lang.isoName)
})
</script>
