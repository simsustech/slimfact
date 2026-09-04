import type { ClientDetails } from '@modular-api/fastify-checkout'
export interface Language {
  isoName: string
  /** tRPC error-code → localized message factory (optional). */
  errors?: Record<
    string,
    (args: { path?: unknown; expected?: unknown; received?: unknown }) => string
  >
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
  name: string
  overview: string
  noResultsAvailable: string
  rowsPerPage: string
  add: string
  darkMode: string
  account: {
    title: string
    accounts: string
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
      defaultIncludeTax: string
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
      cocNumber: string
      email: string
    }
    validations: {
      fieldRequired: string
    }
    messages: {
      linkAccount: string
      addClient: string
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
      overdue: string
    }
    labels: {
      open: string
      download: string
      update: string
      send: string
      sendInvoice: string
      sendReceipt: string
      sendReminder: string
      sendExhortation: string
      markPaid: string
      cancel: string
      print: string
      downloadPdfToPrint: string
      openReference: string
      dueBy: (date: string) => string
    }
    filters: {
      startDate: string
      endDate: string
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
        totalIncludingTax: number | string
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
    confirmDeletePayment: (args: {
      method: string
      number: string
      amount: string
    }) => string
    amountDue: string
    amountPaid: string
    amountRefunded: string
    downPayment: string
    fields: {
      transactionReference: string
      date: string
      description: string
    }
    methods: {
      cash: string
      bankTransfer: string
      wero: string
      pin: string
      creditcard: string
    }
    descriptions: {
      cashPayment: string
      bankTransferPayment: string
      pinPayment: string
    }
    messages: {
      scanQrOrUseInformationBelow: string
    }
    overview: {
      title: string
      fromDate: string
      toDate: string
      columns: {
        date: string
        method: string
        description: string
        invoice: string
        client: string
        amount: string
        status: string
        psp: string
      }
      in: string
      refunded: string
      net: string
      count: string
      unallocated: string
      viaBankSync: string
      needsReview: string
      source: string
      sources: {
        payments: string
        refunds: string
        bankReview: string
      }
      methods: string
      statuses: string
      psps: string
      deletePayment: string
      search: string
      refresh: string
      export: string
      empty: string
      truncated: string
    }
  }
  refund: {
    refund: string
    refunds: string
    messages: {
      confirmRefund: (amount: number | string) => string
    }
  }
  exports: {
    title: string
  }
  dashboard: {
    account: {
      menu: {
        title: string
        bills: string
        receipts: string
        invoices: string
      }
    }
    admin: {
      title: string
      companyFilter: {
        label: string
        allSelected: string
        noneSelected: string
      }
      revenue: {
        title: string
        today: string
        week: string
        month: string
        quarter: string
        year: string
        customRange: string
        startDate: string
        endDate: string
        invoices: string
        bills: string
        receipts: string
        chart: {
          title: string
          noData: string
          bin: {
            day: string
            week: string
            month: string
            quarter: string
          }
        }
      }
      debtors: {
        title: string
        toggle: {
          invoices: string
          bills: string
        }
        empty: string
      }
      actionItems: {
        title: string
        open: string
        overdue: {
          needsReminder: string
          reminder1: string
          reminder2: string
          exhortation: string
        }
      }
      upcomingIncome: {
        title: string
        titleOverdue: string
        invoices: string
        due: string
        empty: string
        emptyOverdue: string
        toggle: {
          upcoming: string
          overdue: string
        }
      }
      paymentMethods: {
        title: string
      }
      recentActivity: {
        title: string
        forInvoice: string
        filter: {
          label: string
          all: string
          invoiceOpened: string
          billCreated: string
          payment: string
          reminder: string
          exhortation: string
        }
      }
      empty: {
        noData: string
        noCompanySelected: string
      }
    }
  }
  settings: {
    title: string
  }
  bank: {
    title: string
    pages: {
      overview: string
      review: string
      settings: string
    }
    columns: {
      date: string
      amount: string
      counterparty: string
      description: string
      account: string
      company: string
      linked: string
      match: string
    }
    actions: {
      refresh: string
      link: string
      view: string
      viewLinked: string
      linkTransaction: string
      syncNow: string
      linkCompanies: string
    }
    coverage: {
      unlinked: string
      partial: string
      full: string
      settled: string
    }
    settlementDetails: string
    linkDialog: {
      title: string
      confirm: string
      cancel: string
      pspSettlement: string
      pspPayments: string
      splitRemaining: string
      multiTotal: string
      selectInvoices: string
      noCandidates: string
      selectedTotal: string
      matchComplete: string
      matchDifference: string
      matchOver: string
      fee: string
    }
    linked: string
    suggested: string
    unlinked: string
    linkedTo: string
    adopt: string
    allLinked: string
    onlySuggestions: string
    adoptNote: string
    linkedDocuments: string
    unlinkedTransactions: string
    fromDate: string
    toDate: string
    syncing: string
    syncRequested: string
    syncRunning: string
    empty: string
    reviewEmpty: string
    notConfigured: string
    noConnections: string
    connections: string
    validUntil: string
    accounts: string
    companyFilter: string
    noAccounts: string
    requiresReauth: string
    statusActive: string
    allCompanies: string
    syncCompleted: string
    syncFailed: string
    actionFailed: string
    suggestionMulti: string
    partialCoverageLinked: string
  }
  invoiceEvents: {
    events: string
    types: {
      emailOpened: string
      paymentDeleted: string
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
