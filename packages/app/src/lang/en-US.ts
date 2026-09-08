import type { Language } from './index.js'

const lang: Language = {
  isoName: 'en-US',
  edit: 'Edit',
  cancel: 'Cancel',
  serverError: 'Something went wrong...',
  search: 'Search...',
  open: 'Open',
  goTo: 'Go to',
  administrator: 'Administrator',
  employee: 'Employee',
  tbd: 'TBD',
  pricesSubjectToChange: 'Prices subject to change.',
  welcome: 'Welcome',
  privacyPolicy: 'Privacy policy',
  404: 'Oops, this page is not available...',
  goHome: 'Go to home page',
  updateAvailable: 'An update is available.',
  refresh: 'Refresh',
  name: 'Name',
  image: 'Image',
  overview: 'Overview',
  noResultsAvailable: 'No results available.',
  rowsPerPage: 'Rows per page',
  add: 'Add',
  darkMode: 'Dark mode',
  account: {
    title: 'Account',
    accounts: 'Accounts',
    name: 'Account',
    fields: {
      email: 'Email',
      verified: 'Verified',
      roles: 'Roles',
      name: 'Name'
    },
    roles: {
      administrator: 'Administrator',
      employee: 'Employee',
      pointofsale: 'Point of sale',
      manager: 'Manager'
    },
    messages: {
      addRole: 'Add role',
      removeRole: 'Remove role',
      changeEmailAddress: 'Change email address'
    }
  },
  configuration: {
    title: 'Configuration',
    loading: 'Loading configuration',
    errorLoading: 'An error has occured while loading the configuration.'
  },
  company: {
    title: 'Companies',
    company: 'Company',
    fields: {
      name: 'Name',
      address: 'Address',
      postalCode: 'Postal code',
      city: 'City',
      country: 'Country',
      telephoneNumber: 'Telephone number',
      email: 'Email',
      cocNumber: 'CoC number',
      iban: 'IBAN',
      vatIdNumber: 'VAT ID number',
      contactPersonName: 'Contact person name',
      website: 'Website',
      emailBcc: 'Email BCC',
      prefix: 'Prefix',
      bic: 'BIC',
      defaultNumberPrefixTemplate: 'Default number prefix',
      defaultLocale: 'Default locale',
      defaultCurrency: 'Default currency',
      defaultIncludeTax: 'Default incl. VAT'
    },
    validations: {
      fieldRequired: 'Field is required'
    },
    helpers: {
      emailBcc:
        'All invoices will be sent as BCC to these addresses, comma separated.',
      prefix: 'The company prefix used in e.g. the invoice number prefix.'
    }
  },
  client: {
    title: 'Clients',
    client: 'Client',
    fields: {
      number: 'Number',
      contactPersonName: 'Name contact person',
      companyName: 'Company name',
      address: 'Address',
      postalCode: 'Postal code',
      city: 'City',
      country: 'Country',
      vatIdNumber: 'VAT ID number',
      cocNumber: 'CoC number',
      email: 'Email'
    },
    validations: {
      fieldRequired: 'Field is required'
    },
    messages: {
      linkAccount: 'Link account to client.',
      addClient: 'Add a client.'
    }
  },
  invoice: {
    title: 'Invoices',
    invoice: 'Invoice',
    lines: 'Lines',
    discounts: 'Discounts',
    surcharges: 'Surcharges',
    fields: {
      locale: 'Locale',
      currency: 'Currency',
      companyPrefix: 'Company prefix',
      numberPrefix: 'Number prefix',
      paymentTermDays: 'Payment term in days',
      notes: 'Notes',
      projectId: 'Project ID',
      status: 'Status',
      requiredDownPaymentAmount: 'Required down payment'
    },
    status: {
      concept: 'Concept',
      open: 'Open',
      paid: 'Paid',
      receipt: 'Receipt',
      canceled: 'Canceled',
      bill: 'Bill',
      overdue: 'Overdue'
    },
    labels: {
      open: 'Open',
      download: 'Download',
      update: 'Update',
      send: 'Send',
      sendInvoice: 'Send invoice',
      sendReceipt: 'Send receipt',

      dueBy: (date: string) => `Due by ${date}`,
      sendReminder: 'Send reminder',
      sendExhortation: 'Send exhortation',
      markPaid: 'Mark paid',
      cancel: 'Cancel',
      print: 'Print',
      downloadPdfToPrint:
        'Please use the Download button to get the PDF, then print from your PDF viewer.',
      openReference: 'Open reference'
    },
    filters: {
      startDate: 'Start date',
      endDate: 'End date'
    },
    messages: {
      markPaid: ({ clientDetails, totalIncludingTax }) =>
        `Are you sure you want to mark the invoice to ${
          clientDetails.companyName || clientDetails.contactPersonName
        } with the amount of ${totalIncludingTax} as paid?`,
      addCashPayment: ({ clientDetails, totalIncludingTax }) =>
        `Enter the amount that was paid in cash for the invoice to ${
          clientDetails.companyName || clientDetails.contactPersonName
        } with the amount of ${totalIncludingTax}`,
      addBankTransferPayment: ({ clientDetails, totalIncludingTax }) =>
        `Enter the amount that was paid by bank transfer for the invoice to ${
          clientDetails.companyName || clientDetails.contactPersonName
        } with the amount of ${totalIncludingTax}`,
      addPinPayment: ({ clientDetails, totalIncludingTax }) =>
        `Enter the amount that was paid by pin for the invoice to ${
          clientDetails.companyName || clientDetails.contactPersonName
        } with the amount of ${totalIncludingTax}`,
      remindersSentOn: (dates) => `Reminders sent on ${dates.join('; ')}.`,
      cancelInvoice: ({ clientDetails, totalIncludingTax }) =>
        `Are you sure you want to cancel the invoice to ${
          clientDetails.companyName || clientDetails.contactPersonName
        } with the amount of ${totalIncludingTax}?`,
      downPaymentReceived: 'Down payment has been received.'
    }
  },
  numberPrefix: {
    title: 'Number prefixes',
    numberPrefix: 'Number prefix',
    fields: {
      name: 'Name',
      template: 'Template'
    }
  },
  initialNumberForPrefix: {
    title: 'Initial numbers',
    fields: {
      initialNumber: 'Initial number'
    },
    messages: {
      numberPrefixHint: 'Number prefix (without template)'
    }
  },
  subscription: {
    title: 'Subscriptions',
    fields: {
      active: 'Active',
      startDate: 'Start date',
      endDate: 'End date',
      type: 'Type'
    },
    labels: {
      update: 'Update',
      start: 'Start',
      stop: 'Stop'
    },
    types: {
      invoice: 'Invoice',
      bill: 'Bill'
    }
  },
  receipt: {
    title: 'Receipts',
    receipt: 'Receipt'
  },
  bill: {
    title: 'Bills',
    bill: 'Bill',
    labels: {
      sendReceipt: 'Send receipt'
    },
    messages: {
      createReceipt: ({ clientDetails, totalIncludingTax }) =>
        `Are you sure you want to create a receipt for the bill to ${
          clientDetails.companyName || clientDetails.contactPersonName
        } with the amount of ${totalIncludingTax}?`,
      addCashPayment: ({ clientDetails, totalIncludingTax }) =>
        `Enter the amount that was paid in cash for the bill to ${
          clientDetails.companyName || clientDetails.contactPersonName
        } with the amount of ${totalIncludingTax}`,
      addPinPayment: ({ clientDetails, totalIncludingTax }) =>
        `Enter the amount that was paid by pin for the bill to ${
          clientDetails.companyName || clientDetails.contactPersonName
        } with the amount of ${totalIncludingTax}`
    }
  },
  checkout: {
    success: 'Your payment was succesful and is being verified.'
  },
  payment: {
    payments: 'Payments',
    pay: 'Pay',
    addPayment: 'Add payment',

    confirmDeletePayment: ({
      method,
      number,
      amount
    }: {
      method: string
      number: string
      amount: string
    }) =>
      `Are you sure you want to delete the ${method} payment for invoice ${number} with the amount of ${amount}?`,
    amountDue: 'Amount due',
    amountPaid: 'Amount paid',
    amountRefunded: 'Amount refunded',
    downPayment: 'Down payment',
    fields: {
      transactionReference: 'Transaction reference',
      date: 'Date',
      description: 'Description'
    },
    methods: {
      cash: 'Cash',
      bankTransfer: 'Bank transfer',
      wero: 'Wero | iDEAL',
      pin: 'PIN',
      creditcard: 'Credit card'
    },
    descriptions: {
      cashPayment: 'Cash payment',
      bankTransferPayment: 'Bank transfer payment',
      pinPayment: 'PIN payment'
    },
    messages: {
      scanQrOrUseInformationBelow:
        'Scan the QR code if your bank supports it or use the information supplied below.'
    },
    overview: {
      title: 'Payments',
      fromDate: 'From',
      toDate: 'To',
      columns: {
        date: 'Date',
        method: 'Method',
        description: 'Description',
        invoice: 'Invoice',
        client: 'Client',
        amount: 'Amount',
        status: 'Status',
        psp: 'PSP'
      },
      in: 'In',
      refunded: 'Refunded',
      net: 'Net',
      count: 'Count',
      source: 'Source',
      sources: {
        payments: 'Payments',
        refunds: 'Refunds'
      },
      methods: 'Methods',
      statuses: 'Statuses',
      psps: 'PSPs',
      deletePayment: 'Delete payment',
      search: 'Search',
      refresh: 'Refresh',
      export: 'Export CSV',
      empty: 'No payments match the current filters.',
      truncated: 'Showing the first 10,000 rows — narrow your range.',
      tabs: {
        payments: 'Payments',
        suggestions: 'Suggestions'
      }
    },

    suggestions: {
      empty: 'No suggestions match the current filters.',
      loading: 'Loading suggestions…',
      link: 'Link',
      adoptBadge: 'Adopt',
      topSuggestion: 'Suggestion',
      score: 'Score',
      dismiss: 'Dismiss',
      confirmDismiss: ({ amount }: { amount: string }) =>
        `Are you sure you want to dismiss the suggestion of ${amount}?`
    }
  },
  refund: {
    refund: 'Refund',
    refunds: 'Refunds',
    messages: {
      confirmRefund: (amount) =>
        `Are you sure you want to refund the amount of ${amount}?`
    }
  },
  exports: {
    title: 'Exports'
  },
  dashboard: {
    account: {
      menu: {
        title: 'Quick menu',
        bills: 'View my bills.',
        receipts: 'View my receipts.',
        invoices: 'View my invoices.'
      }
    },
    admin: {
      title: 'Dashboard',
      companyFilter: {
        label: 'Company filter',
        allSelected: 'All companies',
        noneSelected: 'No companies selected'
      },
      revenue: {
        title: 'Revenue',
        today: 'Today',
        week: 'This week',
        month: 'This month',
        quarter: 'This quarter',
        year: 'This year',
        customRange: 'Custom range',
        startDate: 'Start',
        endDate: 'End',
        invoices: 'Invoices',
        bills: 'Bills',
        receipts: 'Receipts',
        chart: {
          title: 'Revenue over time',
          noData: 'No revenue in this period',
          bin: {
            day: 'Binned by day: each point is the revenue paid on that date.',
            week: 'Binned by week: each point is the revenue paid in that week.',
            month:
              'Binned by month: each point is the revenue paid in that month.',
            quarter:
              'Binned by quarter: each point is the revenue paid in that quarter.'
          }
        }
      },
      debtors: {
        title: 'Outstanding',
        toggle: {
          invoices: 'Invoices',
          bills: 'Bills'
        },
        empty: 'No outstanding invoices'
      },
      actionItems: {
        title: 'Action items',
        open: 'Open invoices',
        overdue: {
          needsReminder: 'Needs reminder',
          reminder1: 'First reminder sent',
          reminder2: 'Second reminder sent',
          exhortation: 'Exhortation'
        }
      },
      upcomingIncome: {
        title: 'Upcoming income',
        titleOverdue: 'Overdue income',
        invoices: 'open invoices',
        due: 'due',
        empty: 'No invoices due yet',
        emptyOverdue: 'No overdue invoices',
        toggle: {
          upcoming: 'Upcoming',
          overdue: 'Overdue'
        }
      },
      paymentMethods: {
        title: 'Paid by payment method'
      },
      recentActivity: {
        title: 'Recent activity',
        forInvoice: 'for invoice',
        filter: {
          label: 'Activity filter',
          all: 'All',
          invoiceOpened: 'Invoice opened',
          billCreated: 'Bill created',
          payment: 'Payment received',
          reminder: 'Reminder sent',
          exhortation: 'Exhortation sent'
        }
      },
      empty: {
        noData: 'No data available',
        noCompanySelected: 'Select a company to view stats'
      }
    }
  },
  settings: { title: 'Settings' },
  bank: {
    title: 'Bank',
    pages: {
      overview: 'Overview',
      review: 'Review',
      settings: 'Settings'
    },
    columns: {
      date: 'Date',
      amount: 'Amount',
      counterparty: 'Counterparty',
      description: 'Description',
      account: 'Account',
      company: 'Company',
      linked: 'Status',
      match: 'Match'
    },
    actions: {
      refresh: 'Refresh',
      link: 'Link',
      view: 'View',
      viewLinked: 'View linked invoices',
      linkTransaction: 'Link transaction',
      syncNow: 'Sync now',
      linkCompanies: 'Link companies'
    },
    coverage: {
      unlinked: 'Unlinked',
      partial: 'Partially linked',
      full: 'Linked',
      settled: 'Settled'
    },
    settlementDetails: 'Settlement details',
    linkDialog: {
      title: 'Link bank credit',
      confirm: 'Link',
      cancel: 'Cancel',
      pspSettlement: 'PSP settlement {id}',
      pspPayments: 'PSP payments',
      splitRemaining:
        '{amount} of {total} — the remaining {remaining} is covered by other transaction(s)',
      multiTotal: 'Total {amount}',
      selectInvoices: 'Select invoices',
      noCandidates: 'No open invoices to link',
      selectedTotal: '{amount} selected',
      matchComplete: 'Full amount covered',
      matchDifference: '{amount} remaining',
      matchOver: '{amount} over',
      fee: 'Fee {amount}'
    },
    linked: 'Linked',
    suggested: 'Suggested',
    unlinked: 'Unlinked',
    linkedTo: 'Linked to {number}',
    adopt: 'Link to payment on invoice {number} (already paid by bank)',
    allLinked: 'All',
    onlySuggestions: 'Suggestions only',
    adoptNote: 'This invoice was already paid by bank transfer.',
    linkedDocuments: 'Linked documents',
    unlinkedTransactions: 'Unlinked transactions',
    fromDate: 'From',
    toDate: 'To',
    syncing: 'Syncing…',
    syncRequested: 'Sync requested',
    syncRunning: 'Syncing…',
    empty: 'No bank transactions yet.',
    reviewEmpty: 'Nothing to match — all incoming credits are settled.',
    notConfigured:
      'Open-banking is not configured. Set OPENBANKING_CREDENTIALS_JSON to enable bank import.',
    connections: 'Connections',
    noConnections: 'No bank connections found.',
    validUntil: 'Valid until',
    accounts: 'Accounts',
    companyFilter: 'Companies',
    noAccounts: 'No accounts yet.',
    requiresReauth: 'Reauthorization required',
    statusActive: 'Active',
    allCompanies: 'All companies',
    syncCompleted: 'Sync completed',
    syncFailed: 'Sync failed',
    actionFailed: 'Action failed',
    suggestionMulti: '{count} invoices',
    partialCoverageLinked: '{linked} of {total} linked'
  },
  invoiceEvents: {
    events: 'Events',
    types: {
      emailOpened: 'Invoice opened from email.',
      paymentDeleted: 'Payment deleted.'
    }
  }
}

export default lang
