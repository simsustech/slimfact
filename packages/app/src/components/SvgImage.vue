<template>
  <q-img
    class="cursor-pointer"
    :src="
      modelValue
        ? `data:image/svg+xml,${encodeURIComponent(modelValue)}`
        : undefined
    "
    fit="contain"
    style="max-height: 60vh"
    place
  >
    <q-icon v-if="!modelValue" name="photo_camera" />
  </q-img>
</template>

<script lang="ts">
export default {
  name: 'SvgImage'
}
</script>

<script setup lang="ts">
export interface Props {
  modelValue?: string | null
}

defineProps<Props>()
</script>
