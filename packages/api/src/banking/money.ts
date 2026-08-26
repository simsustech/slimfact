const AMOUNT_PATTERN = /^(-)?(\d+)(?:\.(\d{1,2}))?$/

/**
 * Parses a decimal amount string (e.g. "-9.73") into integer cents using
 * string math only — never floats. Rejects malformed input.
 */
export const parseAmountToCents = (amount: string): number => {
  const match = AMOUNT_PATTERN.exec(amount)
  if (!match) {
    throw new Error(`Invalid amount: "${amount}"`)
  }
  const [, sign, whole, fraction] = match
  const fractionCents = Number((fraction ?? '').padEnd(2, '0') || 0)
  const cents = Number(whole) * 100 + fractionCents
  return sign === '-' ? -cents : cents
}

/**
 * Formats integer cents as a decimal amount string with the minimal fraction
 * (e.g. -973 -> "-9.73", 12340 -> "123.4"). Inverse of parseAmountToCents.
 */
export const centsToAmountString = (cents: number): string => {
  const sign = cents < 0 ? '-' : ''
  const absolute = Math.abs(cents)
  const whole = Math.floor(absolute / 100)
  const fraction = String(absolute % 100)
    .padStart(2, '0')
    .replace(/0+$/, '')
  return fraction ? `${sign}${whole}.${fraction}` : `${sign}${whole}`
}
