import { type Invoice } from '@modular-api/fastify-checkout/types'
import { InvoiceStatus } from '@modular-api/fastify-checkout/types'
import { $typst } from '@myriaddreamin/typst.ts'
import {
  type SweetCompileOptions,
  type SweetRenderOptions
} from '@myriaddreamin/typst.ts/dist/esm/contrib/snippet.mjs'

export const computeNumberPrefix = ({
  numberPrefixTemplate,
  companyDetails,
  clientDetails,
  projectId
}: {
  numberPrefixTemplate: string
  companyDetails: {
    prefix: string
  }
  clientDetails?: {
    number?: string | number | null
  }
  projectId?: string | null
}) => {
  if (numberPrefixTemplate) {
    const currentDate = new Date()

    const template = {
      YYYY: currentDate.getFullYear(),
      MM: currentDate.getMonth() + 1,
      clientDetails: {
        number: clientDetails?.number
      },
      companyDetails: {
        prefix: companyDetails?.prefix
      },
      projectId: projectId
    }
    return (
      numberPrefixTemplate
        .replace('{{YYYY}}', template.YYYY.toString())
        .replace('{{MM}}', template.MM.toString())
        .replace(
          '{{clientDetails.number}}',
          template.clientDetails.number
            ? template.clientDetails.number.toString()
            : ''
        )
        .replace(
          '{{companyDetails.prefix}}',
          template.companyDetails.prefix.toString()
        )
        .replace(
          '{{projectId}}',
          template.projectId ? template.projectId.toString() : ''
        ) + '#'
    )
  }
}

const pageWidth = {
  a4: 210,
  'us-letter': 216
}
let typstInitialized = false
export const renderTypstInvoice = async ({
  invoice,
  typstTemplate,
  typstLang,
  typstInternal,
  options = {
    pageSize: 'a4',
    includeTax: true,
    export: 'svg'
  }
}: {
  invoice: Invoice
  typstTemplate: string
  typstInternal: string
  typstLang: string
  options?: {
    pageSize: 'a4' | 'us-letter'
    includeTax: boolean
    export: 'svg' | 'pdf'
  }
}) => {
  try {
    if (!typstInitialized) {
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
      typstInitialized = true
    }

    const compiledtemplate = typstTemplate
      .replace(`#import "./lang.typ": translations`, typstLang)
      .replace(
        '#import "./internal.typ": formatPrice, formatQuantity, formatPrice, quantityUnits, currencySymbols, formatDate, ternary',
        typstInternal
      )
    const renderOptions: SweetRenderOptions | SweetCompileOptions = {
      inputs: {
        invoice: JSON.stringify(invoice),
        includeTax: JSON.stringify(options.includeTax),
        pageSize: options.pageSize
      },
      mainContent: compiledtemplate
    }

    if (options.export === 'pdf') {
      const { default: lang } = await import(
        `./lang/${invoice.locale || 'en-US'}.js`
      )
      const pdf = await $typst.pdf({
        ...(renderOptions as SweetCompileOptions)
      })

      let filename = 'invoice.pdf'
      if (invoice && invoice?.status === InvoiceStatus.RECEIPT) {
        filename = `${lang.value.receipt.receipt} ${invoice.companyDetails.name || invoice.companyDetails.contactPersonName}.pdf`
      } else if (invoice && invoice?.status === InvoiceStatus.BILL) {
        filename = `${lang.value.bill.bill} ${invoice.companyDetails.name || invoice.companyDetails.contactPersonName}.pdf`
      } else if (invoice && invoice?.status === InvoiceStatus.CONCEPT) {
        filename = `${invoice.companyDetails.name}
      ${lang.value.invoice.status.concept}
      .pdf`
      } else if (invoice) {
        filename = `${invoice.date} ${invoice.companyDetails.name}
      ${lang.value.invoice.invoice}
      ${invoice.numberPrefix}${invoice.number}.pdf`
      }

      return {
        success: true,
        pdf,
        filename
      }
    } else {
      let svg = await $typst.svg({
        ...renderOptions,
        data_selection: {
          body: true,
          defs: true,
          css: true,
          js: false
        }
      })

      // Remove width and height attributes
      svg = svg.replace(
        /width="(.*?)"/,
        `width="${pageWidth[options.pageSize]}mm"`
      )
      svg = svg.replace(/height="(.*?)"/, '')

      return {
        success: true,
        svg
      }
    }
  } catch (e) {
    return {
      success: false,
      errorMessage: 'Failed to render invoice'
    }
  }
}
