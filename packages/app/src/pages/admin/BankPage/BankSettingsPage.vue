<template>
  <q-page padding>
    <div v-if="!bankingConfigured" class="q-pa-md">
      <q-banner inline-actions class="bg-amber-1 text-amber-9">
        {{ lang.bank.notConfigured }}
      </q-banner>
    </div>

    <div class="q-mt-md">
      <div class="text-subtitle1 q-mb-sm">{{ lang.bank.connections }}</div>
      <q-list v-if="connections && connections.length" bordered separator>
        <q-item v-for="connection in connections" :key="connection.sessionId">
          <q-item-section avatar>
            <q-icon name="i-mdi-bank" />
          </q-item-section>
          <q-item-section>
            <q-item-label>{{ connection.aspspName }}</q-item-label>
            <q-item-label caption>
              <q-chip
                dense
                size="sm"
                text-color="white"
                :label="connectionStatusLabel(connection)"
                :color="connectionStatusColor(connection)"
              />
              <span v-if="connection.validUntil">
                · {{ lang.bank.validUntil }}
                {{ formatDate(connection.validUntil) }}
              </span>
            </q-item-label>
          </q-item-section>
        </q-item>
      </q-list>
      <div v-else class="text-grey-6 q-pa-sm">
        {{ lang.bank.noConnections }}
      </div>
    </div>

    <div class="q-mt-md">
      <div class="text-subtitle1 q-mb-sm">{{ lang.bank.accounts }}</div>
      <q-list v-if="accounts && accounts.length" bordered separator>
        <q-item v-for="account in accounts" :key="account.id">
          <q-item-section>
            <q-item-label>
              {{ account.companyName || account.aspspName || account.id }}
            </q-item-label>
            <q-item-label caption>
              {{ formatIban(account.iban ?? '') }} - {{ account.currency }}
            </q-item-label>
          </q-item-section>
          <q-item-section side>
            <q-btn
              flat
              dense
              color="primary"
              icon="i-mdi-link"
              :label="lang.bank.actions.linkCompanies"
              @click="openLinkCompaniesDialog(account)"
            />
          </q-item-section>
        </q-item>
      </q-list>
      <div v-else class="text-grey-6 q-pa-sm">
        {{ lang.bank.noAccounts }}
      </div>
    </div>

    <div class="q-mt-md">
      <q-btn
        :label="syncing ? lang.bank.syncing : lang.bank.actions.syncNow"
        icon="i-mdi-sync"
        color="primary"
        :loading="syncing"
        :disable="syncing"
        @click="syncNow"
      />
    </div>

    <responsive-dialog
      ref="linkCompaniesDialogRef"
      :icons="{ close: 'i-mdi-close' }"
      padding
      persistent
      @submit="saveCompanyLinks"
    >
      <template #title>
        {{
          editingAccount
            ? editingAccount.companyName ||
              editingAccount.aspspName ||
              editingAccount.id
            : ''
        }}
      </template>
      <q-select
        v-model="draftCompanyIds"
        :options="companyOptions"
        :label="lang.bank.columns.company"
        outlined
        clearable
        multiple
        emit-value
        map-options
        style="min-width: 280px"
      />
    </responsive-dialog>
  </q-page>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useQuasar } from 'quasar'
import { useLang } from '../../../lang/index.js'
import { ResponsiveDialog } from '@simsustech/quasar-components'
import { isTRPCClientError } from '../../../trpc.js'
import { useAdminGetCompaniesQuery } from '../../../queries/admin/companies.js'
import {
  useAdminGetBankAvailableAccountsQuery,
  useAdminGetBankConnectionsQuery,
  useAdminSetBankAccountCompaniesMutation,
  type AvailableAccount,
  type BankConnection
} from '../../../queries/admin/bankTransactions.js'
import { useBankSyncNow } from '../../../composables/useBankSyncNow.js'

const lang = useLang()
const $q = useQuasar()

/** Server errors carry a human-readable tRPC message when available. */
const extractErrorMessage = (error: unknown): string => {
  if (isTRPCClientError(error)) return error.message
  if (error instanceof Error) return error.message
  return String(error)
}

