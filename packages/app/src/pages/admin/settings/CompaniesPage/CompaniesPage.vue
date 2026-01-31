<template>
  <q-page padding>
    <div v-if="ready" class="grid grid-cols-12 gap-3">
      <company-card
        v-for="company in companies"
        class="col-span-12 md:col-span-3"
        :key="company.id"
        :model-value="company"
        @update="openUpdateDialog"
      />
    </div>
  </q-page>

  <responsive-dialog
    :icons="{ close: 'i-mdi-close' }"
    padding
    ref="updateDialogRef"
    persistent
    @submit="update"
  >
    <company-form
      ref="updateCompanyFormRef"
      :filtered-number-prefixes="numberPrefixes"
      @submit="updateCompany"
    ></company-form>
  </responsive-dialog>
  <responsive-dialog
    :icons="{ close: 'i-mdi-close' }"
    padding
    ref="createDialogRef"
    persistent
    @submit="create"
  >
    <company-form
      ref="createCompanyFormRef"
      :filtered-number-prefixes="numberPrefixes"
      @submit="createCompany"
    ></company-form>
  </responsive-dialog>
</template>

<script lang="ts">
export default {
  name: 'AdminCompaniesPage'
}
</script>

<script setup lang="ts">
import { ref, onMounted, inject } from 'vue'
import { ResourcePage, ResponsiveDialog } from '@simsustech/quasar-components'
import CompanyForm from '../../../../components/company/CompanyForm.vue'
import CompanyCard from '../../../../components/company/CompanyCard.vue'

import { EventBus } from 'quasar'
import {
  useAdminCreateCompanyMutation,
  useAdminGetCompaniesQuery,
  useAdminUpdateCompanyMutation
} from 'src/queries/admin/companies.js'
import { useAdminGetNumberPrefixesQuery } from 'src/queries/admin/numberPrefixes.js'
import { until } from '@vueuse/core'

const bus = inject<EventBus>('bus')!
bus.on('administrator-open-companies-create-dialog', () => {
  if (openCreateDialog)
    openCreateDialog({
      done: () => {}
    })
})

const { companies, refetch: execute } = useAdminGetCompaniesQuery()

const { numberPrefixes, refetch: refetchNumberPrefixes } =
  useAdminGetNumberPrefixesQuery()
await refetchNumberPrefixes()

const updateCompanyFormRef = ref<typeof CompanyForm>()
const createCompanyFormRef = ref<typeof CompanyForm>()
const updateDialogRef = ref<typeof ResponsiveDialog>()
const createDialogRef = ref<typeof ResponsiveDialog>()

const openUpdateDialog: InstanceType<
  typeof ResourcePage
>['$props']['onUpdate'] = async ({ data }) => {
  updateDialogRef.value?.functions.open()
  await until(updateCompanyFormRef).toBeTruthy()

  updateCompanyFormRef.value?.functions.setValue(data)
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
  updateCompanyFormRef.value?.functions.submit({ done: afterUpdate })
}

const create: InstanceType<
  typeof ResponsiveDialog
>['$props']['onSubmit'] = async ({ done }) => {
  const afterCreate = (success?: boolean) => {
    done(success)
    execute()
  }
  createCompanyFormRef.value?.functions.submit({ done: afterCreate })
}

const { mutateAsync: createCompanyMutation } = useAdminCreateCompanyMutation()
const { mutateAsync: updateCompanyMutation } = useAdminUpdateCompanyMutation()

const updateCompany: InstanceType<
  typeof CompanyForm
>['$props']['onSubmit'] = async ({ data, done }) => {
  try {
    await updateCompanyMutation(data)
    done()
    await execute()
  } catch (e) {}
}

const createCompany: InstanceType<
  typeof CompanyForm
>['$props']['onSubmit'] = async ({ data, done }) => {
  try {
    await createCompanyMutation(data)
    done()
    await execute()
  } catch (e) {}
}

const ready = ref<boolean>(false)
onMounted(async () => {
  await execute()
  ready.value = true
})
</script>
