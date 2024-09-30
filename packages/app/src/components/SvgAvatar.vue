<template>
  <div>
    <q-avatar :class="{ 'cursor-pointer': modelValue }" @click="open">
      <img
        v-if="modelValue"
        :src="
          modelValue
            ? `data:image/svg+xml,${encodeURIComponent(modelValue)}`
            : undefined
        "
        style="object-fit: contain"
      />

      <q-icon v-else size="lg" name="photo_camera" />
    </q-avatar>
    <q-btn
      v-if="allowChange"
      color="white"
      text-color="black"
      rounded
      size="xs"
      padding="xs"
      style="position: relative; right: 18px; bottom: -15px"
      :icon="modelValue ? 'edit' : 'add'"
      @click="pickFiles"
    ></q-btn>
    <q-file
      ref="fileSelector"
      v-model="image"
      :label="lang.image"
      accept="image/svg+xml"
      style="display: none"
      @update:model-value="setImage"
    />
  </div>
  <responsive-dialog ref="imageDialog" persistent display>
    <svg-image class="text-center" :model-value="modelValue" />
  </responsive-dialog>
</template>

<script lang="ts">
export default {
  name: 'ImageAvatar'
}
</script>

<script setup lang="ts">
import { ref, toRefs } from 'vue'
import { QFile, QFileProps } from 'quasar'
import { useLang } from '../lang/index.js'
import { ResponsiveDialog } from '@simsustech/quasar-components'
import SvgImage from './SvgImage.vue'
export interface Props {
  modelValue?: string | null
  allowChange?: boolean
}

const toText = (file: File) =>
  new Promise<string | null>((resolve, reject) => {
    const reader = new FileReader()
    reader.readAsText(file)
    reader.onload = () => resolve(reader.result)
    reader.onerror = (error) => reject(error)
  })

const props = defineProps<Props>()
const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
  (e: 'open'): void
}>()

const lang = useLang()

const { allowChange, modelValue } = toRefs(props)
const fileSelector = ref<typeof QFile>()
const pickFiles = () => fileSelector.value?.pickFiles()
const open = () => {
  if (modelValue?.value) imageDialog.value.functions.open()
}
const image = ref<File>()

const setImage: QFileProps['onUpdate:modelValue'] = async (file) => {
  if (!import.meta.env.SSR) {
    const text = await toText(file)
    emit('update:modelValue', text)
  }
}

const imageDialog = ref<typeof ResponsiveDialog>()
</script>
