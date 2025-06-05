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
// import InvoiceExpansionItem from '../../components/invoice/InvoiceExpansionItem.vue'
import InvoiceItem from '../../components/invoice/InvoiceItem.vue'
import { useAccountGetInvoicesQuery } from 'src/queries/account/invoices.js'

const { invoices, refetch } = useAccountGetInvoicesQuery()

const ready = ref<boolean>(false)
onMounted(async () => {
  await refetch()
  ready.value = true
})
</script>
