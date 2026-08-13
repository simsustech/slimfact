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

/**
 * Format an ISO date (YYYY-MM-DD) using a token format such as
 * "DD-MM-YYYY" or "MM/DD/YYYY". Unknown tokens are left as-is; invalid
 * input is returned unchanged.
 */
export const formatDate = (isoDate: string, format: string): string => {
  const [year, month, day] = isoDate.split('-')
  if (!year || !month || !day) return isoDate
  return format
    .replaceAll('YYYY', year)
    .replaceAll('YY', year.slice(2))
    .replaceAll('MM', month)
    .replaceAll('DD', day)
}
/**
 * Strict YYYY-MM-DD check. DateInput emits `_`-padded partials while typing
 * (e.g. "2026-0_-__"); they must never reach the handler as date params, so
 * invalid values are stripped to undefined.
 */
export const validIsoDate = (v: string | null | undefined) =>
  v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined

/**
 * Read a single date query param from a vue-router LocationQuery-like object.
 * Non-string values (arrays, undefined) fall back to null.
 */
export const dateQueryParam = (
  query: Record<string, unknown>,
  key: string
): string | null => {
  const value = query[key]
  return typeof value === 'string' ? (validIsoDate(value) ?? null) : null
}
