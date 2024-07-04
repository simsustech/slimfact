<template>
  <div
    class="fullscreen bg-primary text-white text-center q-pa-md flex flex-center"
  >
    <div>
      <div style="font-size: 30vh">404</div>

      <div class="text-h2" style="opacity: 0.4">{{ lang[404] }}</div>

      <q-btn
        class="q-mt-xl"
        color="white"
        text-color="blue"
        unelevated
        to="/"
        :label="lang.goHome"
        no-caps
      />
    </div>
  </div>
</template>

<scirpt lang="ts">
export default {
  name: 'Error404Page'
}
</scirpt>

<script setup lang="ts">
import { useLang } from '../lang/index.js'

const lang = useLang()
</script>
