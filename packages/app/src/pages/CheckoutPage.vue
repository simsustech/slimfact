<template>
  <router-view v-slot="{ Component }">
    <component :is="Component" v-if="Component" />
    <!--
      `routes.ts` gives this route exactly one child (`success`), so a direct visit
      to /checkout matches the parent with no child. Without this branch that
      rendered the app shell and nothing else — no page, no text.
    -->
    <q-page v-else padding class="flex flex-center">
      <div class="text-center">
        <div class="text-h6">{{ lang.checkout.empty }}</div>
        <q-btn
          class="q-mt-md"
          color="primary"
          unelevated
          no-caps
          to="/"
          :label="lang.goHome"
        />
      </div>
    </q-page>
  </router-view>
</template>

<script setup lang="ts">
import { useLang } from '../lang/index.js'

const lang = useLang()
</script>