const notifyError = (error: unknown) => {
  $q.notify({
    type: 'negative',
    message: lang.value.bank.actionFailed,
    caption: extractErrorMessage(error)
  })
}

const connectionsQuery = useAdminGetBankConnectionsQuery()
const connections = computed(() => connectionsQuery.payload.value?.connections)
const bankingConfigured = computed(
  () => connectionsQuery.payload.value?.enabled ?? false
)

const companiesQuery = useAdminGetCompaniesQuery()
const companyOptions = computed(() =>
  (companiesQuery.companies.value ?? []).map((company) => ({
    label: company.name,
    value: company.id
  }))
)

const accountsQuery = useAdminGetBankAvailableAccountsQuery()
const accounts = computed(() => accountsQuery.payload.value?.accounts)

// Mirrors each account's explicit company links (many-to-many multi-select).
const accountCompanyIds = reactive<Record<string, number[]>>({})
watch(
  accounts,
  (rows) => {
    for (const account of rows ?? []) {
      accountCompanyIds[account.id] = account.companyIds
    }
  },
  { immediate: true }
)

const setAccountCompaniesMutation = useAdminSetBankAccountCompaniesMutation()
const setAccountCompanies = async (
  account: AvailableAccount,
  companyIds: number[]
) => {
  accountCompanyIds[account.id] = companyIds
  await setAccountCompaniesMutation.mutate({
    accountExternalId: account.id,
    companyIds
  })
  await accountsQuery.refetch?.()
}

// "Link companies" dialog: one account at a time, multi-select in a
// responsive dialog (same component as the admin forms).
const linkCompaniesDialogRef = ref<typeof ResponsiveDialog>()
const editingAccount = ref<AvailableAccount | null>(null)
const draftCompanyIds = ref<number[]>([])

const openLinkCompaniesDialog = (account: AvailableAccount) => {
  editingAccount.value = account
  draftCompanyIds.value = [...(accountCompanyIds[account.id] ?? [])]
  linkCompaniesDialogRef.value?.functions.open()
}

const saveCompanyLinks: InstanceType<
  typeof ResponsiveDialog
>['$props']['onSubmit'] = async ({ done }) => {
  if (!editingAccount.value) return done(false)
  try {
    await setAccountCompanies(editingAccount.value, draftCompanyIds.value)
    done(true)
  } catch (e) {
    console.error(e)
    notifyError(e)
    // Keep the dialog open so the user's selections are preserved.
    done(false)
  }
}

const {
  state: bankSyncState,
  syncResult,
  syncNow
} = useBankSyncNow({
  invalidate: () => {
    void connectionsQuery.refetch?.()
    void accountsQuery.refetch?.()
  }
})
const syncing = computed(() => bankSyncState.value === 'loading')

watch(syncResult, (result) => {
  if (!result) return
  if (result.kind === 'requested') {
    $q.notify({ type: 'positive', message: lang.value.bank.syncRequested })
  } else {
    console.error(result.error)
    $q.notify({
      type: 'negative',
      message: lang.value.bank.syncFailed
    })
  }
})

watch(bankSyncState, (state) => {
  if (state === 'done') {
    $q.notify({ type: 'positive', message: lang.value.bank.syncCompleted })
  }
})

const needsReauth = (connection: BankConnection) =>
  connection.status !== 'Active' ||
  (connection.validUntil
    ? new Date(connection.validUntil).getTime() < Date.now()
    : false)

const connectionStatusLabel = (connection: BankConnection): string =>
  needsReauth(connection)
    ? lang.value.bank.requiresReauth
    : lang.value.bank.statusActive

const connectionStatusColor = (connection: BankConnection): string =>
  needsReauth(connection) ? 'amber-8' : 'positive'

// date-fns is not a dependency of the app package; Intl.DateTimeFormat gives
// the same localized medium-date rendering without adding one.
const formatDate = (value: string): string =>
  new Intl.DateTimeFormat($q.lang.isoName, { dateStyle: 'medium' }).format(
    new Date(value)
  )

const formatIban = (iban: string): string =>
  iban.replace(/(.{4})/g, '$1 ').trim()
</script>
