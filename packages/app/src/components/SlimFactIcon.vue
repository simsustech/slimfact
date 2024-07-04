<template>
  <q-icon :name="'img:' + icon" />
</template>

<script lang="ts">
export default {
  name: 'ModularapiIcon'
}
</script>

<script lang="ts" setup>
import icon from '../assets/logo.svg'
</script>
