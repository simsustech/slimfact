<template>
  <q-form ref="formRef">
    <div class="row">
      <form-input
        v-bind="input"
        v-model="modelValue.name"
        class="col-md-3 col-12"
        required
        field="name"
        bottom-slots
        lazy-rules
        name="name"
      />
      <form-input
        v-bind="input"
        v-model="modelValue.template"
        :label="lang.numberPrefix.fields.template"
        class="col-md-3 col-12"
        required
        bottom-slots
        lazy-rules
        name="template"
      />
    </div>
  </q-form>
</template>

<script setup lang="ts">
import { type QFormProps, type QInputProps, type QForm, extend } from 'quasar'
import { useLang } from '../../lang/index.js'
import { ref } from 'vue'
import { type ResponsiveDialog } from '@simsustech/quasar-components'
import { FormInput } from '@simsustech/quasar-components/form'
import { NumberPrefix } from '@slimfact/api/zod'

export interface Props {
  form?: QFormProps & Partial<HTMLFormElement> & Partial<HTMLDivElement>
  input?: Omit<
    QInputProps,
    | 'id'
    | 'name'
    | 'modelValue'
    | 'label'
    | 'rules'
    | 'type'
    | 'lazy-rules'
    | 'autofocus'
    | ('label' & { style?: Partial<CSSStyleDeclaration> })
  >
}
defineProps<Props>()
const emit = defineEmits<{
  (
    e: 'submit',
    {
      data,
      done
    }: {
      data: NumberPrefix
      done: (success?: boolean) => void
    }
  ): void
}>()

const initialValue: NumberPrefix = {
  name: '',
  template: ''
}

const modelValue = ref<NumberPrefix>(initialValue)

// const $q = useQuasar()
const lang = useLang()

const formRef = ref<QForm>()

const setValue = (newValue: NumberPrefix) => {
  modelValue.value = extend({}, initialValue, newValue)
}

const submit: InstanceType<typeof ResponsiveDialog>['$props']['onSubmit'] = ({
  done
}) => {
  formRef.value?.validate().then((success) => {
    if (success) {
      return emit('submit', {
        data: modelValue.value,
        done
      })
    }
  })
  done(false)
}

const functions = ref({
  submit,
  setValue
})
defineExpose({
  functions
})
</script>
