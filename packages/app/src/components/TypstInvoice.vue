<template>
  <div v-if="svg" class="[&>svg]:(border-1px border-solid)" v-html="svg" />
</template>

<script setup lang="ts">
import { onMounted, ref, toRefs, watch } from 'vue'
import { type InvoicePayload } from '@modular-api/fastify-checkout'
import { InvoiceStatus } from '@modular-api/fastify-checkout/types'
import { $typst } from '@myriaddreamin/typst.ts'
import typstLang from '@slimfact/tools/templates/invoice/lang.typ?raw'
import typstInternal from '@slimfact/tools/templates/invoice/internal.typ?raw'
import { useLang } from 'src/lang'
import {
  SweetCompileOptions,
  SweetRenderOptions
} from '@myriaddreamin/typst.ts/dist/esm/contrib/snippet.mjs'
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
const props = withDefaults(defineProps<Props>(), {
  template: 'default',
  pageSize: 'a4'
})
const { modelValue, includeTax, pageSize, template } = toRefs(props)
const lang = useLang()

const svg = ref<string>()
const typstTemplate = ref()

const renderOptions = ref<SweetRenderOptions | SweetCompileOptions>({})

watch(
  () => typstTemplate.value,
  async (newVal, _) => {
    const result = await renderTypstInvoice({
      $typst,
      invoice: modelValue.value,
      typstTemplate: newVal,
      typstLang,
      typstInternal,
      options: {
        export: 'svg',
        includeTax: includeTax.value,
        pageSize: pageSize.value,
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
    invoice: modelValue.value,
    typstTemplate: typstTemplate.value,
    typstLang,
    typstInternal,
    options: {
      export: 'pdf',
      includeTax: includeTax.value,
      pageSize: pageSize.value,
      typstCompilerUrl: '/typst/typst_ts_web_compiler_bg.wasm',
      typstRendererUrl: '/typst/typst_ts_renderer_bg.wasm'
    }
  })
  if (result.success && result.pdf) {
    exportFile(result.filename ?? 'invoice.pdf', result.pdf)
  }
  // const pdf = await $typst.pdf({
  //   ...(renderOptions.value as SweetCompileOptions)
  // })

  // let filename = 'invoice.pdf'
  // if (modelValue.value && modelValue.value?.status === InvoiceStatus.RECEIPT) {
  //   filename = `${lang.value.receipt.receipt} ${modelValue.value.companyDetails.name || modelValue.value.companyDetails.contactPersonName}.pdf`
  // } else if (
  //   modelValue.value &&
  //   modelValue.value?.status === InvoiceStatus.BILL
  // ) {
  //   filename = `${lang.value.bill.bill} ${modelValue.value.companyDetails.name || modelValue.value.companyDetails.contactPersonName}.pdf`
  // } else if (
  //   modelValue.value &&
  //   modelValue.value?.status === InvoiceStatus.CONCEPT
  // ) {
  //   filename = `${modelValue.value.companyDetails.name}
  //     ${lang.value.invoice.status.concept}
  //     .pdf`
  // } else if (modelValue.value) {
  //   filename = `${modelValue.value.date} ${modelValue.value.companyDetails.name}
  //     ${lang.value.invoice.invoice}
  //     ${modelValue.value.numberPrefix}${modelValue.value.number}.pdf`
  // }

  // if (pdf) {
  //   exportFile(filename, pdf)
  // }
}

defineExpose({
  downloadPdf
})

onMounted(async () => {
  typstTemplate.value = await (await templates.default).default
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
