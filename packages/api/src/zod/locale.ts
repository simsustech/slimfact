import * as z from 'zod'

/**
 * Locales the app produces and stores (bcp47 codes; Quasar lang keys map onto
 * these). Invoices/subscriptions carry one of these.
 */
export const locale = z.enum(['nl-NL', 'en-US', 'de-DE'])

export type Locale = z.infer<typeof locale>
