import type {
  Invoice,
  InvoiceDiscount,
  InvoiceLine,
  InvoiceSurcharge
} from '@modular-api/fastify-checkout'

export const createUblInvoice = ({ invoice }: { invoice: Invoice }) => {
  const cacPartyName = invoice.companyDetails?.name
    ? `<cac:PartyName>
        <cbc:Name>
              ${invoice.companyDetails.name}
        </cbc:Name>
      </cac:PartyName>`
    : ''

  const cacProjectReference = invoice.projectId
    ? `    <cac:ProjectReference>
    <cbc:ID>${invoice.projectId ?? ''}</cbc:ID>
    </cac:ProjectReference>`
    : ''

  const cbcNote = invoice.notes ? `<cbc:Note>${invoice.notes}</cbc:Note>` : ''

  const clientCbcCompanyId = invoice.clientDetails.cocNumber
    ? `<cbc:CompanyID schemeID="0183">${invoice.clientDetails.cocNumber}</cbc:CompanyID>`
    : ''

  const companyCbcContactName = invoice.companyDetails.contactPersonName
    ? `<cbc:Name>${invoice.companyDetails.contactPersonName ?? ''}</cbc:Name>`
    : ''

  const clientCbcContactName = invoice.clientDetails.contactPersonName
    ? `<cbc:Name>${invoice.clientDetails.contactPersonName ?? ''}</cbc:Name>`
    : ''

  const clientCacPartyTaxScheme = invoice.clientDetails.vatIdNumber
    ? `<cac:PartyTaxScheme>
                <cbc:CompanyID>${invoice.clientDetails.vatIdNumber}</cbc:CompanyID>
                <cac:TaxScheme>
                    <cbc:ID>VAT</cbc:ID>
                </cac:TaxScheme>
            </cac:PartyTaxScheme>`
    : ''

  return `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
    xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2"
    xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2">
    <cbc:ID>${invoice.numberPrefix}${invoice.number}</cbc:ID>
    <cbc:IssueDate>${invoice.date}</cbc:IssueDate>
    <cbc:DueDate>${invoice.dueDate}</cbc:DueDate>
    <cbc:InvoiceTypeCode>380</cbc:InvoiceTypeCode>
    <cbc:DocumentCurrencyCode>${invoice.currency}</cbc:DocumentCurrencyCode>
    ${cacProjectReference}

    <cbc:BuyerReference>
      ${invoice.numberPrefix}${invoice.number}
    </cbc:BuyerReference>
    <cac:AccountingSupplierParty>
        <cac:Party>
          ${cacPartyName}
            <cac:PostalAddress>
                <cbc:StreetName>${invoice.companyDetails.address}</cbc:StreetName>
                <cbc:CityName>${invoice.companyDetails.city}</cbc:CityName>
                <cbc:PostalZone>${invoice.companyDetails.postalCode}</cbc:PostalZone>
                <cac:Country>
                    <cbc:IdentificationCode>${invoice.companyDetails.country}</cbc:IdentificationCode>
                </cac:Country>
            </cac:PostalAddress>
            <cac:PartyTaxScheme>
                <cbc:CompanyID>${invoice.companyDetails.vatIdNumber}</cbc:CompanyID>
                <cac:TaxScheme>
                    <cbc:ID>VAT</cbc:ID>
                </cac:TaxScheme>
            </cac:PartyTaxScheme>
            <cac:PartyLegalEntity>
                <cbc:RegistrationName>${invoice.companyDetails.name}</cbc:RegistrationName>
                <cbc:CompanyID>${invoice.companyDetails.cocNumber}</cbc:CompanyID>
            </cac:PartyLegalEntity>
            <cac:Contact>
              ${companyCbcContactName}
              <cbc:ElectronicMail>${invoice.companyDetails.email}</cbc:ElectronicMail>
            </cac:Contact>
        </cac:Party>
    </cac:AccountingSupplierParty>
    <cac:AccountingCustomerParty>
        <cac:Party>
          <cac:PostalAddress>
                <cbc:StreetName>${invoice.clientDetails.address}</cbc:StreetName>
                <cbc:CityName>${invoice.clientDetails.city}</cbc:CityName>
                <cbc:PostalZone>${invoice.clientDetails.postalCode}</cbc:PostalZone>
                <cac:Country>
                    <cbc:IdentificationCode>${invoice.clientDetails.country}</cbc:IdentificationCode>
                </cac:Country>
            </cac:PostalAddress>
            ${clientCacPartyTaxScheme}
            <cac:PartyLegalEntity>
                <cbc:RegistrationName>${invoice.clientDetails.companyName}</cbc:RegistrationName>
                ${clientCbcCompanyId}
                </cac:PartyLegalEntity>
            <cac:Contact>
              ${clientCbcContactName}
              <cbc:ElectronicMail>${invoice.clientDetails.email}</cbc:ElectronicMail>
            </cac:Contact>
        </cac:Party>
    </cac:AccountingCustomerParty>
  
    <cac:PaymentMeans>
        <cbc:PaymentMeansCode name="Credit transfer">30</cbc:PaymentMeansCode>
        <cbc:PaymentID>${invoice.numberPrefix}${invoice.number}</cbc:PaymentID>
        <cac:PayeeFinancialAccount>
            <cbc:ID>${invoice.companyDetails.iban}</cbc:ID>
            <cbc:Name>${invoice.companyDetails.name}</cbc:Name>
            <cac:FinancialInstitutionBranch>
                <cbc:ID>${invoice.companyDetails.bic}</cbc:ID>
            </cac:FinancialInstitutionBranch>
        </cac:PayeeFinancialAccount>
    </cac:PaymentMeans>
    <cac:PaymentTerms>
        <cbc:Note>Payment before ${invoice.dueDate}.</cbc:Note>
    </cac:PaymentTerms>

    <cac:TaxTotal>
      <cbc:TaxAmount currencyID="${invoice.currency}">${formatAmount(invoice.taxSummary.reduce((acc, cur) => (acc += cur.tax), 0))}</cbc:TaxAmount>
      ${formatTaxSubTotals({ taxSummary: invoice.taxSummary, currency: invoice.currency, lines: invoice.lines, discounts: invoice.discounts || [], surcharges: invoice.surcharges || [] })}
    </cac:TaxTotal>

    <cac:LegalMonetaryTotal>
        <cbc:LineExtensionAmount currencyID="${invoice.currency}">${formatAmount(invoice.lines?.reduce((acc, cur) => (acc += cur.discountedLinePriceExcludingTax), 0))}</cbc:LineExtensionAmount>
        <cbc:TaxExclusiveAmount currencyID="${invoice.currency}">${formatAmount(invoice.totalExcludingTax)}</cbc:TaxExclusiveAmount>
        <cbc:TaxInclusiveAmount currencyID="${invoice.currency}">${formatAmount(invoice.totalIncludingTax)}</cbc:TaxInclusiveAmount>
        <cbc:AllowanceTotalAmount currencyID="${invoice.currency}">${formatAmount(invoice.discounts?.reduce((acc, cur) => (acc += cur.listPriceExcludingTax), 0))}</cbc:AllowanceTotalAmount>
        <cbc:ChargeTotalAmount currencyID="${invoice.currency}">${formatAmount(invoice.surcharges?.reduce((acc, cur) => (acc += cur.listPriceExcludingTax), 0))}</cbc:ChargeTotalAmount>
        <cbc:PrepaidAmount currencyID="${invoice.currency}">${formatAmount(invoice.amountPaid)}</cbc:PrepaidAmount>
        <cbc:PayableAmount currencyID="${invoice.currency}">${formatAmount(invoice.amountDue)}</cbc:PayableAmount>
    </cac:LegalMonetaryTotal>

    ${formatSurcharges({ surcharges: invoice.surcharges, currency: invoice.currency })}
    ${formatDiscounts({ discounts: invoice.discounts, currency: invoice.currency })}
    ${formatInvoiceLines({ lines: invoice.lines, currency: invoice.currency })}
    ${cbcNote}
</Invoice>`
}

