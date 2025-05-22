<template>
  <q-page padding>
    <div v-if="ready" class="grid grid-cols-12 gap-3">
      <company-card
        v-for="company in data"
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
import { ref, nextTick, onMounted, inject } from 'vue'
import { createUseTrpc } from '../../../trpc.js'
import { ResourcePage, ResponsiveDialog } from '@simsustech/quasar-components'
import CompanyForm from '../../../components/company/CompanyForm.vue'
import CompanyCard from '../../../components/company/CompanyCard.vue'

import { EventBus } from 'quasar'

const bus = inject<EventBus>('bus')!
bus.on('administrator-open-clients-create-dialog', () => {
  if (openCreateDialog)
    openCreateDialog({
      done: () => {}
    })
})

const { useQuery, useMutation } = await createUseTrpc()

const { data, execute } = useQuery('admin.getCompanies', {
  // immediate: true
})

const { data: numberPrefixes } = useQuery('admin.getNumberPrefixes', {
  immediate: true
})

const updateCompanyFormRef = ref<typeof CompanyForm>()
const createCompanyFormRef = ref<typeof CompanyForm>()
const updateDialogRef = ref<typeof ResponsiveDialog>()
const createDialogRef = ref<typeof ResponsiveDialog>()

const openUpdateDialog: InstanceType<
  typeof ResourcePage
>['$props']['onUpdate'] = ({ data }) => {
  updateDialogRef.value?.functions.open()
  nextTick(() => {
    updateCompanyFormRef.value?.functions.setValue(data)
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

const updateCompany: InstanceType<
  typeof CompanyForm
>['$props']['onSubmit'] = async ({ data, done }) => {
  const result = useMutation('admin.updateCompany', {
    args: data,
    immediate: true
  })

  await result.immediatePromise

  done(!result.error.value)
}

const createCompany: InstanceType<
  typeof CompanyForm
>['$props']['onSubmit'] = async ({ data, done }) => {
  const result = useMutation('admin.createCompany', {
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
