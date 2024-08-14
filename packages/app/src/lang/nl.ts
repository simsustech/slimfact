import type { Language } from './index.js'

const lang: Language = {
  isoName: 'nl',
  edit: 'Wijzigen',
  cancel: 'Annuleren',
  serverError: 'Er ging iets fout...',
  search: 'Zoeken...',
  open: 'Openen',
  goTo: 'Ga naar',
  administrator: 'Administrator',
  employee: 'Medewerker',
  tbd: 'n.o.t.k.',
  pricesSubjectToChange: 'Prijzen onder voorbehoud.',
  welcome: 'Welkom',
  privacyPolicy: 'Privacy verklaring',
  404: 'Oeps, deze pagina is niet beschikbaar...',
  goHome: 'Ga naar home page',
  updateAvailable: 'Er is een update beschikbaar.',
  refresh: 'Vernieuwen',
  settings: 'Instellingen',
  name: 'Naam',
  overview: 'Overzicht',
  account: {
    title: 'Account',
    name: 'Account',
    fields: {
      email: 'Email',
      verified: 'Geverifieerd',
      roles: 'Rollen',
      name: 'Naam'
    },
    roles: {
      administrator: 'Administrator',
      employee: 'Medewerker',
      pointofsale: 'Verkooppunt',
      manager: 'Manager'
    },
    messages: {
      addRole: 'Rol toevoegen',
      removeRole: 'Rol verwijderen',
      changeEmailAddress: 'Wijzig email adres'
    }
  },
  configuration: {
    title: 'Configuratie',
    loading: 'Configuratie laden',
    errorLoading: 'Er is een fout opgetreden bij het laden van de configuratie.'
  },
  company: {
    title: 'Bedrijven',
    company: 'Bedrijf',
    fields: {
      name: 'Naam',
      address: 'Adres',
      postalCode: 'Postcode',
      city: 'Woonplaats',
      country: 'Land',
      telephoneNumber: 'Telefoonnummer',
      email: 'Email',
      cocNumber: 'KvK nummer',
      iban: 'IBAN',
      vatIdNumber: 'BTW ID nummer',
      contactPersonName: 'Naam contact persoon',
      prefix: 'Voorvoegsel',
      emailBcc: 'Email BCC',
      website: 'Website',
      bic: 'BIC',
      defaultNumberPrefixTemplate: 'Standaard nummer voorvoegsel',
      defaultLocale: 'Standaard regio'
    },
    validations: {
      fieldRequired: 'Veld is vereist'
    },
    helpers: {
      emailBcc: 'Alle facturen worden BCC verstuurd naar dit adres.',
      prefix:
        'Het bedrijfsvoorvoegsel gebruikt in het nummervoorvoegsel van een factuur.'
    }
  },
  client: {
    title: 'Klanten',
    client: 'Klant',
    fields: {
      number: 'Nummer',
      contactPersonName: 'Naam contact persoon',
      companyName: 'Bedrijfsnaam',
      address: 'Adres',
      postalCode: 'Postcode',
      city: 'Woonplaats',
      country: 'Land',
      vatIdNumber: 'BTW ID nummer',
      email: 'Email'
    },
    validations: {
      fieldRequired: 'Veld is vereist'
    },
    messages: {
      linkAccount: 'Link account aan klant.'
    }
  },
  invoice: {
    title: 'Facturen',
    invoice: 'Factuur',
    lines: 'Regels',
    discounts: 'Kortingen',
    surcharges: 'Toeslagen',
    fields: {
      locale: 'Regio',
      currency: 'Valuta',
      companyPrefix: 'Bedrijfs voorvoegsel',
      numberPrefix: 'Nummer voorvoegsel',
      paymentTermDays: 'Betalingstermijn in dagen',
      notes: 'Notities',
      projectId: 'Project ID',
      status: 'Status',
      requiredDownPaymentAmount: 'Vereiste aanbetaling'
    },
    status: {
      concept: 'Concept',
      open: 'Open',
      paid: 'Betaald',
      receipt: 'Bon',
      canceled: 'Geannuleerd',
      bill: 'Rekening'
    },
    labels: {
      open: 'Openen',
      download: 'Download',
      update: 'Update',
      send: 'Versturen',
      sendInvoice: 'Verstuur factuur',
      sendReminder: 'Verstuur herinnering',
      sendExhortation: 'Verstuur aanmaning',
      markPaid: 'Markeer betaald',
      cancel: 'Annuleer',
      print: 'Print'
    },
    messages: {
      markPaid: ({ clientDetails, totalIncludingTax }) =>
        `Weet u zeker dat u de factuur aan ${clientDetails.companyName || clientDetails.contactPersonName} ter hoogte van ${totalIncludingTax} wilt markeren als betaald?`,
      addCashPayment: ({ clientDetails, totalIncludingTax }) =>
        `Vul het bedrag in dat contant is betaald aan de factuur aan ${clientDetails.companyName || clientDetails.contactPersonName} ter hoogte van ${totalIncludingTax}.`,
      addBankTransferPayment: ({ clientDetails, totalIncludingTax }) =>
        `Vul het bedrag in dat per bankoverschrijving is betaald aan de factuur aan ${clientDetails.companyName || clientDetails.contactPersonName} ter hoogte van ${totalIncludingTax}.`,
      remindersSentOn: (dates) =>
        `Herinneringen verstuurd op ${dates.join('; ')}.`,
      cancelInvoice: ({ clientDetails, totalIncludingTax }) =>
        `Weet u zeker dat u de factuur aan ${clientDetails.companyName || clientDetails.contactPersonName} ter hoogte van ${totalIncludingTax} wilt annuleren?`
    }
  },
  numberPrefix: {
    title: 'Nummer voorvoegsels',
    numberPrefix: 'Nummer voorvoegsel',
    fields: {
      name: 'Naam',
      template: 'Sjabloon'
    }
  },
  initialNumberForPrefix: {
    title: 'Eerstvolgende nummers',
    fields: {
      initialNumber: 'Eerstvolgend nummer'
    },
    messages: {
      numberPrefixHint: 'Nummer voorvoegsel (zonder sjabloon)'
    }
  },
  subscription: {
    title: 'Abonnementen',
    fields: {
      active: 'Actief',
      startDate: 'Start datum',
      endDate: 'End date',
      type: 'Type'
    },
    labels: {
      update: 'Update',
      start: 'Start',
      stop: 'Stop'
    }
  },
  receipt: {
    title: 'Bonnen',
    receipt: 'Bon'
  },
  bill: {
    title: 'Rekeningen',
    bill: 'Rekening',
    labels: {
      sendReceipt: 'Verstuur bon'
    },
    messages: {
      createReceipt: ({ clientDetails, totalIncludingTax }) =>
        `Weet u zeker dat u een bon wilt maken voor de rekening aan ${clientDetails.companyName || clientDetails.contactPersonName} ter hoogte van ${totalIncludingTax}?`
    }
  },
  checkout: {
    success: 'Uw betaling is gelukt en wordt geverifieerd.'
  },
  payment: {
    payments: 'Betalingen',
    pay: 'Betaal',
    addPayment: 'Betaling toevoegen',
    amountDue: 'Te betalen',
    amountPaid: 'Betaald',
    downPayment: 'Aanbetaling',
    fields: {
      transactionReference: 'Transactie referentie',
      description: 'Omschrijving'
    },
    methods: {
      cash: 'Contant',
      bankTransfer: 'Bank overschrijving',
      ideal: 'iDEAL'
    },
    messages: {
      scanQrOrUseInformationBelow:
        'Scan de QR code als uw bank dit ondersteunt of gebruik de informatie zoals hieronder weergegeven.'
    }
  },
  refund: {
    refund: 'Terugbetaling',
    refunds: 'Terugbetalingen',
    messages: {
      confirmRefund: (amount) =>
        `Weet u zeker dat u een terugbetaling t.w.v. ${amount} wil doen?`
    }
  }
}

export default lang
