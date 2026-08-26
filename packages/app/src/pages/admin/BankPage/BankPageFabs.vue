<template>
  <navigation-rail-fabs :bus-emits="busEmits" :icons="icons" type="add" />
</template>

<script lang="ts" setup>
import { NavigationRailFabs } from '@simsustech/quasar-components/md3'
import { ref } from 'vue'

const busEmits = ref({
  add: 'administrator-open-bank-sync-now'
})

const icons = ref({
  add: 'i-mdi-sync'
})
</script>
