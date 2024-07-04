<template>
  <q-item>
    <q-item-section>
      <q-item-label overline>
        {{ modelValue.name }}
      </q-item-label>
      <q-item-label>
        {{ modelValue.template }}
      </q-item-label>
    </q-item-section>
  </q-item>
</template>

<script setup lang="ts">
import { NumberPrefix } from '@slimfact/api/zod'

export interface Props {
  modelValue: NumberPrefix
}
defineProps<Props>()
</script>
