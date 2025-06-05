<template>
  <q-page padding>
    <div v-if="ready" class="row">
      <q-list class="full-width" dense>
        <invoice-item
          v-for="invoice in bills"
          :key="invoice.id"
          :model-value="invoice"
        />
      </q-list>
    </div>
  </q-page>
</template>

<script lang="ts">
export default {
  name: 'AccountBillsPage'
}
</script>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
// import InvoiceExpansionItem from '../../components/invoice/InvoiceExpansionItem.vue'
import InvoiceItem from '../../components/invoice/InvoiceItem.vue'
import { useAccountGetBillsQuery } from 'src/queries/account/bills.js'

const { bills, refetch } = useAccountGetBillsQuery()

const ready = ref<boolean>(false)
onMounted(async () => {
  await refetch()
  ready.value = true
})
</script>
