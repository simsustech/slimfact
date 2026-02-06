#let invoice
#if "invoice" in sys.inputs {
  invoice = json(bytes(sys.inputs.at("invoice")))
} else {
  invoice = (
    "id": 1,
    "uuid": "7a9c315e-bf61-4047-a86f-16a61c0c00f5",
    "locale": "en-US",
    "currency": "EUR",
    "companyPrefix": "deliverables",
    "numberPrefix": "2026.",
    "numberPrefixTemplate": "((YYYY)).",
    "number": 1,
    "date": "2026-01-26",
    "paymentTermDays": 14,
    "dueDate": "2026-02-09",
    "lines": (
      (
        "taxRate": 21,
        "discount": 100,
        "quantity": 1000,
        "listPrice": 600,
        "description": "Wood",
        "quantityUnit": "m",
        "parsedQuantity": 1,
        "quantityPerMille": true,
        "discountExcludingTax": 83,
        "discountIncludingTax": 100,
        "listPriceIncludesTax": true,
        "linePriceExcludingTax": 496,
        "linePriceIncludingTax": 600,
        "listPriceExcludingTax": 496,
        "listPriceIncludingTax": 600,
        "discountedLinePriceExcludingTax": 413,
        "discountedLinePriceIncludingTax": 500,
      ),
    ),
    "discounts": (
      (
        "taxRate": 21,
        "listPrice": 500,
        "description": "Cheap",
        "listPriceIncludesTax": true,
        "listPriceExcludingTax": 413,
        "listPriceIncludingTax": 500,
      ),
    ),
    "surcharges": (
      (
        "taxRate": 21,
        "listPrice": 2000,
        "description": "Shipping",
        "listPriceIncludesTax": true,
        "listPriceExcludingTax": 1653,
        "listPriceIncludingTax": 2000,
      ),
    ),
    "companyDetails": (
      "id": 5,
      "bic": "FILNBGF8XXX",
      "city": "Kenosha",
      "iban": "CH42971990648668981F9",
      "name": "Wintheiser, Spencer and Corwin",
      "email": "Fredrick_Muller81@yahoo.com",
      "prefix": "deliverables",
      "address": "4209 Trinity Road",
      "country": "Kazakhstan",
      "logoSvg": none,
      "website": none,
      "emailBcc": "Cora.Kshlerin@gmail.com",
      "cocNumber": "978-1-4616-4574-0",
      "createdAt": "2026-01-23 12:27:23.14566+00",
      "postalCode": "84161-4878",
      "vatIdNumber": "68284107",
      "defaultLocale": none,
      "defaultCurrency": none,
      "telephoneNumber": "1-380-762-9832 x1675",
      "contactPersonName": none,
      "defaultNumberPrefixTemplate": none,
    ),
    "clientDetails": (
      "id": 500,
      "city": "McAllen",
      "email": "Melyssa86@yahoo.com",
      "number": none,
      "address": "281 Justyn Curve",
      "country": "Estonia",
      "postalCode": "88151-3557",
      "companyName": "Walker LLC",
      "vatIdNumber": none,
      "contactPersonName": "Carmen Boehm",
    ),
    "taxSummary": (("tax": 347, "taxRate": 21),),
    "totalIncludingTax": 2000,
    "totalExcludingTax": 1653,
    "requiredDownPaymentAmount": 0,
    "projectId": none,
    "notes": "Test",
    "status": "open",
    "companyId": 5,
    "clientId": 500,
    "reminderSentDates": [],
    "template": "default",
    "amountPaid": 0,
    "amountDue": 2000,
    "amountRefunded": 0,
  )
}

#let includeTax = json(bytes(sys.inputs.at("includeTax", default: "true")))

#import "./lang.typ": translations
#let lang = translations.at(invoice.locale)

#import "./internal.typ": formatPrice, formatQuantity, formatPrice, quantityUnits, currencySymbols, formatDate, ternary

#set page(
  paper: sys.inputs.at("pageSize", default: "a4"),
)

#let getTitle = status => {
  let text
  if (status == "bill") {
    text = lang.invoice.status.bill
  } else if (status == "receipt") {
    text = lang.invoice.status.receipt
  } else if (status == "concept") {
    text = lang.invoice.status.concept
  } else {
    text = lang.invoice.title
  }
  text
}

#let title = getTitle((invoice.status))
#let footer = ternary(
  invoice.dueDate != none,
  (lang.invoice.footer)(
    invoice.paymentTermDays,
    invoice.companyDetails.name,
    formatDate(invoice.dueDate, invoice.locale),
    invoice.companyDetails.iban,
  ),
  "",
)

