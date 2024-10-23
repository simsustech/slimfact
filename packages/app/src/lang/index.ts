import type { ClientDetails } from '@modular-api/fastify-checkout'
export interface Language {
  isoName: string
  edit: string
  cancel: string
  serverError: string
  search: string
  open: string
  goTo: string
  administrator: string
  employee: string
  tbd: string
  pricesSubjectToChange: string
  welcome: string
  privacyPolicy: string
  404: string
  goHome: string
  updateAvailable: string
  refresh: string
  settings: string
  name: string
  overview: string
  account: {
    title: string
    name: string
    fields: {
      email: string
      roles: string
      verified: string
      name: string
    }
    roles: {
      administrator: string
      employee: string
      pointofsale: string
      manager: string
    }
    messages: {
      addRole: string
      removeRole: string
      changeEmailAddress: string
    }
  }
  configuration: {
    title: string
    loading: string
    errorLoading: string
  }
  company: {
    title: string
    company: string
    fields: {
      name: string
      address: string
      postalCode: string
      city: string
      country: string
      telephoneNumber: string
      email: string
      cocNumber: string
      iban: string
      vatIdNumber: string
      contactPersonName: string
      website: string
      emailBcc: string
      prefix: string
      bic: string
      defaultNumberPrefixTemplate: string
      defaultLocale: string
      defaultCurrency: string
    }
    validations: {
      fieldRequired: string
    }
    helpers: {
      emailBcc: string
      prefix: string
    }
  }
  client: {
    title: string
    client: string
    fields: {
      number: string
      contactPersonName: string
      companyName: string
      address: string
      postalCode: string
      city: string
      country: string
      vatIdNumber: string
      email: string
    }
    validations: {
      fieldRequired: string
    }
    messages: {
      linkAccount: string
    }
  }
  invoice: {
    title: string
    invoice: string
    lines: string
    discounts: string
    surcharges: string
    fields: {
      locale: string
      currency: string
      companyPrefix: string
      numberPrefix: string
      paymentTermDays: string
      notes: string
      projectId: string
      status: string
      requiredDownPaymentAmount: string
    }
    status: {
      concept: string
      open: string
      paid: string
      receipt: string
      canceled: string
      bill: string
    }
    labels: {
      open: string
      download: string
      update: string
      send: string
      sendInvoice: string
      sendReminder: string
      sendExhortation: string
      markPaid: string
      cancel: string
      print: string
      openReference: string
    }
    messages: {
      markPaid: ({
        clientDetails,
        totalIncludingTax
      }: {
        clientDetails: ClientDetails
        totalIncludingTax: number | string
      }) => string
      addCashPayment: ({
        clientDetails,
        totalIncludingTax
      }: {
        clientDetails: ClientDetails
        totalIncludingTax: number | string
      }) => string
      addBankTransferPayment: ({
        clientDetails,
        totalIncludingTax
      }: {
        clientDetails: ClientDetails
        totalIncludingTax: number | string
      }) => string
      addPinPayment: ({
        clientDetails,
        totalIncludingTax
      }: {
        clientDetails: ClientDetails
        totalIncludingTax: number | string
      }) => string
      remindersSentOn: (dates: string[]) => string
      cancelInvoice: ({
        clientDetails,
        totalIncludingTax
      }: {
        clientDetails: ClientDetails
        totalIncludingTax: number
      }) => string
      downPaymentReceived: string
    }
  }
  numberPrefix: {
    title: string
    numberPrefix: string
    fields: {
      name: string
      template: string
    }
  }
  initialNumberForPrefix: {
    title: string
    fields: {
      initialNumber: string
    }
    messages: {
      numberPrefixHint: string
    }
  }
  subscription: {
    title: string
    fields: {
      active: string
      startDate: string
      endDate: string
      type: string
    }
    labels: {
      update: string
      start: string
      stop: string
    }
    types: {
      invoice: string
      bill: string
    }
  }
  receipt: {
    title: string
    receipt: string
  }
  bill: {
    title: string
    bill: string
    labels: {
      sendReceipt: string
    }
    messages: {
      createReceipt: ({
        clientDetails,
        totalIncludingTax
      }: {
        clientDetails: ClientDetails
        totalIncludingTax: number | string
      }) => string
      addCashPayment: ({
        clientDetails,
        totalIncludingTax
      }: {
        clientDetails: ClientDetails
        totalIncludingTax: number | string
      }) => string
      addPinPayment: ({
        clientDetails,
        totalIncludingTax
      }: {
        clientDetails: ClientDetails
        totalIncludingTax: number | string
      }) => string
    }
  }
  checkout: {
    success: string
  }
  payment: {
    payments: string
    pay: string
    addPayment: string
    amountDue: string
    amountPaid: string
    amountRefunded: string
    downPayment: string
    fields: {
      transactionReference: string
      description: string
    }
    methods: {
      cash: string
      bankTransfer: string
      ideal: string
      pin: string
    }
    messages: {
      scanQrOrUseInformationBelow: string
    }
  }
  refund: {
    refund: string
    refunds: string
    messages: {
      confirmRefund: (amount: number | string) => string
    }
  }
}

import type { Ref } from 'vue'
import { ref } from 'vue'
import en from './en-US.js'
export const lang = ref(en)

const locales = import.meta.glob<{ default: Language }>([
  './*.ts',
  '!./index.ts'
])

export const defineLang = (lang: Language) => {
  return lang
}

export const useLang = () => {
  return lang as Ref<Language>
}

let loadingLanguage = false
export const loadLang = async (isoName: string) => {
  if (!loadingLanguage) {
    loadingLanguage = true
    try {
      const data = (await locales[`./${isoName}.ts`]()).default

      if (data) {
        lang.value = data
      }
    } catch (e) {
      if (import.meta.env.DEBUG) console.error(e)
      throw new Error(`[slimfact] Failed to load ${isoName} language file.`)
    }
    loadingLanguage = false
  }
}
