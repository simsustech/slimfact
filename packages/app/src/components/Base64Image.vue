<template>
  <q-img
    class="cursor-pointer"
    :src="modelValue"
    fit="contain"
    style="max-height: 60vh"
    place
  >
    <q-icon v-if="!modelValue" name="photo_camera" />
  </q-img>
</template>

<script lang="ts">
export default {
  name: 'Base64Image'
}
</script>

<script setup lang="ts">
export interface Props {
  modelValue?: string
}

defineProps<Props>()
</script>