const formatSurcharges = ({
  surcharges,
  currency
}: {
  surcharges: InvoiceSurcharge[] | null
  currency: Invoice['currency']
}) =>
  surcharges?.map(
    (surcharge) =>
      `
    <cac:AllowanceCharge>
            <cbc:ChargeIndicator>true</cbc:ChargeIndicator>
            <cbc:AllowanceChargeReason>${surcharge.description}</cbc:AllowanceChargeReason>
            <cbc:Amount currencyID="${currency}">${formatAmount(surcharge.listPriceExcludingTax)}</cbc:Amount>
            <cac:TaxCategory>
                <cbc:ID>${surcharge.taxRate ? 'S' : 'E'}</cbc:ID>
                <cbc:Percent>${surcharge.taxRate}</cbc:Percent>
                <cac:TaxScheme>
                    <cbc:ID>VAT</cbc:ID>
                </cac:TaxScheme>
            </cac:TaxCategory>
        </cac:AllowanceCharge>
  ` || ''
  )

const formatDiscounts = ({
  discounts,
  currency
}: {
  discounts: InvoiceDiscount[] | null
  currency: Invoice['currency']
}) =>
  discounts?.map(
    (discount) =>
      `
      <cac:AllowanceCharge>
              <cbc:ChargeIndicator>false</cbc:ChargeIndicator>
              <cbc:AllowanceChargeReason>${discount.description}</cbc:AllowanceChargeReason>
              <cbc:Amount currencyID="${currency}">${formatAmount(discount.listPriceExcludingTax)}</cbc:Amount>
              <cac:TaxCategory>
                <cbc:ID>${discount.taxRate ? 'S' : 'E'}</cbc:ID>
                  <cbc:Percent>${discount.taxRate}</cbc:Percent>
                  <cac:TaxScheme>
                      <cbc:ID>VAT</cbc:ID>
                  </cac:TaxScheme>
              </cac:TaxCategory>
          </cac:AllowanceCharge>
    ` || ''
  )

