<template>
  <resource-page>
    <template #header>
      {{ lang.bill.title }}
    </template>
    <div v-if="ready" class="row">
      <q-list class="full-width" dense>
        <invoice-item
          v-for="invoice in invoices"
          :key="invoice.id"
          :model-value="invoice"
        />
      </q-list>
    </div>
  </resource-page>
</template>

<script lang="ts">
export default {
  name: 'AccountBillsPage'
}
</script>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { createUseTrpc } from '../../trpc.js'
import { ResourcePage } from '@simsustech/quasar-components'
// import InvoiceExpansionItem from '../../components/invoice/InvoiceExpansionItem.vue'
import InvoiceItem from '../../components/invoice/InvoiceItem.vue'
import { useLang } from '../../lang/index.js'

const { useQuery } = await createUseTrpc()

const lang = useLang()

const { data: invoices, execute } = useQuery('user.getBills', {
  // immediate: true
})

const ready = ref<boolean>(false)
onMounted(async () => {
  await execute()
  ready.value = true
})
</script>
