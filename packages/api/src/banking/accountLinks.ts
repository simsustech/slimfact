import type { Kysely } from 'kysely'
import type { DB } from '../kysely/types.js'
import type { Account } from './client.js'
import { normalizeIban } from './sync.js'

/**
 * Explicit company ↔ account links (many-to-many). Both the tRPC router and
 * the ingest worker cross this seam: resolution is link-first, IBAN fallback.
 */

/** account_external_id → the company ids explicitly linked to that account. */
export const fetchAccountCompanyLinks = async (
  db: Kysely<DB>
): Promise<Map<string, number[]>> => {
  const rows = await db
    .selectFrom('bankAccountCompanies')
    .select(['accountExternalId', 'companyId'])
    .orderBy('companyId')
    .execute()
  const links = new Map<string, number[]>()
  for (const row of rows) {
    const ids = links.get(row.accountExternalId)
    if (ids) ids.push(row.companyId)
    else links.set(row.accountExternalId, [row.companyId])
  }
  return links
}

/**
 * Pure company resolution for one account: explicit links win over any IBAN
 * match; otherwise the IBAN fallback (single company); `[]` when neither.
 */
export const resolveCompanyIds = (
  links: Map<string, number[]>,
  ibanCompanyIds: Map<string, number>,
  account: Pick<Account, 'id' | 'iban'>
): number[] => {
  const linked = links.get(account.id)
  if (linked && linked.length > 0) return [...linked]
  if (!account.iban) return []
  const ibanCompany = ibanCompanyIds.get(normalizeIban(account.iban))
  return ibanCompany === undefined ? [] : [ibanCompany]
}

/**
 * Replace the full link set of an account (the settings picker is a
 * multi-select; an empty array clears every link and IBAN fallback resumes).
 */
export const setAccountCompanies = async (
  db: Kysely<DB>,
  accountExternalId: string,
  companyIds: number[]
): Promise<void> => {
  await db
    .deleteFrom('bankAccountCompanies')
    .where('accountExternalId', '=', accountExternalId)
    .execute()
  if (companyIds.length === 0) return
  await db
    .insertInto('bankAccountCompanies')
    .values(companyIds.map((companyId) => ({ accountExternalId, companyId })))
    .execute()
}
