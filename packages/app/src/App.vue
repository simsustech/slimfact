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
import { useMeta } from 'quasar'

const configuration = useConfiguration()
useMeta(() => {
  return {
    title: configuration.value.TITLE
  }
})
</script>

<style>
[v-cloak] {
  display: none;
}
</style>
