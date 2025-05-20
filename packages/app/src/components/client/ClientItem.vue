<template>
  <q-item>
    <q-item-section>
      <q-item-label overline>
        {{ modelValue.email }}
      </q-item-label>
      <q-item-label>
        {{ modelValue.companyName || modelValue.contactPersonName }}
      </q-item-label>
      <q-item-label caption>
        {{
          `${modelValue.address} ${modelValue.postalCode}, ${modelValue.city}`
        }}
      </q-item-label>
    </q-item-section>
    <q-item-section side>
      <q-item-label>
        <q-btn
          v-if="showUpdateButton"
          icon="i-mdi-edit"
          @click="update(modelValue)"
        />
      </q-item-label>
    </q-item-section>
  </q-item>
</template>

<script setup lang="ts">
import type { ClientDetails } from '@modular-api/fastify-checkout'

export interface Props {
  modelValue: ClientDetails
  showUpdateButton?: boolean
}
defineProps<Props>()

const emit = defineEmits<{
  (
    e: 'update',
    {
      data,
      done
    }: {
      data: ClientDetails
      done: (success?: boolean) => void
    }
  ): void
}>()

const update = (data: ClientDetails) => {
  function done() {
    //
  }
  emit('update', { data, done })
}
</script>
