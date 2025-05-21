<template>
  <q-list separator>
    <q-item clickable to="/account/bills">
      <q-item-section avatar>
        <q-icon :name="BILL_ICON" />
      </q-item-section>
      <q-item-section>
        <q-item-label>
          {{ lang.dashboard.account.menu.bills }}
        </q-item-label>
      </q-item-section>
    </q-item>
    <q-item clickable to="/account/receipts">
      <q-item-section avatar>
        <q-icon :name="RECEIPT_ICON" />
      </q-item-section>
      <q-item-section>
        <q-item-label>
          {{ lang.dashboard.account.menu.receipts }}
        </q-item-label>
      </q-item-section>
    </q-item>
    <q-item clickable to="/account/invoices">
      <q-item-section avatar>
        <q-icon :name="INVOICE_ICON" />
      </q-item-section>
      <q-item-section>
        <q-item-label>
          {{ lang.dashboard.account.menu.invoices }}
        </q-item-label>
      </q-item-section>
    </q-item>
  </q-list>
</template>

<script setup lang="ts">
import { BILL_ICON, RECEIPT_ICON, INVOICE_ICON } from '../../configuration.js'
import { useLang } from '../../lang/index.js'

const lang = useLang()
</script>
