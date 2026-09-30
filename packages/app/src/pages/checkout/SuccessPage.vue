<template>
  <q-page padding>
    {{ lang.checkout.success }}
  </q-page>
</template>

<script setup lang="ts">
import { useLang } from '../../lang/index.js'

const lang = useLang()
</script>
