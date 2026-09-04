/**
 * Lowercases a reference and strips all non-alphanumeric characters so
 * "Factuur 2026-0001" and "factuur20260001" compare equal.
 */
export const normalizeReference = (reference: string): string =>
  reference.toLowerCase().replace(/[^a-z0-9]/g, '')

/**
 * True when the (already normalized) reference contains the invoice number's
 * digit run, so "2026-0001" matches both "20260001" and "2026-0001".
 */
export const containsInvoiceNumber = (
  normalizedReference: string,
  invoiceNumber: string
): boolean => {
  const digitRun = invoiceNumber.replace(/\D/g, '')
  return digitRun.length > 0 && normalizedReference.includes(digitRun)
}
