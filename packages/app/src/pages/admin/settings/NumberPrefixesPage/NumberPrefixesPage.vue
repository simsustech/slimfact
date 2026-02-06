<template>
  <q-page padding>
    <div v-if="ready" class="row">
      <q-list>
        <number-prefix-item
          v-for="numberPrefix in numberPrefixes"
          :key="numberPrefix.id"
          :model-value="numberPrefix"
        />
      </q-list>
    </div>
  </q-page>

  <responsive-dialog
    ref="updateDialogRef"
    :icons="{ close: 'i-mdi-close' }"
    padding
    persistent
    @submit="update"
  >
    <number-prefix-form
      ref="updateNumberPrefixFormRef"
      @submit="updateNumberPrefix"
    ></number-prefix-form>
  </responsive-dialog>
  <responsive-dialog
    ref="createDialogRef"
    :icons="{ close: 'i-mdi-close' }"
    padding
    persistent
    @submit="create"
  >
    <number-prefix-form
      ref="createNumberPrefixFormRef"
      @submit="createNumberPrefix"
    ></number-prefix-form>
  </responsive-dialog>
</template>

<script lang="ts">
export default {
  name: 'AdminNumberPrefixesPage'
}
</script>

<script setup lang="ts">
import { ref, onMounted, inject } from 'vue'
import { type EventBus } from 'quasar'
import { ResourcePage, ResponsiveDialog } from '@simsustech/quasar-components'
import NumberPrefixForm from '../../../../components/numberPrefix/NumberPrefixForm.vue'
import NumberPrefixItem from '../../../../components/numberPrefix/NumberPrefixItem.vue'
import {
  useAdminCreateNumberPrefixMutation,
  useAdminGetNumberPrefixesQuery,
  useAdminUpdateNumberPrefixMutation
} from 'src/queries/admin/numberPrefixes.js'

const bus = inject<EventBus>('bus')!
bus.on('administrator-settings-open-number-prefixes-create-dialog', () => {
  if (openCreateDialog)
    openCreateDialog({
      done: () => {}
    })
})

const { numberPrefixes, refetch: execute } = useAdminGetNumberPrefixesQuery()

const { mutateAsync: createNumberPrefixMutation } =
  useAdminCreateNumberPrefixMutation()
const { mutateAsync: updateNumberPrefixMutation } =
  useAdminUpdateNumberPrefixMutation()

const updateNumberPrefixFormRef = ref<typeof NumberPrefixForm>()
const createNumberPrefixFormRef = ref<typeof NumberPrefixForm>()
const updateDialogRef = ref<typeof ResponsiveDialog>()
const createDialogRef = ref<typeof ResponsiveDialog>()

// const openUpdateDialog: InstanceType<
//   typeof ResourcePage
// >['$props']['onUpdate'] = ({ data }) => {
//   updateDialogRef.value?.functions.open()
//   nextTick(() => {
//     updateNumberPrefixFormRef.value?.functions.setValue(data)
//   })
// }

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
  try {
    await updateNumberPrefixMutation(data)

    done()
  } catch (e) {}
}

const createNumberPrefix: InstanceType<
  typeof NumberPrefixForm
>['$props']['onSubmit'] = async ({ data, done }) => {
  try {
    await createNumberPrefixMutation(data)

    done()
  } catch (e) {}
}

const ready = ref<boolean>(false)
onMounted(async () => {
  await execute()
  ready.value = true
})
</script>
