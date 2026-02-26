<template>
  <div v-if="svg" class="[&>svg]:(border-1px border-solid)" v-html="svg" />
  <q-inner-loading :showing="!svg" style="height: 300px">
    <q-spinner size="50px" color="primary" />
  </q-inner-loading>
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { type InvoicePayload } from '@modular-api/fastify-checkout'
import { $typst } from '@myriaddreamin/typst.ts'
import typstLang from '@slimfact/tools/templates/invoice/lang.typ?raw'
import typstInternal from '@slimfact/tools/templates/invoice/internal.typ?raw'
import { exportFile } from 'quasar'
import { renderTypstInvoice } from '@slimfact/tools/typst'

const templates = {
  default: import('@slimfact/tools/templates/invoice/default.typ?raw')
}

export interface Props {
  modelValue: InvoicePayload
  template?: 'default'
  pageSize?: 'a4' | 'us-letter'
  includeTax?: boolean
}
const {
  modelValue,
  includeTax,
  pageSize = 'a4',
  template = 'default'
} = defineProps<Props>()

const svg = ref<string>()
const typstTemplate = ref()

watch(
  () => typstTemplate.value,
  async (newVal) => {
    const result = await renderTypstInvoice({
      $typst,
      invoice: modelValue,
      typstTemplate: newVal,
      typstLang,
      typstInternal,
      options: {
        export: 'svg',
        includeTax: includeTax,
        pageSize: pageSize,
        typstCompilerUrl: '/typst/typst_ts_web_compiler_bg.wasm',
        typstRendererUrl: '/typst/typst_ts_renderer_bg.wasm'
      }
    })
    if (result.success) svg.value = result.svg
  }
)

let readyPromiseResolve: (value?: unknown) => void
const ready = new Promise((resolve) => {
  readyPromiseResolve = resolve
})

const downloadPdf = async () => {
  await ready
  const result = await renderTypstInvoice({
    $typst,
    invoice: modelValue,
    typstTemplate: typstTemplate.value,
    typstLang,
    typstInternal,
    options: {
      export: 'pdf',
      includeTax: includeTax,
      pageSize: pageSize,
      typstCompilerUrl: '/typst/typst_ts_web_compiler_bg.wasm',
      typstRendererUrl: '/typst/typst_ts_renderer_bg.wasm'
    }
  })
  if (result.success && result.pdf) {
    exportFile(result.filename ?? 'invoice.pdf', result.pdf)
  }
}

defineExpose({
  downloadPdf
})

onMounted(async () => {
  typstTemplate.value = await (await templates[template]).default
  $typst.setCompilerInitOptions({
    beforeBuild: [],
    getModule: () => '/typst/typst_ts_web_compiler_bg.wasm'
    // 'https://cdn.jsdelivr.net/npm/@myriaddreamin/typst-ts-web-compiler/pkg/typst_ts_web_compiler_bg.wasm'
  })

  $typst.setRendererInitOptions({
    beforeBuild: [],
    getModule: () => '/typst/typst_ts_renderer_bg.wasm'
    // 'https://cdn.jsdelivr.net/npm/@myriaddreamin/typst-ts-renderer/pkg/typst_ts_renderer_bg.wasm'
  })
  readyPromiseResolve()
})
</script>