const formatInvoiceLines = ({
  lines,
  currency
}: {
  lines: InvoiceLine[]
  currency: Invoice['currency']
}) =>
  lines?.map(
    (line, index) => `
<cac:InvoiceLine>
    <cbc:ID>${index}</cbc:ID>
    <cbc:InvoicedQuantity unitCode="${getUnitCode(line.quantityUnit)}">${line.quantityPerMille ? line.quantity / 1000 : line.quantity}</cbc:InvoicedQuantity>
    <cbc:LineExtensionAmount currencyID="${currency}">${formatAmount(line.discountedLinePriceExcludingTax)}</cbc:LineExtensionAmount>
    <cac:Item>
        <cbc:Name>${line.description}</cbc:Name>
        <cac:ClassifiedTaxCategory>
            <cbc:ID>${line.taxRate ? 'S' : 'E'}</cbc:ID>
            <cbc:Percent>${line.taxRate}</cbc:Percent>
            <cac:TaxScheme>
                <cbc:ID>VAT</cbc:ID>
            </cac:TaxScheme>
        </cac:ClassifiedTaxCategory>
    </cac:Item>
    <cac:Price>
        <cbc:PriceAmount currencyID="${currency}">${formatAmount(line.discountedLinePriceExcludingTax)}</cbc:PriceAmount>
         <cac:AllowanceCharge>
            <cbc:ChargeIndicator>false</cbc:ChargeIndicator>
            <cbc:Amount currencyID="${currency}">${formatAmount(line.discountExcludingTax)}</cbc:Amount>
            <cbc:BaseAmount currencyID="${currency}">${formatAmount(line.listPriceExcludingTax)}</cbc:BaseAmount>
        </cac:AllowanceCharge>
    </cac:Price>
</cac:InvoiceLine>
`
  ) || ''

const formatTaxSubTotals = ({
  taxSummary,
  currency,
  lines,
  discounts,
  surcharges
}: {
  taxSummary: Invoice['taxSummary']
  currency: Invoice['currency']
  lines: InvoiceLine[]
  surcharges: InvoiceSurcharge[]
  discounts: InvoiceDiscount[]
}) =>
  taxSummary?.map(
    (tax) => `
        <cac:TaxSubtotal>
            <cbc:TaxableAmount currencyID="${currency}">${formatAmount(
              calculateTaxableAmount({
                taxRate: tax.taxRate,
                lines,
                discounts,
                surcharges
              })
            )}</cbc:TaxableAmount>
            <cbc:TaxAmount currencyID="${currency}">${formatAmount(tax.tax)}</cbc:TaxAmount>
            <cac:TaxCategory>
                <cbc:ID>${tax.taxRate ? 'S' : 'E'}</cbc:ID>
                <cbc:Percent>${tax.taxRate.toFixed(1)}</cbc:Percent>
                <cac:TaxScheme>
                    <cbc:ID>VAT</cbc:ID>
                </cac:TaxScheme>
            </cac:TaxCategory>
        </cac:TaxSubtotal>`
  )

const formatAmount = (amount: number | null | undefined) => {
  if (amount) return (amount / 100).toFixed(2)
  return '0'
}

const calculateTaxableAmount = ({
  taxRate,
  lines,
  surcharges,
  discounts
}: {
  taxRate: number
  lines: InvoiceLine[]
  surcharges: InvoiceSurcharge[]
  discounts: InvoiceDiscount[]
}) => {
  const linesTotal = lines
    .filter((line) => line.taxRate === taxRate)
    .reduce((acc, cur) => (acc += cur.listPriceExcludingTax), 0)

  const discountsTotal = discounts
    .filter((line) => line.taxRate === taxRate)
    .reduce((acc, cur) => (acc += cur.listPriceExcludingTax), 0)

  const surchargesTotal = surcharges
    .filter((line) => line.taxRate === taxRate)
    .reduce((acc, cur) => (acc += cur.listPriceExcludingTax), 0)

  return linesTotal - discountsTotal + surchargesTotal
}

const getUnitCode = (quantityUnit: Invoice['lines'][0]['quantityUnit']) => {
  if (quantityUnit === 'h') return 'HUR'
  if (quantityUnit === 'm') return 'MTR'
  if (quantityUnit === 'kg') return 'KGM'
  return 'H87'
}
