import type { Language } from './index.js'

const lang: Language = {
  isoName: 'de',
  edit: 'Bearbeiten',
  cancel: 'Abbrechen',
  serverError: 'Etwas ist schiefgelaufen...',
  search: 'Suchen...',
  open: 'Öffnen',
  goTo: 'Gehe zu',
  administrator: 'Administrator',
  employee: 'Mitarbeiter',
  tbd: 'Noch offen',
  pricesSubjectToChange: 'Preisänderungen vorbehalten.',
  welcome: 'Willkommen',
  privacyPolicy: 'Datenschutzerklärung',
  404: 'Hoppla, diese Seite ist nicht verfügbar...',
  goHome: 'Zur Startseite',
  updateAvailable: 'Ein Update ist verfügbar.',
  refresh: 'Aktualisieren',
  darkMode: 'Dunkelmodus',
  name: 'Name',
  overview: 'Übersicht',
  noResultsAvailable: 'Keine Ergebnisse verfügbar.',
  rowsPerPage: 'Zeilen pro Seite',
  add: 'Hinzufügen',
  account: {
    title: 'Konto',
    accounts: 'Konten',
    name: 'Konto',
    fields: {
      email: 'E-Mail',
      verified: 'Verifiziert',
      roles: 'Rollen',
      name: 'Name'
    },
    roles: {
      administrator: 'Administrator',
      employee: 'Mitarbeiter',
      pointofsale: 'Kasse',
      manager: 'Manager'
    },
    messages: {
      addRole: 'Rolle hinzufügen',
      removeRole: 'Rolle entfernen',
      changeEmailAddress: 'E-Mail-Adresse ändern'
    }
  },
  configuration: {
    title: 'Konfiguration',
    loading: 'Konfiguration wird geladen',
    errorLoading: 'Beim Laden der Konfiguration ist ein Fehler aufgetreten.'
  },
  company: {
    title: 'Unternehmen',
    company: 'Unternehmen',
    fields: {
      name: 'Name',
      address: 'Adresse',
      postalCode: 'PLZ',
      city: 'Stadt',
      country: 'Land',
      telephoneNumber: 'Telefonnummer',
      email: 'E-Mail',
      cocNumber: 'Handelsregisternummer',
      iban: 'IBAN',
      vatIdNumber: 'USt-IdNr.',
      contactPersonName: 'Name der Kontaktperson',
      website: 'Website',
      emailBcc: 'E-Mail-BCC',
      prefix: 'Präfix',
      bic: 'BIC',
      defaultNumberPrefixTemplate: 'Standard-Nummernpräfix',
      defaultLocale: 'Standard-Locale',
      defaultCurrency: 'Standard-Währung',
      defaultIncludeTax: 'Standard inkl. MwSt.'
    },
    validations: {
      fieldRequired: 'Feld ist ein Pflichtfeld'
    },
    helpers: {
      emailBcc:
        'Alle Rechnungen werden als BCC an diese Adressen gesendet, durch Komma getrennt.',
      prefix:
        'Das Unternehmenspräfix, das z. B. als Präfix für die Rechnungsnummer verwendet wird.'
    }
  },
  client: {
    title: 'Kunden',
    client: 'Kunde',
    fields: {
      number: 'Kundennummer',
      contactPersonName: 'Name der Kontaktperson',
      companyName: 'Firmenname',
      address: 'Adresse',
      postalCode: 'PLZ',
      city: 'Stadt',
      country: 'Land',
      vatIdNumber: 'USt-IdNr.',
      cocNumber: 'Handelsregisternummer',
      email: 'E-Mail'
    },
    validations: {
      fieldRequired: 'Feld ist ein Pflichtfeld'
    },
    messages: {
      linkAccount: 'Konto mit Kunde verknüpfen.',
      addClient: 'Kunden hinzufügen.'
    }
  },
  invoice: {
    title: 'Rechnungen',
    invoice: 'Rechnung',
    lines: 'Positionen',
    discounts: 'Rabatte',
    surcharges: 'Zuschläge',
    fields: {
      locale: 'Locale',
      currency: 'Währung',
      companyPrefix: 'Unternehmenspräfix',
      numberPrefix: 'Nummernpräfix',
      paymentTermDays: 'Zahlungsziel in Tagen',
      notes: 'Notizen',
      projectId: 'Projekt-ID',
      status: 'Status',
      requiredDownPaymentAmount: 'Erforderliche Anzahlung'
    },
    status: {
      concept: 'Entwurf',
      open: 'Offen',
      paid: 'Bezahlt',
      receipt: 'Quittung',
      canceled: 'Storniert',
      bill: 'Beleg',
      overdue: 'Überfällig'
    },
    labels: {
      open: 'Öffnen',
      download: 'Herunterladen',
      update: 'Aktualisieren',
      send: 'Senden',
      sendInvoice: 'Rechnung senden',
      sendReceipt: 'Quittung senden',

      dueBy: (date: string) => `Fällig am ${date}`,
      sendReminder: 'Zahlungserinnerung senden',
      sendExhortation: 'Mahnung senden',
      markPaid: 'Als bezahlt markieren',
      cancel: 'Abbrechen',
      print: 'Drucken',
      downloadPdfToPrint:
        'Bitte nutzen Sie den Download-Button, um das PDF zu erhalten, und drucken Sie es aus Ihrem PDF-Viewer.',
      openReference: 'Referenz öffnen'
    },
    filters: {
      startDate: 'Startdatum',
      endDate: 'Enddatum'
    },
    messages: {
      markPaid: ({ clientDetails, totalIncludingTax }) =>
        `Sind Sie sicher, dass Sie die Rechnung an ${
          clientDetails.companyName || clientDetails.contactPersonName
        } über den Betrag von ${totalIncludingTax} als bezahlt markieren möchten?`,
      addCashPayment: ({ clientDetails, totalIncludingTax }) =>
        `Geben Sie den Betrag ein, der für die Rechnung an ${
          clientDetails.companyName || clientDetails.contactPersonName
        } über den Betrag von ${totalIncludingTax} bar bezahlt wurde:`,
      addBankTransferPayment: ({ clientDetails, totalIncludingTax }) =>
        `Geben Sie den Betrag ein, der für die Rechnung an ${
          clientDetails.companyName || clientDetails.contactPersonName
        } über den Betrag von ${totalIncludingTax} per Überweisung bezahlt wurde:`,
      addPinPayment: ({ clientDetails, totalIncludingTax }) =>
        `Geben Sie den Betrag ein, der für die Rechnung an ${
          clientDetails.companyName || clientDetails.contactPersonName
        } über den Betrag von ${totalIncludingTax} per Karte/PIN bezahlt wurde:`,
      remindersSentOn: (dates) =>
        `Zahlungserinnerungen gesendet am ${dates.join('; ')}.`,
      cancelInvoice: ({ clientDetails, totalIncludingTax }) =>
        `Sind Sie sicher, dass Sie die Rechnung an ${
          clientDetails.companyName || clientDetails.contactPersonName
        } über den Betrag von ${totalIncludingTax} stornieren möchten?`,
      downPaymentReceived: 'Anzahlung wurde empfangen.'
    }
  },
  numberPrefix: {
    title: 'Nummernpräfixe',
    numberPrefix: 'Nummernpräfix',
    fields: {
      name: 'Name',
      template: 'Vorlage'
    }
  },
  initialNumberForPrefix: {
    title: 'Startnummern',
    fields: {
      initialNumber: 'Startnummer'
    },
    messages: {
      numberPrefixHint: 'Nummernpräfix (ohne Vorlage)'
    }
  },
  subscription: {
    title: 'Abonnements',
    fields: {
      active: 'Aktiv',
      startDate: 'Startdatum',
      endDate: 'Enddatum',
      type: 'Typ'
    },
    labels: {
      update: 'Aktualisieren',
      start: 'Starten',
      stop: 'Stoppen'
    },
    types: {
      invoice: 'Rechnung',
      bill: 'Beleg'
    }
  },
  receipt: {
    title: 'Quittungen',
    receipt: 'Quittung'
  },
  bill: {
    title: 'Belege',
    bill: 'Beleg',
    labels: {
      sendReceipt: 'Quittung senden'
    },
    messages: {
      createReceipt: ({ clientDetails, totalIncludingTax }) =>
        `Sind Sie sicher, dass Sie eine Quittung für den Beleg an ${
          clientDetails.companyName || clientDetails.contactPersonName
        } über den Betrag von ${totalIncludingTax} erstellen möchten?`,
      addCashPayment: ({ clientDetails, totalIncludingTax }) =>
        `Geben Sie den Betrag ein, der für den Beleg an ${
          clientDetails.companyName || clientDetails.contactPersonName
        } über den Betrag von ${totalIncludingTax} bar bezahlt wurde:`,
      addPinPayment: ({ clientDetails, totalIncludingTax }) =>
        `Geben Sie den Betrag ein, der für den Beleg an ${
          clientDetails.companyName || clientDetails.contactPersonName
        } über den Betrag von ${totalIncludingTax} per Karte/PIN bezahlt wurde:`
    }
  },
  checkout: {
    success: 'Ihre Zahlung war erfolgreich und wird derzeit verarbeitet.'
  },
  payment: {
    payments: 'Zahlungen',
    pay: 'Bezahlen',
    addPayment: 'Zahlung hinzufügen',

    confirmDeletePayment: ({
      method,
      number,
      amount
    }: {
      method: string
      number: string
      amount: string
    }) =>
      `Sind Sie sicher, dass Sie die ${method} für Rechnung ${number} mit einem Betrag von ${amount} löschen möchten?`,
    amountDue: 'Fälliger Betrag',
    amountPaid: 'Gezahlter Betrag',
    amountRefunded: 'Erstatteter Betrag',
    downPayment: 'Anzahlung',
    fields: {
      transactionReference: 'Transaktionsreferenz',
      date: 'Datum',
      description: 'Beschreibung'
    },
    methods: {
      cash: 'Barzahlung',
      bankTransfer: 'Überweisung',
      wero: 'Wero | iDEAL',
      pin: 'PIN',
      creditcard: 'Kreditkarte'
    },
    descriptions: {
      cashPayment: 'Barzahlung',
      bankTransferPayment: 'Banküberweisung',
      pinPayment: 'Kartenzahlung'
    },
    messages: {
      scanQrOrUseInformationBelow:
        'Scannen Sie den QR-Code, sofern Ihre Bank dies unterstützt, oder nutzen Sie die unten angegebenen Informationen.'
    },
    overview: {
      title: 'Zahlungen',
      fromDate: 'Von',
      toDate: 'Bis',
      columns: {
        date: 'Datum',
        method: 'Methode',
        description: 'Beschreibung',
        invoice: 'Rechnung',
        client: 'Kunde',
        amount: 'Betrag',
        status: 'Status',
        psp: 'PSP'
      },
      in: 'Eingang',
      refunded: 'Erstattet',
      net: 'Netto',
      count: 'Anzahl',
      source: 'Quelle',
      sources: {
        payments: 'Zahlungen',
        refunds: 'Erstattungen'
      },
      methods: 'Methoden',
      statuses: 'Statusse',
      psps: 'PSPs',
      deletePayment: 'Zahlung löschen',
      search: 'Suchen',
      refresh: 'Aktualisieren',
      export: 'CSV exportieren',
      empty: 'Keine Zahlungen entsprechen den aktuellen Filtern.',
      truncated: 'Erste 10.000 Zeilen angezeigt — Bereich eingrenzen.',
      tabs: {
        payments: 'Zahlungen',
        suggestions: 'Vorschläge'
      }
    },
    suggestions: {
      empty: 'Keine Vorschläge entsprechen den aktuellen Filtern.',
      loading: 'Lade Vorschläge…',
      link: 'Verknüpfen',
      adoptBadge: 'Übernehmen',
      topSuggestion: 'Vorschlag',
      score: 'Score',
      dismiss: 'Verwerfen'
    }
  },
  refund: {
    refund: 'Erstattung',
    refunds: 'Erstattungen',
    messages: {
      confirmRefund: (amount) =>
        `Sind Sie sicher, dass Sie den Betrag von ${amount} erstatten möchten?`
    }
  },
  exports: {
    title: 'Exporte'
  },
  dashboard: {
    account: {
      menu: {
        title: 'Schnellmenü',
        bills: 'Meine Belege anzeigen.',
        receipts: 'Meine Quittungen anzeigen.',
        invoices: 'Meine Rechnungen anzeigen.'
      }
    },
    admin: {
      title: 'Dashboard',
      companyFilter: {
        label: 'Unternehmensfilter',
        allSelected: 'Alle Unternehmen',
        noneSelected: 'Keine Unternehmen ausgewählt'
      },
      revenue: {
        title: 'Umsatz',
        today: 'Heute',
        week: 'Diese Woche',
        month: 'Dieser Monat',
        quarter: 'Dieses Quartal',
        year: 'Dieses Jahr',
        customRange: 'Benutzerdefinierter Bereich',
        startDate: 'Start',
        endDate: 'Ende',
        invoices: 'Rechnungen',
        bills: 'Belege',
        receipts: 'Quittungen',
        chart: {
          title: 'Umsatz im Zeitverlauf',
          noData: 'Kein Umsatz in diesem Zeitraum',
          bin: {
            day: 'Nach Tag: jeder Punkt ist der an diesem Tag gezahlte Umsatz.',
            week: 'Nach Woche: jeder Punkt ist der in dieser Woche gezahlte Umsatz.',
            month:
              'Nach Monat: jeder Punkt ist der in diesem Monat gezahlte Umsatz.',
            quarter:
              'Nach Quartal: jeder Punkt ist der in diesem Quartal gezahlte Umsatz.'
          }
        }
      },
      debtors: {
        title: 'Offen',
        toggle: {
          invoices: 'Rechnungen',
          bills: 'Belege'
        },
        empty: 'Keine offenen Rechnungen'
      },
      actionItems: {
        title: 'Aktionspunkte',
        open: 'Offene Rechnungen',
        overdue: {
          needsReminder: 'Erinnerung nötig',
          reminder1: 'Erste Erinnerung gesendet',
          reminder2: 'Zweite Erinnerung gesendet',
          exhortation: 'Mahnung'
        }
      },
      upcomingIncome: {
        title: 'Kommende Einnahmen',
        titleOverdue: 'Überfällige Einnahmen',
        invoices: 'offene Rechnungen',
        due: 'fällig am',
        empty: 'Noch keine Rechnungen fällig',
        emptyOverdue: 'Keine überfälligen Rechnungen',
        toggle: {
          upcoming: 'Kommend',
          overdue: 'Überfällig'
        }
      },
      paymentMethods: {
        title: 'Bezahlt nach Zahlungsart'
      },
      recentActivity: {
        title: 'Letzte Aktivitäten',
        forInvoice: 'für Rechnung',
        filter: {
          label: 'Aktivitätsfilter',
          all: 'Alle',
          invoiceOpened: 'Rechnung geöffnet',
          billCreated: 'Beleg erstellt',
          payment: 'Zahlung erhalten',
          reminder: 'Erinnerung gesendet',
          exhortation: 'Mahnung gesendet'
        }
      },
      empty: {
        noData: 'Keine Daten verfügbar',
        noCompanySelected:
          'Wählen Sie ein Unternehmen aus, um Statistiken zu sehen'
      }
    }
  },
  settings: { title: 'Einstellungen' },
  bank: {
    title: 'Bank',
    pages: {
      overview: 'Übersicht',
      review: 'Review',
      settings: 'Einstellungen'
    },
    columns: {
      date: 'Datum',
      amount: 'Betrag',
      counterparty: 'Gegenpartei',
      description: 'Beschreibung',
      account: 'Konto',
      company: 'Firma',
      linked: 'Status',
      match: 'Treffer'
    },
    actions: {
      refresh: 'Aktualisieren',
      link: 'Verknüpfen',
      view: 'Anzeigen',
      viewLinked: 'Verknüpfte Rechnungen anzeigen',
      linkTransaction: 'Transaktion verknüpfen',
      syncNow: 'Jetzt synchronisieren',
      linkCompanies: 'Unternehmen verknüpfen'
    },
    coverage: {
      unlinked: 'Nicht verknüpft',
      partial: 'Teilweise verknüpft',
      full: 'Verknüpft',
      settled: 'Abgeglichen'
    },
    settlementDetails: 'Abrechnungsdetails',
    linkDialog: {
      title: 'Bankgutschrift verknüpfen',
      confirm: 'Verknüpfen',
      cancel: 'Abbrechen',
      pspSettlement: 'PSP-Abrechnung {id}',
      pspPayments: 'PSP-Zahlungen',
      splitRemaining:
        '{amount} von {total} — der Rest von {remaining} wird durch andere Transaktion(en) gedeckt',
      multiTotal: 'Gesamt {amount}',
      selectInvoices: 'Rechnungen auswählen',
      noCandidates: 'Keine offenen Rechnungen zum Verknüpfen',
      selectedTotal: '{amount} ausgewählt',
      matchComplete: 'Voller Betrag abgedeckt',
      matchDifference: '{amount} verbleibend',
      matchOver: '{amount} zu viel',
      fee: 'Gebühr {amount}'
    },
    linked: 'Verknüpft',
    suggested: 'Vorgeschlagen',
    unlinked: 'Nicht verknüpft',
    linkedTo: 'Verknüpft mit {number}',
    adopt:
      'Mit Zahlung auf Rechnung {number} verknüpfen (bereits per Bank bezahlt)',
    allLinked: 'Alle',
    onlySuggestions: 'Nur Vorschläge',
    adoptNote: 'Diese Rechnung wurde bereits per Überweisung bezahlt.',
    linkedDocuments: 'Verknüpfte Dokumente',
    unlinkedTransactions: 'Nicht verknüpfte Transaktionen',
    fromDate: 'Von',
    toDate: 'Bis',
    syncing: 'Synchronisiere…',
    syncRequested: 'Sync angefordert',
    syncRunning: 'Synchronisiere…',
    empty: 'Noch keine Banktransaktionen.',
    reviewEmpty:
      'Nichts abzugleichen – alle eingehenden Zahlungen sind abgeschlossen.',
    notConfigured:
      'Open-Banking ist nicht konfiguriert. Setzen Sie OPENBANKING_CREDENTIALS_JSON, um den Bankimport zu aktivieren.',
    connections: 'Verbindungen',
    noConnections: 'Keine Bankverbindungen gefunden.',
    validUntil: 'Gültig bis',
    accounts: 'Konten',
    companyFilter: 'Unternehmen',
    noAccounts: 'Noch keine Konten.',
    requiresReauth: 'Erneute Autorisierung erforderlich',
    statusActive: 'Aktiv',
    allCompanies: 'Alle Unternehmen',
    syncCompleted: 'Synchronisierung abgeschlossen',
    syncFailed: 'Synchronisierung fehlgeschlagen',
    actionFailed: 'Aktion fehlgeschlagen',
    suggestionMulti: '{count} Rechnungen',
    partialCoverageLinked: '{linked} von {total} verknüpft'
  },
  invoiceEvents: {
    events: 'Ereignisse',
    types: {
      emailOpened: 'Rechnung über E-Mail geöffnet.',
      paymentDeleted: 'Zahlung gelöscht.'
    }
  }
}

export default lang
