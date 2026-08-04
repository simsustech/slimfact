// Shared helpers for @slimfact/tools.
// Amounts are stored in cents throughout SlimFact (e.g. 40009 = €400.09),
// so price formatting always converts from cents to whole units.

/**
 * Format an amount stored in cents as a localized price string.
 *
 * By default the currency code is omitted, matching the DigiBoox export
 * format ("1.234,56"); pass `includeSymbol: true` to keep the currency
 * symbol ("€ 1.234,56"). The `currency` (ISO code) defaults to EUR.
 */
export const formatPrice = ({
  value,
  locale,
  currency = 'EUR',
  includeSymbol = false
}: {
  value: number
  locale: string
  currency?: string
  includeSymbol?: boolean
}): string =>
  Intl.NumberFormat(locale, {
    maximumFractionDigits: 2,
    style: 'currency',
    currency,
    currencyDisplay: includeSymbol ? 'symbol' : 'code'
  })
    .format(value / 100)
    .replaceAll(currency, '')
    .trim()
