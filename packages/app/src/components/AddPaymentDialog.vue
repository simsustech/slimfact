<template>
  <q-dialog ref="dialogRef" @hide="onDialogHide">
    <q-card class="q-dialog-plugin">
      <q-card-section>
        {{ message }}
      </q-card-section>

      <q-card-section>
        <q-form ref="formRef">
          <q-input
            :model-value="amount === 0 ? '' : amount / 100"
            :prefix="currencySymbols[currency]"
            type="number"
            step="0.01"
            :rules="rules"
            @update:model-value="
              ($event) => (amount = Math.round(Number($event) * 100))
            "
          >
            <template #append>
              <q-btn
                icon="i-mdi-dollar"
                outline
                @click="amount = totalIncludingTax"
              />
            </template>
          </q-input>
          <q-input
            v-model="transactionReference"
            :label="lang.payment.fields.transactionReference"
          />
        </q-form>
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
import { useLang } from '../lang/index.js'

export interface Props {
  message: string
  currency: 'EUR' | 'USD'
  totalIncludingTax?: number
}
const amount = ref(0)
const transactionReference = ref('')

defineProps<Props>()
const lang = useLang()

const rules = ref([(val: number) => !!val])

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
  onDialogOK({
    amount: amount.value,
    transactionReference: transactionReference.value
  })
  // or with payload: onDialogOK({ ... })
  // ...and it will also hide the dialog automatically
}

const currencySymbols = ref({
  EUR: '€',
  USD: '$'
})
</script>
