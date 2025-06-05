<template>
  <q-list separator>
    <q-item to="/admin/settings/companies">
      <q-item-section avatar>
        <q-icon :name="COMPANY_ICON" />
      </q-item-section>
      <q-item-section>
        <q-item-label> {{ lang.company.title }} </q-item-label>
      </q-item-section>
    </q-item>
    <q-item to="/admin/settings/numberprefixes">
      <q-item-section avatar>
        <q-icon :name="NUMBER_PREFIX_ICON" />
      </q-item-section>
      <q-item-section>
        <q-item-label> {{ lang.numberPrefix.title }} </q-item-label>
      </q-item-section>
    </q-item>
    <q-item to="/admin/settings/initialnumberforprefixes" :inset-level="1">
      <q-item-section avatar>
        <q-icon :name="INITIAL_NUMBER_FOR_PREFIX_ICON" />
      </q-item-section>
      <q-item-section>
        <q-item-label> {{ lang.initialNumberForPrefix.title }} </q-item-label>
      </q-item-section>
    </q-item>
    <q-item to="/admin/settings/accounts">
      <q-item-section avatar>
        <q-icon :name="ACCOUNTS_ICON" />
      </q-item-section>
      <q-item-section>
        <q-item-label>
          {{ lang.account.accounts }}
        </q-item-label>
      </q-item-section>
    </q-item>
    <q-item to="/admin/settings/exports">
      <q-item-section avatar>
        <q-icon :name="EXPORT_ICON" />
      </q-item-section>
      <q-item-section>
        <q-item-label> {{ lang.exports.title }} </q-item-label>
      </q-item-section>
    </q-item>
  </q-list>
</template>

<script setup lang="ts">
import {
  ACCOUNTS_ICON,
  COMPANY_ICON,
  EXPORT_ICON,
  INITIAL_NUMBER_FOR_PREFIX_ICON,
  NUMBER_PREFIX_ICON
} from 'src/configuration.js'
import { useLang } from '../../lang/index.js'

const lang = useLang()
</script>
