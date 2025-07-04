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
  overview: 'Overview',
  noResultsAvailable: 'No results available.',
  add: 'Add',
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
      defaultCurrency: 'Default currency'
    },
    validations: {
      fieldRequired: 'Field is required'
    },
    helpers: {
      emailBcc: 'All invoices will be sent as BCC to this address.',
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
      bill: 'Bill'
    },
    labels: {
      open: 'Open',
      download: 'Download',
      update: 'Update',
      send: 'Send',
      sendInvoice: 'Send invoice',
      sendReceipt: 'Send receipt',
      sendReminder: 'Send reminder',
      sendExhortation: 'Send exhortation',
      markPaid: 'Mark paid',
      cancel: 'Cancel',
      print: 'Print',
      openReference: 'Open reference'
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
    amountDue: 'Amount due',
    amountPaid: 'Amount paid',
    amountRefunded: 'Amount refunded',
    downPayment: 'Down payment',
    fields: {
      transactionReference: 'Transaction reference',
      description: 'Description'
    },
    methods: {
      cash: 'Cash',
      bankTransfer: 'Bank transfer',
      ideal: 'iDEAL',
      pin: 'PIN'
    },
    messages: {
      scanQrOrUseInformationBelow:
        'Scan the QR code if your bank supports it or use the information supplied below.'
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
    }
  },
  settings: { title: 'Settings' }
}

export default lang
