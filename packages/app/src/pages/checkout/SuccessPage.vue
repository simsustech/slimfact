<template>
  <q-page padding>
    <a>
      {{ lang.checkout.success }}
    </a>
  </q-page>
</template>

<script setup lang="ts">
import { useLang } from '../../lang/index.js'

const lang = useLang()
</script>
