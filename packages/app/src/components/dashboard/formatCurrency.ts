// Currency formatting for the revenue chart.
// Amounts are stored in cents (e.g. 40009 = €400.09), so display values are
// converted to whole units before formatting. Kept in a plain module so unit
// tests can verify the cents -> euros conversion.

export const formatCurrency = (
  value: number | string,
  currency: string = '€'
): string => {
  const num = typeof value === 'number' ? value : Number(value)
  if (value === '' || value === null || !Number.isFinite(num)) return ''
  // Amounts are stored in cents; convert to whole units for display.
  const units = num / 100
  const fixed = Math.round(units * 100) / 100
  const [intPart, decPart] = fixed.toFixed(2).split('.')
  const withThousands = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return decPart
    ? `${currency} ${withThousands}.${decPart}`
    : `${currency} ${withThousands}`
}
