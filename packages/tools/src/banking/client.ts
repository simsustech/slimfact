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

/**
 * Client-name equality used for adoption ties. Port of the SQL
 * `client_name_matches`: exact canonical match; else every token of the
 * shorter name must hit a token of the longer one (single-char tokens
 * prefix-match); else the surname (last token) must hit AND at least one
 * other token must hit. Mirrors `packages/tools/src/banking/clientParser.ts`.
 */
/**
 * True when both names share a >=4-char token (surname-ish overlap). Port of
 * the SQL `shared_surname`. Used for adoption ties: initial-prefixed payers
 * ("Hr M Groenewegen, Mw C Mendez Cabrera") match the invoice client's
 * surname ("Marco Groenewegen") even when first names differ.
 */
export const sharedSurnameToken = (
  a: string | null | undefined,
  b: string | null | undefined
): boolean => {
  const ta = canonicalName(a)
    .split(' ')
    .filter((t) => t.length >= 4)
  const tb = canonicalName(b)
    .split(' ')
    .filter((t) => t.length >= 4)
  return ta.some((s) =>
    tb.some((l) => s === l || s.includes(l) || l.includes(s))
  )
}

export const clientNameMatches = (
  a: string | null | undefined,
  b: string | null | undefined
): boolean => {
  const ca = canonicalName(a)
  const cb = canonicalName(b)
  if (!ca || !cb) return false
  if (ca === cb) return true
  const ta = ca.split(' ').filter(Boolean)
  const tb = cb.split(' ').filter(Boolean)
  const [shorter, longer] = ta.length <= tb.length ? [ta, tb] : [tb, ta]

  // Every token of the shorter name must hit a token of the longer one.
  let ok = true
  for (const tok of shorter) {
    const hit =
      tok.length === 1
        ? longer.some((lt) => lt.startsWith(tok))
        : longer.some((lt) => lt === tok || lt.includes(tok))
    if (!hit) {
      ok = false
      break
    }
  }
  if (ok) return true

  // Fallback: the surname (last token of the shorter name) must hit and at
  // least one other token must hit.
  const surname = shorter[shorter.length - 1]
  if (!surname || surname.length === 1) return false
  const surnameHits = longer.some(
    (lt) => lt === surname || lt.includes(surname)
  )
  if (!surnameHits) return false
  const others = shorter
    .slice(0, -1)
    .filter((tok) =>
      tok.length === 1
        ? longer.some((lt) => lt.startsWith(tok))
        : longer.some((lt) => lt === tok || lt.includes(tok))
    ).length
  return others >= 1
}
