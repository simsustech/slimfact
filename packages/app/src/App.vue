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
import { useRoute } from 'vue-router'
import { useLang } from './lang/index.js'
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

import { EventBus } from 'quasar'
import { provide } from 'vue'

const bus = new EventBus<{
  'administrator-open-companies-create-dialog': () => void
  'administrator-open-clients-create-dialog': () => void
  'administrator-open-bills-create-dialog': () => void
  'administrator-open-invoices-create-dialog': () => void
  'administrator-open-subscriptions-create-dialog': () => void
  'administrator-settings-open-number-prefixes-create-dialog': () => void
  'administrator-settings-open-initial-number-for-prefixes-create-dialog': () => void
}>()
provide<EventBus>('bus', bus)

const configuration = useConfiguration()
const route = useRoute()
const lang = useLang()

/**
 * The tab title has one owner: this Meta plugin block. It reads the same route
 * map (`meta.lang`) as the app bar and the page's heading, so the server and the
 * client agree on what the page is called — and nothing re-asserts the bare brand
 * over a route-aware title.
 */
useMeta(() => {
  const key = route.meta?.lang
  const section =
    typeof key === 'string'
      ? (lang.value as unknown as Record<string, { title?: string }>)[key]
      : undefined
  return {
    title: section?.title ?? configuration.value.TITLE
  }
})
</script>

<style>
[v-cloak] {
  display: none;
}
</style>
