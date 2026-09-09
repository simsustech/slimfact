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
  name: 'Naam',
  image: 'Afbeelding',
  overview: 'Overzicht',
  noResultsAvailable: 'Geen resultaten beschikbaar.',
  rowsPerPage: 'Regels per pagina',
  add: 'Toevoegen',
  darkMode: 'Donkere modus',
  account: {
    title: 'Account',
    accounts: 'Accounts',
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
      defaultLocale: 'Standaard regio',
      defaultCurrency: 'Standaard valuta',
      defaultIncludeTax: 'Standaard incl. btw'
    },
    validations: {
      fieldRequired: 'Veld is vereist'
    },
    helpers: {
      emailBcc: `Alle facturen worden als BCC naar deze adressen verzonden, gescheiden door komma's.`,
      prefix:
        'Het bedrijfsvoorvoegsel gebruikt in o.a. het nummervoorvoegsel van een factuur. '
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
      cocNumber: 'KvK nummer',
      email: 'Email'
    },
    validations: {
      fieldRequired: 'Veld is vereist'
    },
    messages: {
      linkAccount: 'Link account aan klant.',
      addClient: 'Voeg een klant toe.'
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
      receipt: 'Kwitantie',
      canceled: 'Geannuleerd',
      bill: 'Rekening',
      overdue: 'Vervallen'
    },
    labels: {
      open: 'Openen',
      download: 'Download',
      update: 'Update',
      send: 'Versturen',
      sendInvoice: 'Verstuur factuur',
      sendReceipt: 'Verstuur kwitantie',

      dueBy: (date: string) => `Vervalt op ${date}`,
      sendReminder: 'Verstuur herinnering',
      sendExhortation: 'Verstuur aanmaning',
      markPaid: 'Markeer betaald',
      cancel: 'Annuleer',
      print: 'Print',
      downloadPdfToPrint:
        'Gebruik de downloadknop om de PDF op te halen en print deze vanuit uw PDF-viewer.',
      openReference: 'Open referentie'
    },
    filters: {
      startDate: 'Startdatum',
      endDate: 'Einddatum'
    },
    messages: {
      markPaid: ({ clientDetails, totalIncludingTax }) =>
        `Weet u zeker dat u de factuur aan ${
          clientDetails.companyName || clientDetails.contactPersonName
        } ter hoogte van ${totalIncludingTax} wilt markeren als betaald?`,
      addCashPayment: ({ clientDetails, totalIncludingTax }) =>
        `Vul het bedrag in dat contant is betaald aan de factuur aan ${
          clientDetails.companyName || clientDetails.contactPersonName
        } ter hoogte van ${totalIncludingTax}.`,
      addBankTransferPayment: ({ clientDetails, totalIncludingTax }) =>
        `Vul het bedrag in dat per bankoverschrijving is betaald aan de factuur aan ${
          clientDetails.companyName || clientDetails.contactPersonName
        } ter hoogte van ${totalIncludingTax}.`,
      addPinPayment: ({ clientDetails, totalIncludingTax }) =>
        `Vul het bedrag in dat per pin is betaald aan de factuur aan ${
          clientDetails.companyName || clientDetails.contactPersonName
        } ter hoogte van ${totalIncludingTax}.`,
      remindersSentOn: (dates) =>
        `Herinneringen verstuurd op ${dates.join('; ')}.`,
      cancelInvoice: ({ clientDetails, totalIncludingTax }) =>
        `Weet u zeker dat u de factuur aan ${
          clientDetails.companyName || clientDetails.contactPersonName
        } ter hoogte van ${totalIncludingTax} wilt annuleren?`,
      downPaymentReceived: 'Aanbetaling is ontvangen.'
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
    },
    types: {
      invoice: 'Factuur',
      bill: 'Rekening'
    }
  },
  receipt: {
    title: 'Kwitanties',
    receipt: 'Kwitantie'
  },
  bill: {
    title: 'Rekeningen',
    bill: 'Rekening',
    labels: {
      sendReceipt: 'Verstuur kwitantie'
    },
    messages: {
      createReceipt: ({ clientDetails, totalIncludingTax }) =>
        `Weet u zeker dat u een kwitantie wilt maken voor de rekening aan ${
          clientDetails.companyName || clientDetails.contactPersonName
        } ter hoogte van ${totalIncludingTax}?`,
      addCashPayment: ({ clientDetails, totalIncludingTax }) =>
        `Vul het bedrag in dat contant is betaald aan de rekening aan ${
          clientDetails.companyName || clientDetails.contactPersonName
        } ter hoogte van ${totalIncludingTax}.`,
      addPinPayment: ({ clientDetails, totalIncludingTax }) =>
        `Vul het bedrag in dat per pin is betaald aan de rekening aan ${
          clientDetails.companyName || clientDetails.contactPersonName
        } ter hoogte van ${totalIncludingTax}.`
    }
  },
  checkout: {
    success: 'Uw betaling is gelukt en wordt geverifieerd.'
  },
  payment: {
    payments: 'Betalingen',
    pay: 'Betaal',
    addPayment: 'Betaling toevoegen',

    confirmDeletePayment: ({
      method,
      number,
      amount
    }: {
      method: string
      number: string
      amount: string
    }) =>
      `Weet u zeker dat u de ${method} voor factuur ${number} met een bedrag van ${amount} wilt verwijderen?`,
    amountDue: 'Te betalen',
    amountPaid: 'Betaald',
    amountRefunded: 'Terugbetaald',
    downPayment: 'Aanbetaling',
    fields: {
      transactionReference: 'Transactie referentie',
      date: 'Datum',
      description: 'Omschrijving'
    },
    methods: {
      cash: 'Contant',
      bankTransfer: 'Bank overschrijving',
      wero: 'Wero | iDEAL',
      pin: 'PIN',
      creditcard: 'Creditcard'
    },
    descriptions: {
      cashPayment: 'Contante betaling',
      bankTransferPayment: 'Bankoverschrijving',
      pinPayment: 'PIN-betaling'
    },
    messages: {
      scanQrOrUseInformationBelow:
        'Scan de QR code als uw bank dit ondersteunt of gebruik de informatie zoals hieronder weergegeven.'
    },
    overview: {
      title: 'Betalingen',
      fromDate: 'Van',
      toDate: 'Tot',
      columns: {
        date: 'Datum',
        method: 'Methode',
        description: 'Omschrijving',
        invoice: 'Factuur',
        client: 'Klant',
        amount: 'Bedrag',
        status: 'Status',
        psp: 'PSP'
      },
      in: 'In',
      refunded: 'Terugbetaald',
      net: 'Netto',
      count: 'Aantal',
      source: 'Bron',
      sources: {
        payments: 'Betalingen',
        refunds: 'Terugbetalingen'
      },
      methods: 'Methoden',
      statuses: 'Statussen',
      psps: 'PSPs',
      deletePayment: 'Betaling verwijderen',
      search: 'Zoeken',
      filters: 'Filters',
      refresh: 'Vernieuwen',
      export: 'CSV exporteren',
      empty: 'Geen betalingen voldoen aan de huidige filters.',
      truncated: 'Eerste 10.000 rijen getoond — verklein je bereik.',
      filterSummary: ({
        from,
        to,
        q,
        methods,
        statuses,
        psps,
        sources
      }: {
        from?: string
        to?: string
        q?: string
        methods: string[]
        statuses: string[]
        psps: string[]
        sources: string[]
      }) => {
        const zinnen: string[] = []
        if (from && to) zinnen.push(`van ${from} tot ${to}`)
        else if (from) zinnen.push(`van ${from}`)
        else if (to) zinnen.push(`tot ${to}`)
        if (q) zinnen.push(`met zoekterm "${q}"`)
        if (statuses.length)
          zinnen.push(`met status ${statuses.map((s) => `'${s}'`).join(', ')}`)
        if (methods.length) zinnen.push(`via ${methods.join(', ')}`)
        if (psps.length) zinnen.push(`met PSP ${psps.join(', ')}`)
        if (sources.length === 1) zinnen.push(`bron: ${sources[0]}`)
        return zinnen.length ? `Betalingen ${zinnen.join(' ')}` : ''
      },
      tabs: {
        payments: 'Betalingen',
        suggestions: 'Suggesties'
      }
    },
    suggestions: {
      empty: 'Geen suggesties voldoen aan de huidige filters.',
      loading: 'Suggesties laden…',
      link: 'Koppelen',
      adoptBadge: 'Overnemen',
      topSuggestion: 'Suggestie',
      score: 'Score',
      dismiss: 'Negeren',
      confirmDismiss: ({ amount }: { amount: string }) =>
        `Weet u zeker dat u de suggestie van ${amount} wilt negeren?`
    }
  },
  refund: {
    refund: 'Terugbetaling',
    refunds: 'Terugbetalingen',
    messages: {
      confirmRefund: (amount) =>
        `Weet u zeker dat u een terugbetaling t.w.v. ${amount} wil doen?`
    }
  },
  exports: {
    title: 'Exporteren'
  },
  dashboard: {
    account: {
      menu: {
        title: 'Snelmenu',
        bills: 'Bekijk mijn rekeningen.',
        receipts: 'Bekijk mijn kwitanties.',
        invoices: 'Bekijk mijn facturen.'
      }
    },
    admin: {
      title: 'Dashboard',
      companyFilter: {
        label: 'Bedrijfsfilter',
        allSelected: 'Alle bedrijven',
        noneSelected: 'Geen bedrijven geselecteerd'
      },
      revenue: {
        title: 'Omzet',
        today: 'Vandaag',
        week: 'Deze week',
        month: 'Deze maand',
        quarter: 'Dit kwartaal',
        year: 'Dit jaar',
        customRange: 'Aangepast bereik',
        startDate: 'Start',
        endDate: 'Einde',
        invoices: 'Facturen',
        receipts: 'Bonnen',
        bills: 'Rekeningen',
        chart: {
          title: 'Omzet over tijd',
          noData: 'Geen omzet in deze periode',
          bin: {
            day: 'Per dag: elk punt is de omzet betaald op die datum.',
            week: 'Per week: elk punt is de omzet betaald in die week.',
            month: 'Per maand: elk punt is de omzet betaald in die maand.',
            quarter:
              'Per kwartaal: elk punt is de omzet betaald in dat kwartaal.'
          }
        }
      },
      debtors: {
        title: 'Openstaand',
        toggle: {
          invoices: 'Facturen',
          bills: 'Rekeningen'
        },
        empty: 'Geen openstaande facturen'
      },
      actionItems: {
        title: 'Actiepunten',
        open: 'Open facturen',
        overdue: {
          needsReminder: 'Herinnering nodig',
          reminder1: 'Eerste herinnering verstuurd',
          reminder2: 'Tweede herinnering verstuurd',
          exhortation: 'Aanmaning'
        }
      },
      upcomingIncome: {
        title: 'Aanstaande inkomsten',
        titleOverdue: 'Vervallen inkomsten',
        invoices: 'openstaande facturen',
        due: 'vervalt op',
        empty: 'Nog geen facturen vervallen',
        emptyOverdue: 'Geen vervallen facturen',
        toggle: {
          upcoming: 'Aanstaand',
          overdue: 'Vervallen'
        }
      },
      paymentMethods: {
        title: 'Betaald per betaalmethode'
      },
      recentActivity: {
        title: 'Recente activiteit',
        forInvoice: 'voor factuur',
        filter: {
          label: 'Activiteit filter',
          all: 'Alle',
          invoiceOpened: 'Factuur geopend',
          billCreated: 'Rekening aangemaakt',
          payment: 'Betaling ontvangen',
          reminder: 'Herinnering verstuurd',
          exhortation: 'Aanmaning verstuurd'
        }
      },
      empty: {
        noData: 'Geen gegevens beschikbaar',
        noCompanySelected: 'Selecteer een bedrijf om statistieken te zien'
      }
    }
  },
  settings: {
    title: 'Instellingen'
  },
  bank: {
    title: 'Bank',
    pages: {
      overview: 'Overzicht',
      review: 'Review',
      settings: 'Instellingen'
    },
    columns: {
      date: 'Datum',
      amount: 'Bedrag',
      counterparty: 'Tegenpartij',
      description: 'Omschrijving',
      account: 'Rekening',
      company: 'Bedrijf',
      linked: 'Status',
      match: 'Match'
    },
    actions: {
      refresh: 'Verversen',
      link: 'Koppelen',
      view: 'Bekijken',
      viewLinked: 'Gekoppelde facturen bekijken',
      linkTransaction: 'Transactie koppelen',
      syncNow: 'Nu synchroniseren',
      linkCompanies: 'Bedrijven koppelen'
    },
    coverage: {
      unlinked: 'Niet gekoppeld',
      partial: 'Gedeeltelijk gekoppeld',
      full: 'Gekoppeld',
      settled: 'Voldaan'
    },
    settlementDetails: 'Verrekeningsdetails',
    linkDialog: {
      title: 'Bankbijschrijving koppelen',
      confirm: 'Koppelen',
      cancel: 'Annuleren',
      pspSettlement: 'PSP-verrekening {id}',
      pspPayments: 'PSP-betalingen',
      splitRemaining:
        '{amount} van {total} — de resterende {remaining} wordt gedekt door andere transactie(s)',
      multiTotal: 'Totaal {amount}',
      selectInvoices: 'Selecteer facturen',
      noCandidates: 'Geen openstaande facturen om te koppelen',
      selectedTotal: '{amount} geselecteerd',
      matchComplete: 'Volledig bedrag gedekt',
      matchDifference: '{amount} resterend',
      matchOver: '{amount} teveel',
      fee: 'Kosten {amount}'
    },
    linked: 'Gekoppeld',
    suggested: 'Voorgesteld',
    unlinked: 'Niet gekoppeld',
    linkedTo: 'Gekoppeld aan {number}',
    adopt: 'Koppel aan betaling op factuur {number} (al betaald via bank)',
    allLinked: 'Alle',
    onlySuggestions: 'Alleen suggesties',
    adoptNote: 'Deze factuur is al betaald via overschrijving.',
    linkedDocuments: 'Gekoppelde documenten',
    unlinkedTransactions: 'Niet-gekoppelde transacties',
    fromDate: 'Vanaf',
    toDate: 'Tot',
    syncing: 'Synchroniseren…',
    syncRequested: 'Sync aangevraagd',
    syncRunning: 'Synchroniseren…',
    empty: 'Nog geen banktransacties.',
    reviewEmpty:
      'Niets te matchen — alle binnenkomende betalingen zijn verwerkt.',
    notConfigured:
      'Open-banking is niet geconfigureerd. Stel OPENBANKING_CREDENTIALS_JSON in om bankimport in te schakelen.',
    connections: 'Verbindingen',
    noConnections: 'Geen bankkoppelingen gevonden.',
    validUntil: 'Geldig tot',
    accounts: 'Rekeningen',
    companyFilter: 'Bedrijven',
    noAccounts: 'Nog geen rekeningen.',
    requiresReauth: 'Opnieuw autoriseren vereist',
    statusActive: 'Actief',
    allCompanies: 'Alle bedrijven',
    syncCompleted: 'Synchronisatie voltooid',
    syncFailed: 'Synchronisatie mislukt',
    actionFailed: 'Actie mislukt',
    suggestionMulti: '{count} facturen',
    partialCoverageLinked: '{linked} van {total} gekoppeld'
  },
  invoiceEvents: {
    events: 'Gebeurtenissen',
    types: {
      emailOpened: 'Factuur geopend vanuit email.',
      paymentDeleted: 'Betaling verwijderd.'
    }
  }
}

export default lang
