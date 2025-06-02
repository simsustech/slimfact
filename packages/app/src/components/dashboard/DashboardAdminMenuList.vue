<template>
  <q-list separator>
    <q-item to="/admin/clients">
      <q-item-section avatar>
        <q-icon :name="CLIENT_ICON" />
      </q-item-section>
      <q-item-section>
        <q-item-label> {{ lang.client.title }} </q-item-label>
      </q-item-section>
    </q-item>
    <q-item to="/admin/bills">
      <q-item-section avatar>
        <q-icon :name="BILL_ICON" />
      </q-item-section>
      <q-item-section>
        <q-item-label> {{ lang.bill.title }} </q-item-label>
      </q-item-section>
    </q-item>
    <q-item to="/admin/receipts">
      <q-item-section avatar>
        <q-icon :name="RECEIPT_ICON" />
      </q-item-section>
      <q-item-section>
        <q-item-label>
          {{ lang.receipt.title }}
        </q-item-label>
      </q-item-section>
    </q-item>
    <q-item to="/admin/invoices">
      <q-item-section avatar>
        <q-icon :name="INVOICE_ICON" />
      </q-item-section>
      <q-item-section>
        <q-item-label> {{ lang.invoice.title }} </q-item-label>
      </q-item-section>
    </q-item>
    <q-item to="/admin/subscriptions">
      <q-item-section avatar>
        <q-icon :name="SUBSCRIPTION_ICON" />
      </q-item-section>
      <q-item-section>
        <q-item-label> {{ lang.subscription.title }} </q-item-label>
      </q-item-section>
    </q-item>
    <q-item to="/admin/settings">
      <q-item-section avatar>
        <q-icon :name="SETTINGS_ICON" />
      </q-item-section>
      <q-item-section>
        <q-item-label>
          {{ lang.settings.title }}
        </q-item-label>
      </q-item-section>
    </q-item>
  </q-list>
</template>

<script setup lang="ts">
import {
  BILL_ICON,
  CLIENT_ICON,
  INVOICE_ICON,
  RECEIPT_ICON,
  SETTINGS_ICON,
  SUBSCRIPTION_ICON
} from 'src/configuration.js'
import { useLang } from '../../lang/index.js'

const lang = useLang()
</script>
