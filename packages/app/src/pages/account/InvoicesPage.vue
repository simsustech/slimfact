<template>
  <q-page padding>
    <div v-if="ready" class="row">
      <q-list class="full-width" dense>
        <invoice-item
          v-for="invoice in invoices"
          :key="invoice.id"
          :model-value="invoice"
        />
      </q-list>
    </div>
  </q-page>
</template>

<script lang="ts">
export default {
  name: 'AccountInvoicesPage'
}
</script>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { createUseTrpc } from '../../trpc.js'
// import InvoiceExpansionItem from '../../components/invoice/InvoiceExpansionItem.vue'
import InvoiceItem from '../../components/invoice/InvoiceItem.vue'

const { useQuery } = await createUseTrpc()

const { data: invoices, execute } = useQuery('user.getInvoices', {
  // immediate: true
})

const ready = ref<boolean>(false)
onMounted(async () => {
  await execute()
  ready.value = true
})
</script>
