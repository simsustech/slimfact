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

import { QBtn } from 'quasar'

QBtn.props.rounded = {
  type: QBtn.props.rounded,
  default: true
}
</script>

<script setup lang="ts"></script>
