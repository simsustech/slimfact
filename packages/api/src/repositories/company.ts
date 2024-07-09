import { db } from '../kysely/index.js'
import type { Companies } from '../kysely/types.d.ts'

import type { Insertable, Selectable, Updateable } from 'kysely'
type Company = Selectable<Companies>
type NewCompany = Insertable<Companies>
type CompanyUpdate = Updateable<Companies>

const defaultSelect = [
  'id',
  'name',
  'contactPersonName',
  'address',
  'postalCode',
  'city',
  'country',
  'telephoneNumber',
  'email',
  'emailBcc',
  'cocNumber',
  'vatIdNumber',
  'iban',
  'bic',
  'logoSvg',
  'prefix',
  'website',
  'defaultNumberPrefixTemplate'
] as (keyof Company)[]

function find({
  criteria,
  select
}: {
  criteria: Partial<Company>
  select?: (keyof Company)[]
}) {
  if (select) select = [...defaultSelect, ...select]
  else select = [...defaultSelect]

  let query = db.selectFrom('companies')

  if (criteria.id) {
    query = query.where('id', '=', criteria.id)
  }

  if (criteria.name) {
    query = query.where((eb) =>
      eb(eb.fn('lower', ['name']), 'like', `%${criteria.name?.toLowerCase()}%`)
    )
  }

  return query.select(select).select([])
}

export async function findCompany({
  criteria,
  select
}: {
  criteria: Partial<Company>
  select?: (keyof Company)[]
}) {
  const query = find({ criteria, select })

  return query.executeTakeFirst()
}

export async function findCompanies({
  criteria,
  select
}: {
  criteria: Partial<Company>
  select?: (keyof Company)[]
}) {
  const query = find({
    criteria,
    select
  })
  return query.execute()
}

export async function createCompany(company: NewCompany) {
  return db
    .insertInto('companies')
    .values(company)
    .returningAll()
    .executeTakeFirstOrThrow()
}

export async function updateCompany(
  criteria: Partial<Company>,
  updateWith: CompanyUpdate
) {
  let query = db.updateTable('companies')

  if (criteria.id) {
    query = query.where('id', '=', criteria.id)
  }

  return query.set(updateWith).executeTakeFirstOrThrow()
}

export async function deleteCompany(id: number) {
  return db.deleteFrom('companies').where('id', '=', id).executeTakeFirst()
}

export async function searchCompanies({
  criteria,
  select
}: {
  criteria: Partial<Company>
  select?: (keyof Company)[]
}) {
  const query = find({ criteria, select })

  return query.orderBy('id', 'desc').limit(5).execute()
}
