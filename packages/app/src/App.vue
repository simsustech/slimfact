<template>
  <router-view v-slot="{ Component }">
    <Suspense>
      <template #default>
        <component :is="Component" />
      </template>
      <template #fallback>
        <div>Loading...</div>
      </template>
    </Suspense>
  </router-view>
</template>

<script lang="ts">
export default {
  name: 'App'
}
</script>

<script setup lang="ts">
import '@simsustech/quasar-components/css'
import { useConfiguration } from './configuration.js'
import {
  useMeta,
  QBtn,
  QBtnDropdown,
  QBtnToggle,
  QBtnGroup,
  QInput,
  QSelect,
  QField,
  QChip
} from 'quasar'

import { setDefaultPropsMd3 } from 'unocss-preset-quasar/styles'

const configuration = useConfiguration()
useMeta(() => {
  return {
    title: configuration.value.TITLE
  }
})

setDefaultPropsMd3({
  QBtn,
  QBtnDropdown,
  QBtnGroup,
  QBtnToggle,
  QInput,
  QSelect,
  QField,
  QChip
})
</script>

<style>
[v-cloak] {
  display: none;
}
</style>
