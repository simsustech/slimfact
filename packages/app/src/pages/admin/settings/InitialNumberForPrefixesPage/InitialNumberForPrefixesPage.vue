<template>
  <q-page padding>
    <div v-if="ready" class="row">
      <q-list>
        <initial-number-for-prefix-item
          v-for="initialNumberForPrefix in initialNumbers"
          :key="initialNumberForPrefix.id"
          :model-value="initialNumberForPrefix"
        />
      </q-list>
    </div>
  </q-page>

  <responsive-dialog
    :icons="{ close: 'i-mdi-close' }"
    padding
    ref="updateDialogRef"
    persistent
    @submit="update"
  >
    <initial-number-for-prefix-form
      ref="updateInitialNumberForPrefixFormRef"
      :filtered-companies="filteredCompanies"
      @submit="updateInitialNumberForPrefix"
      @filter:companies="onFilterCompanies"
    ></initial-number-for-prefix-form>
  </responsive-dialog>
  <responsive-dialog
    :icons="{ close: 'i-mdi-close' }"
    padding
    ref="createDialogRef"
    persistent
    @submit="create"
  >
    <initial-number-for-prefix-form
      ref="createInitialNumberForPrefixFormRef"
      :filtered-companies="filteredCompanies"
      @submit="createInitialNumberForPrefix"
      @filter:companies="onFilterCompanies"
    ></initial-number-for-prefix-form>
  </responsive-dialog>
</template>

<script lang="ts">
export default {
  name: 'AdmininitialNumberForPrefixesPage'
}
</script>

<script setup lang="ts">
import { ref, onMounted, inject } from 'vue'
import { ResourcePage, ResponsiveDialog } from '@simsustech/quasar-components'
import InitialNumberForPrefixItem from '../../../../components/numberPrefix/InitialNumberForPrefixItem.vue'
import InitialNumberForPrefixForm from '../../../../components/numberPrefix/InitialNumberForPrefixForm.vue'
import {
  useAdminCreateInitialNumberForPrefixMutation,
  useAdminGetInitialNumberForPrefixesQuery,
  useAdminUpdateInitialNumberForPrefixMutation
} from 'src/queries/admin/numberPrefixes'
import { useAdminSearchCompaniesQuery } from 'src/queries/admin/companies'
import { EventBus } from 'quasar'

const bus = inject<EventBus>('bus')!
bus.on(
  'administrator-settings-open-initial-number-for-prefixes-create-dialog',
  () => {
    if (openCreateDialog)
      openCreateDialog({
        done: () => {}
      })
  }
)

const { initialNumbers, refetch: execute } =
  useAdminGetInitialNumberForPrefixesQuery()

// const { data, execute } = useQuery('admin.getInitialNumberForPrefixes', {
//   // immediate: true
// })

const updateInitialNumberForPrefixFormRef =
  ref<typeof InitialNumberForPrefixForm>()
const createInitialNumberForPrefixFormRef =
  ref<typeof InitialNumberForPrefixForm>()
const updateDialogRef = ref<typeof ResponsiveDialog>()
const createDialogRef = ref<typeof ResponsiveDialog>()

// const openUpdateDialog: InstanceType<
//   typeof ResourcePage
// >['$props']['onUpdate'] = ({ data }) => {
//   updateDialogRef.value?.functions.open()
//   nextTick(() => {
//     updateInitialNumberForPrefixFormRef.value?.functions.setValue(data)
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
  updateInitialNumberForPrefixFormRef.value?.functions.submit({
    done: afterUpdate
  })
}

const create: InstanceType<
  typeof ResponsiveDialog
>['$props']['onSubmit'] = async ({ done }) => {
  const afterCreate = (success?: boolean) => {
    done(success)
    execute()
  }
  createInitialNumberForPrefixFormRef.value?.functions.submit({
    done: afterCreate
  })
}

const { mutateAsync: createInitialNumberForPrefixMutation } =
  useAdminCreateInitialNumberForPrefixMutation()
const { mutateAsync: updateInitialNumberForPrefixMutation } =
  useAdminUpdateInitialNumberForPrefixMutation()

const updateInitialNumberForPrefix: InstanceType<
  typeof InitialNumberForPrefixForm
>['$props']['onSubmit'] = async ({ data, done }) => {
  try {
    if (data.id) {
      await updateInitialNumberForPrefixMutation(data)
    }

    done()
  } catch (e) {}
}

const createInitialNumberForPrefix: InstanceType<
  typeof InitialNumberForPrefixForm
>['$props']['onSubmit'] = async ({ data, done }) => {
  try {
    await createInitialNumberForPrefixMutation(data)

    done()
  } catch (e) {}
}

const {
  companies: filteredCompanies,
  searchPhrase: companiesSearchPhrase,
  refetch: refetchFilteredCompanies
} = useAdminSearchCompaniesQuery()

const onFilterCompanies: InstanceType<
  typeof InitialNumberForPrefixForm
>['$props']['onFilter:companies'] = async ({ searchPhrase, done }) => {
  companiesSearchPhrase.value = searchPhrase
  await refetchFilteredCompanies()

  if (done) done()
}

const ready = ref<boolean>(false)
onMounted(async () => {
  await execute()
  ready.value = true
})
</script>
