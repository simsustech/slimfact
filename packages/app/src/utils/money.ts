/**
 * Shared money formatting for bank/admin pages: amounts are stored as
 * integer cents on the wire and rendered with Intl.NumberFormat so grouping
 * and currency placement follow the viewer's locale.
 */
export const formatMoney = (
  amountCents: number,
  currency = 'EUR',
  locale?: string
): string =>
  new Intl.NumberFormat(locale, { style: 'currency', currency }).format(
    amountCents / 100
  )
