<template>
  <account-select v-model="id"></account-select>

  <account-card
    v-if="data"
    :model-value="data"
    @add-role="addRole"
    @remove-role="removeRole"
  />
</template>

<script lang="ts">
export default {
  name: 'AdminAccountsPage'
}
</script>

<script setup lang="ts">
import AccountSelect from 'src/components/admin/AccountSelect.vue'
import AccountCard from 'src/components/admin/AccountCard.vue'
import { reactive, ref } from 'vue'
import { createUseTrpc } from '../../trpc.js'
import { extend } from 'quasar'

export type WithRequired<T, K extends keyof T> = T & { [P in K]-?: T[P] }

const { useQuery, useMutation } = await createUseTrpc()

const id = ref()
const { data } = useQuery('admin.getAccount', {
  args: reactive({ id })
})

const addRole: InstanceType<
  typeof AccountCard
>['$props']['onAddRole'] = async ({ data, done }) => {
  data = extend(true, {}, data)

  const result = useMutation('admin.addRole', {
    args: data as WithRequired<typeof data, 'id'>,
    immediate: true
  })

  await result.immediatePromise

  done(!result.error.value)
}

const removeRole: InstanceType<
  typeof AccountCard
>['$props']['onRemoveRole'] = async ({ data, done }) => {
  data = extend(true, {}, data)

  const result = useMutation('admin.removeRole', {
    args: data as WithRequired<typeof data, 'id'>,
    immediate: true
  })

  await result.immediatePromise

  done(!result.error.value)
}
</script>
