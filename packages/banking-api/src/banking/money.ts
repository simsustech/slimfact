const AMOUNT_PATTERN = /^(-)?(\d+)(?:\.(\d{1,2}))?$/;

/**
 * Parses a decimal amount string (e.g. "-9.73") into integer cents using
 * string math only — never floats. Rejects malformed input.
 */
export const parseAmountToCents = (amount: string): number => {
  const match = AMOUNT_PATTERN.exec(amount);
  if (!match) {
    throw new Error(`Invalid amount: "${amount}"`);
  }
  const [, sign, whole, fraction] = match;
  const fractionCents = Number((fraction ?? "").padEnd(2, "0") || 0);
  const cents = Number(whole) * 100 + fractionCents;
  return sign === "-" ? -cents : cents;
};
