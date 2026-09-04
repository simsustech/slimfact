/**
 * Client-name canonicalization and fuzzy matching helpers.
 * Mirrors SQL `canon_name` — NFD diacritic strip, lowercase, non-alnum collapse.
 */

import Fuse from 'fuse.js'

/**
 * Canonical client name: NFD decompose → strip combining marks → lowercase →
 * collapse non-alphanumeric runs to single space → trim.
 * Mirrors SQL `canon_name`.
 */
export const canonicalName = (name: string | null | undefined): string => {
  if (!name) return ''
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

export interface FuseInvoiceDoc {
  companyId: number
  client: string
  invoiceNumber: string
}

/**
 * Builds one Fuse index over invoice docs for fuzzy client matching.
 * Keys: client (weight 2), invoiceNumber (weight 3).
 */
export const buildClientFuseIndex = (
  clientData: Array<{
    companyId: number
    clientCompany?: string | null
    invoiceNumber?: string | null
  }>
): Fuse<FuseInvoiceDoc> => {
  const docs: FuseInvoiceDoc[] = clientData.map((c) => ({
    companyId: c.companyId,
    client: canonicalName(c.clientCompany),
    invoiceNumber: canonicalName(c.invoiceNumber)
  }))

  return new Fuse(docs, {
    keys: [
      { name: 'client', weight: 2 },
      { name: 'invoiceNumber', weight: 3 }
    ],
    threshold: 0.45,
    ignoreLocation: true,
    includeScore: true
  })
}

/**
 * Returns the best fuzzy client score (0–1, higher = better) for a query
 * against the pre-built Fuse index. Returns 0 when no match is found.
 */
export const fuzzyClientScore = (
  query: string,
  index: Fuse<FuseInvoiceDoc>,
  companyId?: number
): number => {
  const normalizedQuery = canonicalName(query)
  if (!normalizedQuery) return 0

  let results = index.search(normalizedQuery)
  if (companyId != null) {
    results = results.filter((r) => r.item.companyId === companyId)
  }

  const best = results[0]
  if (best?.score != null) {
    return 1 - best.score // Fuse: 0 = perfect, 1 = worst
  }
  return 0
}
