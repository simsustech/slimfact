<template>
  <q-styled-card>
    <template #title>
      {{ modelValue.email }}
      <q-icon :name="modelValue.verified ? 'check' : 'close'"></q-icon>
    </template>
    <template #default>
      <q-list>
        <q-item>
          <q-item-section>
            <q-item-label overline>
              {{ lang.account.fields.name }}
            </q-item-label>
            <q-item-label>
              {{ modelValue.name }}
            </q-item-label>
          </q-item-section>
        </q-item>
        <q-item>
          <q-item-section>
            <q-item-label overline>
              {{ lang.account.fields.roles }}
            </q-item-label>
            <q-item-label>
              {{
                modelValue.roles
                  ?.map((role) => lang.account.roles[role])
                  .join(', ')
              }}
            </q-item-label>
          </q-item-section>
          <q-item-section> </q-item-section>
        </q-item>
      </q-list>
    </template>
    <template #actions>
      <div class="row full-width justify-between">
        <q-btn :label="lang.account.messages.addRole" @click="addRole"></q-btn>
        <q-btn
          :label="lang.account.messages.removeRole"
          @click="removeRole"
        ></q-btn>
      </div>
    </template>
  </q-styled-card>
</template>

<script lang="ts">
export default {
  name: 'AccountCard'
}
</script>

<script setup lang="ts">
import { QStyledCard } from '@simsustech/quasar-components'
import type { Account } from '@slimfact/api/zod'
import { useLang } from '../../lang/index.js'
import { MODULARAPI_ACCOUNT_ROLES } from '@slimfact/api/zod'
import { useQuasar } from 'quasar'
import { toRefs } from 'vue'
export type WithRequired<T, K extends keyof T> = T & { [P in K]-?: T[P] }
export interface Props {
  modelValue: WithRequired<Account, 'id'>
}
const props = defineProps<Props>()

const emit = defineEmits<{
  (
    e: 'addRole',
    {
      data,
      done
    }: {
      data: { id: number; role: MODULARAPI_ACCOUNT_ROLES }
      done: (success?: boolean) => void
    }
  ): void
  (
    e: 'removeRole',
    {
      data,
      done
    }: {
      data: { id: number; role: MODULARAPI_ACCOUNT_ROLES }
      done: (success?: boolean) => void
    }
  ): void
}>()

const { modelValue } = toRefs(props)
const $q = useQuasar()
const lang = useLang()

const addRole = () => {
  $q.dialog({
    message: lang.value.account.messages.addRole,
    options: {
      type: 'radio',
      model: 'role',
      items: [
        {
          label:
            lang.value.account.roles[MODULARAPI_ACCOUNT_ROLES.ADMINISTRATOR],
          value: MODULARAPI_ACCOUNT_ROLES.ADMINISTRATOR
        },
        {
          label: lang.value.account.roles[MODULARAPI_ACCOUNT_ROLES.EMPLOYEE],
          value: MODULARAPI_ACCOUNT_ROLES.EMPLOYEE
        },
        {
          label: lang.value.account.roles[MODULARAPI_ACCOUNT_ROLES.INTERN],
          value: MODULARAPI_ACCOUNT_ROLES.INTERN
        }
      ]
    },
    cancel: true,
    persistent: true
  }).onOk((role: MODULARAPI_ACCOUNT_ROLES) => {
    const done = function () {
      //
    }
    emit('addRole', { data: { id: modelValue.value.id, role }, done })
  })
}

const removeRole = () => {
  $q.dialog({
    message: lang.value.account.messages.addRole,
    options: {
      type: 'radio',
      model: 'role',
      items: modelValue.value.roles?.map((role) => ({
        label: lang.value.account.roles[role as MODULARAPI_ACCOUNT_ROLES],
        value: role
      }))
    },
    cancel: true,
    persistent: true
  }).onOk((role) => {
    const done = function () {
      //
    }
    emit('removeRole', { data: { id: modelValue.value.id, role }, done })
  })
}
</script>
