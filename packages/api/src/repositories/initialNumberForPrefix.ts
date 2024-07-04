import { ExpressionBuilder } from 'kysely'
import { db, type Database } from '../kysely/index.js'
import type { InitialNumberForPrefixes } from '../kysely/types.d.ts'

import type { Insertable, Selectable, Updateable } from 'kysely'
import { jsonObjectFrom } from 'kysely/helpers/postgres'
type InitialNumberForPrefix = Selectable<InitialNumberForPrefixes>
type NewInitialNumberForPrefix = Insertable<InitialNumberForPrefixes>
type InitialNumberForPrefixUpdate = Updateable<InitialNumberForPrefixes>

const defaultSelect = [
  'id',
  'companyId',
  'numberPrefix',
  'initialNumber'
] as (keyof InitialNumberForPrefix)[]

function withCompany(
  eb: ExpressionBuilder<Database, 'initialNumberForPrefixes'>
) {
  return jsonObjectFrom(
    eb
      .selectFrom('companies')
      .whereRef('companies.id', '=', 'initialNumberForPrefixes.companyId')
      .select(['name'])
  ).as('company')
}

function find({
  criteria,
  select
}: {
  criteria: Partial<InitialNumberForPrefix> & { name?: string }
  select?: (keyof InitialNumberForPrefix)[]
}) {
  if (select) select = [...defaultSelect, ...select]
  else select = [...defaultSelect]

  let query = db.selectFrom('initialNumberForPrefixes')

  if (criteria.id) {
    query = query.where('id', '=', criteria.id)
  }

  return query.select(select).select([withCompany])
}

export async function findInitialNumberForPrefix({
  criteria,
  select
}: {
  criteria: Partial<InitialNumberForPrefix> & { name?: string }
  select?: (keyof InitialNumberForPrefix)[]
}) {
  const query = find({ criteria, select })

  return query.executeTakeFirst()
}

export async function findInitialNumberForPrefixes({
  criteria,
  select
}: {
  criteria: Partial<InitialNumberForPrefix> & { name?: string }
  select?: (keyof InitialNumberForPrefix)[]
}) {
  const query = find({
    criteria,
    select
  })
  return query.execute()
}

export async function createInitialNumberForPrefix(
  numberPrefix: NewInitialNumberForPrefix
) {
  return db
    .insertInto('initialNumberForPrefixes')
    .values(numberPrefix)
    .returningAll()
    .executeTakeFirstOrThrow()
}

export async function updateInitialNumberForPrefix(
  criteria: Partial<InitialNumberForPrefix> & { name?: string },
  updateWith: InitialNumberForPrefixUpdate
) {
  let query = db.updateTable('initialNumberForPrefixes')

  if (criteria.id) {
    query = query.where('id', '=', criteria.id)
  }

  return query.set(updateWith).executeTakeFirstOrThrow()
}

export async function deleteInitialNumberForPrefix(id: number) {
  return db
    .deleteFrom('initialNumberForPrefixes')
    .where('id', '=', id)
    .executeTakeFirst()
}
