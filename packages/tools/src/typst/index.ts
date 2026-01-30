import { type Invoice } from '@modular-api/fastify-checkout'
import { InvoiceStatus } from '@modular-api/fastify-checkout/types'
import { type TypstSnippet } from '@myriaddreamin/typst.ts/dist/esm/contrib/snippet.mjs'
import {
  type SweetCompileOptions,
  type SweetRenderOptions
} from '@myriaddreamin/typst.ts/dist/esm/contrib/snippet.mjs'
import {
  NodeCompiler,
  type CompileDocArgs
} from '@myriaddreamin/typst-ts-node-compiler'
import { RenderSvgOptions } from '@myriaddreamin/typst.ts/dist/esm/options.render.mjs'

export type TypstInvoiceTemplates = 'default'
export type TypstInvoiceLocales = 'nl' | 'en-US'
const pageWidth = {
  a4: 210,
  'us-letter': 216
}

const lang = {
  nl: {
    concept: 'Concept',
    bill: 'Rekening',
    receipt: 'Bon',
    invoice: 'Factuur'
  },
  'en-US': {
    concept: 'Concept',
    bill: 'Bill',
    receipt: 'Receipt',
    invoice: 'Invoice'
  }
}

export const renderTypstInvoice = async ({
  $typst,
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
  $typst: TypstSnippet | NodeCompiler
  invoice: Invoice
  typstTemplate: string
  typstInternal: string
  typstLang: string
  options?: {
    pageSize: 'a4' | 'us-letter'
    includeTax: boolean
    export: 'svg' | 'pdf'
    typstCompilerUrl?: string
    typstRendererUrl?: string
  }
}) => {
  try {
    const compiledtemplate = typstTemplate
      .replace(`#import "./lang.typ": translations`, typstLang)
      .replace(
        '#import "./internal.typ": formatPrice, formatQuantity, formatPrice, quantityUnits, currencySymbols, formatDate, ternary',
        typstInternal
      )
    const renderOptions:
      | SweetRenderOptions
      | SweetCompileOptions
      | CompileDocArgs = {
      inputs: {
        invoice: JSON.stringify(invoice),
        includeTax: JSON.stringify(options.includeTax),
        pageSize: options.pageSize
      },
      mainContent: compiledtemplate,

      mainFileContent: compiledtemplate
    }

    if (options.export === 'pdf') {
      const pdf = await $typst.pdf({
        ...(renderOptions as SweetCompileOptions)
      })

      let filename = 'invoice.pdf'
      const locale = invoice.locale as TypstInvoiceLocales
      if (invoice && invoice?.status === InvoiceStatus.RECEIPT) {
        filename = `${lang[locale].receipt} ${invoice.companyDetails.name || invoice.companyDetails.contactPersonName}.pdf`
      } else if (invoice && invoice?.status === InvoiceStatus.BILL) {
        filename = `${lang[locale].bill} ${invoice.companyDetails.name || invoice.companyDetails.contactPersonName}.pdf`
      } else if (invoice && invoice?.status === InvoiceStatus.CONCEPT) {
        filename = `${invoice.companyDetails.name}
      ${lang[locale].concept}
      .pdf`
      } else if (invoice) {
        filename = `${invoice.date} ${invoice.companyDetails.name}
      ${lang[locale].invoice}
      ${invoice.numberPrefix}${invoice.number}.pdf`
      }

      if ('evictCache' in $typst) $typst.evictCache(10)

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
      } as SweetRenderOptions & RenderSvgOptions)

      // Remove width and height attributes
      svg = svg.replace(
        /width="(.*?)"/,
        `width="${pageWidth[options.pageSize]}mm"`
      )
      svg = svg.replace(/height="(.*?)"/, '')

      if ('evictCache' in $typst) $typst.evictCache(10)

      return {
        success: true,
        svg
      }
    }
  } catch (e) {
    console.error(e)
    return {
      success: false,
      errorMessage: e
    }
  }
}
