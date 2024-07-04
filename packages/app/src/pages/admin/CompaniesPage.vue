<template>
  <resource-page
    type="create"
    @create="openCreateDialog"
    @update="openUpdateDialog"
  >
    <template #header>
      {{ lang.company.title }}
    </template>
    <div v-if="ready" class="row">
      <company-card
        v-for="company in data"
        :key="company.id"
        :model-value="company"
        @update="openUpdateDialog"
      />
    </div>

    <responsive-dialog ref="updateDialogRef" persistent @submit="update">
      <company-form
        ref="updateCompanyFormRef"
        @submit="updateCompany"
      ></company-form>
    </responsive-dialog>
    <responsive-dialog ref="createDialogRef" persistent @submit="create">
      <company-form
        ref="createCompanyFormRef"
        @submit="createCompany"
      ></company-form>
    </responsive-dialog>
  </resource-page>
</template>

<script lang="ts">
export default {
  name: 'AdminCompaniesPage'
}
</script>

<script setup lang="ts">
import { ref, nextTick, onMounted } from 'vue'
import { createUseTrpc } from '../../trpc.js'
import { ResourcePage, ResponsiveDialog } from '@simsustech/quasar-components'
import CompanyForm from '../../components/company/CompanyForm.vue'
import CompanyCard from '../../components/company/CompanyCard.vue'
import { useLang } from '../../lang/index.js'
const { useQuery, useMutation } = await createUseTrpc()

const lang = useLang()

const { data, execute } = useQuery('admin.getCompanies', {
  // immediate: true
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
