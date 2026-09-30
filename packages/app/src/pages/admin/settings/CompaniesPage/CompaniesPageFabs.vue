<template>
  <navigation-rail-fabs
    :bus-emits="busEmits"
    :icons="icons"
    type="add"
    :add-label="`${lang.add} ${lang.company.title}`"
  />
</template>

<script lang="ts" setup>
import { NavigationRailFabs } from '@simsustech/quasar-components/md3'
import { ref } from 'vue'
import { useLang } from '../../../../lang/index.js'
const lang = useLang()

const busEmits = ref({
  add: 'administrator-open-companies-create-dialog'
})

const icons = ref({
  add: 'i-mdi-add',
  edit: 'i-mdi-edit'
})
</script>
