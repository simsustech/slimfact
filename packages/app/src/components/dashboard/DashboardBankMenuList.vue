<template>
  <q-list separator>
    <q-item to="/admin/bank/overview">
      <q-item-section avatar>
        <q-icon :name="BANK_ICON" />
      </q-item-section>
      <q-item-section>
        <q-item-label> {{ lang.bank.pages.overview }} </q-item-label>
      </q-item-section>
    </q-item>
    <q-item to="/admin/settings/banking">
      <q-item-section avatar>
        <q-icon :name="SETTINGS_ICON" />
      </q-item-section>
      <q-item-section>
        <q-item-label> {{ lang.bank.pages.settings }} </q-item-label>
      </q-item-section>
    </q-item>
  </q-list>
</template>

<script setup lang="ts">
import { BANK_ICON, SETTINGS_ICON } from '../../configuration.js'
import { useLang } from '../../lang/index.js'

const lang = useLang()
</script>
