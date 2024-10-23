<template>
  <q-dialog ref="dialogRef" @hide="onDialogHide">
    <q-card class="q-dialog-plugin">
      <q-card-section>
        {{ message }}
      </q-card-section>

      <q-card-section>
        <q-input
          :model-value="price === 0 ? '' : price / 100"
          :prefix="currencySymbols[currency]"
          type="number"
          step="0.01"
          @update:model-value="
            ($event) => (price = Math.round(Number($event) * 100))
          "
        />
      </q-card-section>
      <q-card-actions align="right">
        <q-btn color="primary" label="OK" @click="onOKClick" />
        <q-btn color="primary" label="Cancel" @click="onDialogCancel" />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { useDialogPluginComponent } from 'quasar'
import { ref } from 'vue'

export interface Props {
  message: string
  currency: 'EUR' | 'USD'
}
const price = ref(0)
defineProps<Props>()

defineEmits([
  // REQUIRED; need to specify some events that your
  // component will emit through useDialogPluginComponent()
  ...useDialogPluginComponent.emits
])

const { dialogRef, onDialogHide, onDialogOK, onDialogCancel } =
  useDialogPluginComponent()
// dialogRef      - Vue ref to be applied to QDialog
// onDialogHide   - Function to be used as handler for @hide on QDialog
// onDialogOK     - Function to call to settle dialog with "ok" outcome
//                    example: onDialogOK() - no payload
//                    example: onDialogOK({ /*...*/ }) - with payload
// onDialogCancel - Function to call to settle dialog with "cancel" outcome

// this is part of our example (so not required)
function onOKClick() {
  // on OK, it is REQUIRED to
  // call onDialogOK (with optional payload)
  onDialogOK(price.value)
  // or with payload: onDialogOK({ ... })
  // ...and it will also hide the dialog automatically
}

const currencySymbols = ref({
  EUR: '€',
  USD: '$'
})
</script>
