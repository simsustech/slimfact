<template>
  <resource-page
    type="create"
    @create="openCreateDialog"
    @update="openUpdateDialog"
  >
    <template #header>
      {{ lang.initialNumberForPrefix.title }}
    </template>
    <div v-if="ready" class="row">
      <q-list>
        <initial-number-for-prefix-item
          v-for="initialNumberForPrefix in data"
          :key="initialNumberForPrefix.id"
          :model-value="initialNumberForPrefix"
        />
      </q-list>
    </div>

    <responsive-dialog
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
  </resource-page>
</template>

<script lang="ts">
export default {
  name: 'AdmininitialNumberForPrefixesPage'
}
</script>

<script setup lang="ts">
import { ref, nextTick, onMounted } from 'vue'
import { createUseTrpc } from '../../trpc.js'
import { ResourcePage, ResponsiveDialog } from '@simsustech/quasar-components'
import initialNumberForPrefixForm from '../../components/numberPrefix/InitialNumberForPrefixForm.vue'
import initialNumberForPrefixItem from '../../components/numberPrefix/InitialNumberForPrefixItem.vue'
import { useLang } from '../../lang/index.js'
import InitialNumberForPrefixForm from '../../components/numberPrefix/InitialNumberForPrefixForm.vue'
import type { CompanyDetails } from '@modular-api/fastify-checkout'
const { useQuery, useMutation } = await createUseTrpc()

const lang = useLang()

const { data, execute } = useQuery('admin.getInitialNumberForPrefixes', {
  // immediate: true
})

const updateInitialNumberForPrefixFormRef =
  ref<typeof initialNumberForPrefixForm>()
const createInitialNumberForPrefixFormRef =
  ref<typeof initialNumberForPrefixForm>()
const updateDialogRef = ref<typeof ResponsiveDialog>()
const createDialogRef = ref<typeof ResponsiveDialog>()

const openUpdateDialog: InstanceType<
  typeof ResourcePage
>['$props']['onUpdate'] = ({ data }) => {
  updateDialogRef.value?.functions.open()
  nextTick(() => {
    updateInitialNumberForPrefixFormRef.value?.functions.setValue(data)
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

const updateInitialNumberForPrefix: InstanceType<
  typeof initialNumberForPrefixForm
>['$props']['onSubmit'] = async ({ data, done }) => {
  const result = useMutation('admin.updateInitialNumberForPrefix', {
    args: data,
    immediate: true
  })

  await result.immediatePromise

  done(!result.error.value)
}

const createInitialNumberForPrefix: InstanceType<
  typeof initialNumberForPrefixForm
>['$props']['onSubmit'] = async ({ data, done }) => {
  const result = useMutation('admin.createInitialNumberForPrefix', {
    args: data,
    immediate: true
  })

  await result.immediatePromise

  done(!result.error.value)
}

const filteredCompanies = ref<CompanyDetails[]>([])
const onFilterCompanies: InstanceType<
  typeof InitialNumberForPrefixForm
>['$props']['onFilter:companies'] = async ({ searchPhrase, done }) => {
  const result = useQuery('admin.searchCompanies', {
    args: searchPhrase,
    immediate: true
  })

  await result.immediatePromise

  if (result.data.value) filteredCompanies.value = result.data.value

  if (done) done()
}

const ready = ref<boolean>(false)
onMounted(async () => {
  await execute()
  ready.value = true
})
</script>
