<template>
  <resource-page
    type="create"
    @create="openCreateDialog"
    @update="openUpdateDialog"
  >
    <template #header>
      {{ lang.numberPrefix.title }}
    </template>
    <div v-if="ready" class="row">
      <q-list>
        <number-prefix-item
          v-for="numberPrefix in data"
          :key="numberPrefix.id"
          :model-value="numberPrefix"
        />
      </q-list>
    </div>

    <responsive-dialog
      padding
      ref="updateDialogRef"
      persistent
      @submit="update"
    >
      <number-prefix-form
        ref="updateNumberPrefixFormRef"
        @submit="updateNumberPrefix"
      ></number-prefix-form>
    </responsive-dialog>
    <responsive-dialog
      padding
      ref="createDialogRef"
      persistent
      @submit="create"
    >
      <number-prefix-form
        ref="createNumberPrefixFormRef"
        @submit="createNumberPrefix"
      ></number-prefix-form>
    </responsive-dialog>
  </resource-page>
</template>

<script lang="ts">
export default {
  name: 'AdminNumberPrefixesPage'
}
</script>

<script setup lang="ts">
import { ref, nextTick, onMounted } from 'vue'
import { createUseTrpc } from '../../trpc.js'
import { ResourcePage, ResponsiveDialog } from '@simsustech/quasar-components'
import NumberPrefixForm from '../../components/numberPrefix/NumberPrefixForm.vue'
import NumberPrefixItem from '../../components/numberPrefix/NumberPrefixItem.vue'
import { useLang } from '../../lang/index.js'
const { useQuery, useMutation } = await createUseTrpc()

const lang = useLang()

const { data, execute } = useQuery('admin.getNumberPrefixes', {
  // immediate: true
})

const updateNumberPrefixFormRef = ref<typeof NumberPrefixForm>()
const createNumberPrefixFormRef = ref<typeof NumberPrefixForm>()
const updateDialogRef = ref<typeof ResponsiveDialog>()
const createDialogRef = ref<typeof ResponsiveDialog>()

const openUpdateDialog: InstanceType<
  typeof ResourcePage
>['$props']['onUpdate'] = ({ data }) => {
  updateDialogRef.value?.functions.open()
  nextTick(() => {
    updateNumberPrefixFormRef.value?.functions.setValue(data)
  })
}

const openCreateDialog: InstanceType<
  typeof ResourcePage
>['$props']['onCreate'] = () => {
  createDialogRef.value?.functions.open()
}

const update: InstanceType<
  typeof ResponsiveDialog
>['$props']['onSubmit'] = async ({ done }) => {
  const afterUpdate = (success?: boolean) => {
    done(success)
    execute()
  }
  updateNumberPrefixFormRef.value?.functions.submit({ done: afterUpdate })
}

const create: InstanceType<
  typeof ResponsiveDialog
>['$props']['onSubmit'] = async ({ done }) => {
  const afterCreate = (success?: boolean) => {
    done(success)
    execute()
  }
  createNumberPrefixFormRef.value?.functions.submit({ done: afterCreate })
}

const updateNumberPrefix: InstanceType<
  typeof NumberPrefixForm
>['$props']['onSubmit'] = async ({ data, done }) => {
  const result = useMutation('admin.updateNumberPrefix', {
    args: data,
    immediate: true
  })

  await result.immediatePromise

  done(!result.error.value)
}

const createNumberPrefix: InstanceType<
  typeof NumberPrefixForm
>['$props']['onSubmit'] = async ({ data, done }) => {
  const result = useMutation('admin.createNumberPrefix', {
    args: data,
    immediate: true
  })

  await result.immediatePromise

  done(!result.error.value)
}

const ready = ref<boolean>(false)
onMounted(async () => {
  await execute()
  ready.value = true
})
</script>
