<template>
  <div v-if="svg" class="[&>svg]:(border-1px border-solid)" v-html="svg" />
</template>

<script setup lang="ts">
import { onMounted, ref, toRefs, watch } from 'vue'
import { type InvoicePayload } from '@modular-api/fastify-checkout'
import { InvoiceStatus } from '@modular-api/fastify-checkout/types'
import { $typst } from '@myriaddreamin/typst.ts'
import typstLang from '../assets/templates/invoice/lang.typ?raw'
import typstInternal from '../assets/templates/invoice/internal.typ?raw'
import { useLang } from 'src/lang'
import {
  SweetCompileOptions,
  SweetRenderOptions
} from '@myriaddreamin/typst.ts/dist/esm/contrib/snippet.mjs'
import { exportFile } from 'quasar'

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

const mainContent = ref('')
const svg = ref<string>()
const typstTemplate = ref()

const renderOptions = ref<SweetRenderOptions | SweetCompileOptions>({})

const pageWidth = {
  a4: 210,
  'us-letter': 216
}

watch(
  () => typstTemplate.value,
  async (newVal, _) => {
    mainContent.value = newVal
      .replace(`#import "./lang.typ": translations`, typstLang)
      .replace(
        '#import "./internal.typ": formatPrice, formatQuantity, formatPrice, quantityUnits, currencySymbols, formatDate, ternary',
        typstInternal
      )
    renderOptions.value = {
      inputs: {
        invoice: JSON.stringify(modelValue.value),
        includeTax: JSON.stringify(includeTax.value),
        pageSize: pageSize.value
      },
      mainContent: mainContent.value
    }
    svg.value = await $typst.svg({
      ...renderOptions.value,
      data_selection: {
        body: true,
        defs: true,
        css: true,
        js: false
      }
    })
    // Remove width and height attributes
    svg.value = svg.value.replace(
      /width="(.*?)"/,
      `width="${pageWidth[pageSize.value]}mm"`
    )
    svg.value = svg.value.replace(/height="(.*?)"/, '')
  }
)

const downloadPdf = async () => {
  const pdf = await $typst.pdf({
    ...(renderOptions.value as SweetCompileOptions)
  })

  let filename = 'invoice.pdf'
  if (modelValue.value && modelValue.value?.status === InvoiceStatus.RECEIPT) {
    filename = `${lang.value.receipt.receipt} ${modelValue.value.companyDetails.name || modelValue.value.companyDetails.contactPersonName}.pdf`
  } else if (
    modelValue.value &&
    modelValue.value?.status === InvoiceStatus.BILL
  ) {
    filename = `${lang.value.bill.bill} ${modelValue.value.companyDetails.name || modelValue.value.companyDetails.contactPersonName}.pdf`
  } else if (
    modelValue.value &&
    modelValue.value?.status === InvoiceStatus.CONCEPT
  ) {
    filename = `${modelValue.value.companyDetails.name}
      ${lang.value.invoice.status.concept}
      .pdf`
  } else if (modelValue.value) {
    filename = `${modelValue.value.date} ${modelValue.value.companyDetails.name}
      ${lang.value.invoice.invoice}
      ${modelValue.value.numberPrefix}${modelValue.value.number}.pdf`
  }

  if (pdf) {
    exportFile(filename, pdf)
  }
}

defineExpose({
  downloadPdf
})

onMounted(async () => {
  typstTemplate.value = (
    await import(`../assets/templates/invoice/${template.value}.typ?raw`)
  ).default
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
})
</script>
