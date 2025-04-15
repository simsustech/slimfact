import { type Invoice } from '@modular-api/fastify-checkout'
import { mkConfig, generateCsv } from 'export-to-csv'

interface DigiBooxInvoice {
  Factuurnummer: string
  Referentie: string | null
  Factuurdatum: string
  Relatie: string
  Vervaldatum: string
  Omschrijving: string
  'Btw-percentage': number
  Aantal: number
  'Bedrag excl. btw': string
}

const formatDateShort = ({
  dateString,
  locale
}: {
  dateString: string
  locale: string
}) => {
  const shortDateFormatter = new Intl.DateTimeFormat(locale, {
    dateStyle: 'short'
  })
  const date = new Date(dateString)
  return shortDateFormatter.format(date)
}

const formatPrice = ({ value, locale }: { value: number; locale: string }) =>
  Intl.NumberFormat(locale, {
    maximumFractionDigits: 2,
    style: 'currency',
    currency: 'EUR',
    currencyDisplay: 'code'
  })
    .format(value / 100)
    .replace('EUR', '')

export const exportDigibooxInvoices = (invoices: Invoice[]) => {
  const csvConfig = mkConfig({ useKeysAsHeaders: true })

  const data: DigiBooxInvoice[] = []
  invoices
    .filter((invoice) => invoice.date && invoice.clientDetails.companyName)
    .forEach((invoice) => {
      invoice.lines.forEach((invoiceLine) => {
        data.push({
          Factuurnummer: `${invoice.numberPrefix || ''}${invoice.number}`,
          Referentie: invoice.projectId ? invoice.projectId : '',
          Factuurdatum: formatDateShort({
            dateString: invoice.date!,
            locale: 'nl'
          }),
          Relatie: invoice.clientDetails.companyName!,
          Vervaldatum: formatDateShort({
            dateString: invoice.dueDate!,
            locale: 'nl'
          }),
          Omschrijving: invoiceLine.description,
          'Btw-percentage': invoiceLine.taxRate,
          Aantal: invoiceLine.quantity,
          'Bedrag excl. btw': formatPrice({
            value: invoiceLine.discountedLinePriceExcludingTax,
            locale: 'en-US'
          })
        })
      })
    })

  // @ts-expect-error wrong types
  return generateCsv(csvConfig)(data)
}