#grid(
  columns: (50%, 50%),
  [
    #if (invoice.companyDetails.logoSvg != none) [
      #image(bytes(invoice.companyDetails.logoSvg), format: "svg", width: 80%)
    ]
    #align(bottom)[#invoice.clientDetails.companyName \
      #invoice.clientDetails.contactPersonName \
      #invoice.clientDetails.address \
      #invoice.clientDetails.postalCode #invoice.clientDetails.city \
      #invoice.clientDetails.country]
  ],
  [
    #align(right)[
      #invoice.companyDetails.name \
      #invoice.companyDetails.address \
      #invoice.companyDetails.postalCode #invoice.companyDetails.city \
      #invoice.companyDetails.country
      #v(1em)
      #invoice.companyDetails.telephoneNumber \
      #invoice.companyDetails.email \
      #v(1em)
      #lang.invoice.fields.cocNumber: #invoice.companyDetails.cocNumber \
      #lang.invoice.fields.vatIdNumber: #invoice.companyDetails.vatIdNumber \
      #lang.invoice.fields.iban: #invoice.companyDetails.iban \
      #lang.invoice.fields.bic: #invoice.companyDetails.bic
    ]
  ],
)

#v(2em)
#grid(
  columns: (60%, 40%),
  align: (left, right),
  text(size: 2em)[#title],
  if invoice.number != none {
    grid(
      columns: (50%, 50%),
      row-gutter: 0.5em,
      align: (left, right),
      [#lang.invoice.fields.invoiceNumber:], [*#invoice.numberPrefix#invoice.number*],
      [#lang.invoice.fields.invoiceDate:], [#formatDate(invoice.date, invoice.locale)],
    )
  },
)

#let totalLabel
#show table.cell.where(y: 0): strong

// Remove inset to align table with other content
#set table(
  stroke: (x, y) => if y == 0 {
    (bottom: 0.7pt + black)
  },
  align: (x, y) => (
    if x > 4 { right } else { left }
  ),
  inset: (x, y) => (
    if x == 0 { (left: 0pt, rest: 0.5em) } else if x == 5 { (right: 0pt, rest: 0.5em) } else { (rest: 0.5em) }
  ),
)
#table(
  columns: (auto, 1fr, auto, auto, auto, auto),
  table.header(
    lang.invoice.fields.quantity,
    lang.invoice.fields.description,
    lang.invoice.fields.listPrice,
    lang.invoice.fields.discount,
    lang.invoice.fields.vat,
    ternary(includeTax, lang.invoice.labels.amountIncludingTax, lang.invoice.labels.amountExcludingTax),
  ),
  ..for v in invoice.lines {
    (
      [#formatQuantity(v.quantity, v.quantityPerMille, v.at("quantityUnit", default: none))],
      [#v.description],
      [#formatPrice(ternary(includeTax, v.listPriceIncludingTax, v.listPriceExcludingTax), invoice.currency)],
      [#formatPrice(ternary(includeTax, v.discountIncludingTax, v.discountExcludingTax), invoice.currency)],
      [#v.taxRate%],
      [#formatPrice(
        ternary(includeTax, v.discountedLinePriceIncludingTax, v.discountedLinePriceExcludingTax),
        invoice.currency,
      )],
    )
  },
)

#align(bottom)[
  #grid(
    columns: (50%, 50%),
    align: (left, right),
    inset: (left: 0pt, right: 0pt),
    [],
    [
      #grid(
        columns: (1fr, auto),
        align: (left, right),
        row-gutter: 0.75em,
        for v in invoice.surcharges { [#v.description:] },
        for v in invoice.surcharges {
          [#formatPrice(ternary(includeTax, v.listPriceIncludingTax, v.listPriceExcludingTax), invoice.currency)]
        },

        for v in invoice.discounts { [#v.description:] },
        for v in invoice.discounts {
          [#sym.minus #formatPrice(
              ternary(includeTax, v.listPriceIncludingTax, v.listPriceExcludingTax),
              invoice.currency,
            )]
        },

        [#lang.invoice.fields.totalExcludingTax:],
        [
          #formatPrice(invoice.totalExcludingTax, invoice.currency) \
        ],

        for v in invoice.taxSummary { [#lang.invoice.fields.vat #v.taxRate#sym.percent:] },
        for v in invoice.taxSummary { [#formatPrice(v.tax, invoice.currency)] },
        grid.cell(colspan: 2)[
          #line(length: 100%)
        ],
        [
          *#lang.invoice.fields.totalIncludingTax*:
        ],
        [
          *#formatPrice(invoice.totalIncludingTax, invoice.currency)*
        ],
      )
    ],
  )

  #invoice.notes
  \
  \
  #footer
]
