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
  name: 'Name',
  overview: 'Übersicht',
  noResultsAvailable: 'Keine Ergebnisse verfügbar.',
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
      emailBcc: 'Alle Rechnungen werden als BCC an diese Adresse gesendet.',
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
      bill: 'Beleg'
    },
    labels: {
      open: 'Öffnen',
      download: 'Herunterladen',
      update: 'Aktualisieren',
      send: 'Senden',
      sendInvoice: 'Rechnung senden',
      sendReceipt: 'Quittung senden',
      sendReminder: 'Zahlungserinnerung senden',
      sendExhortation: 'Mahnung senden',
      markPaid: 'Als bezahlt markieren',
      cancel: 'Abbrechen',
      print: 'Drucken',
      openReference: 'Referenz öffnen'
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
    amountDue: 'Fälliger Betrag',
    amountPaid: 'Gezahlter Betrag',
    amountRefunded: 'Erstatteter Betrag',
    downPayment: 'Anzahlung',
    fields: {
      transactionReference: 'Transaktionsreferenz',
      description: 'Beschreibung'
    },
    methods: {
      cash: 'Barzahlung',
      bankTransfer: 'Überweisung',
      ideal: 'iDEAL',
      pin: 'PIN'
    },
    messages: {
      scanQrOrUseInformationBelow:
        'Scannen Sie den QR-Code, sofern Ihre Bank dies unterstützt, oder nutzen Sie die unten angegebenen Informationen.'
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
    }
  },
  settings: { title: 'Einstellungen' },
  invoiceEvents: {
    events: 'Ereignisse',
    types: {
      emailOpened: 'Rechnung über E-Mail geöffnet.'
    }
  }
}

export default lang
