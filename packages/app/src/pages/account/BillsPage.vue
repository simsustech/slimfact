<template>
  <q-page padding>
    <div v-if="ready" class="row">
      <q-list class="full-width" dense>
        <invoice-item
          v-for="invoice in bills"
          :key="invoice.id"
          :model-value="invoice"
        />
        <q-item v-if="!bills?.length" class="flex flex-center text-grey-6">
          <q-item-section class="text-center">
            {{ lang.noResultsAvailable }}
          </q-item-section>
        </q-item>
      </q-list>
      <div class="flex flex-center full-width q-mt-md">
        <q-pagination
          v-model="page"
          :disable="!(total && page && rowsPerPage)"
          :max="Math.ceil(total / rowsPerPage)"
          :max-pages="5"
          direction-links
        />
      </div>
    </div>
  </q-page>
</template>

<script lang="ts">
export default {
  name: 'AccountBillsPage'
}
</script>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import InvoiceItem from '../../components/invoice/InvoiceItem.vue'
import { useLang } from '../../lang/index.js'
import { useAccountGetBillsQuery } from '../../queries/account/bills.js'

const lang = useLang()
const { bills, page, rowsPerPage, refetch } = useAccountGetBillsQuery()
const total = computed(() => bills.value?.at(0)?.total || 0)

const ready = ref<boolean>(false)
onMounted(async () => {
  await refetch()
  ready.value = true
})
</script>
