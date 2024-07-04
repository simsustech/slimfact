import { db } from '../kysely/index.js'
import type { NumberPrefixes } from '../kysely/types.d.ts'

import type { Insertable, Selectable, Updateable } from 'kysely'
type NumberPrefix = Selectable<NumberPrefixes>
type NewNumberPrefix = Insertable<NumberPrefixes>
type NumberPrefixUpdate = Updateable<NumberPrefixes>

const defaultSelect = ['id', 'name', 'template'] as (keyof NumberPrefix)[]

function find({
  criteria,
  select
}: {
  criteria: Partial<NumberPrefix> & { name?: string }
  select?: (keyof NumberPrefix)[]
}) {
  if (select) select = [...defaultSelect, ...select]
  else select = [...defaultSelect]

  let query = db.selectFrom('numberPrefixes')

  if (criteria.id) {
    query = query.where('id', '=', criteria.id)
  }

  return query.select(select)
}

export async function findNumberPrefix({
  criteria,
  select
}: {
  criteria: Partial<NumberPrefix> & { name?: string }
  select?: (keyof NumberPrefix)[]
}) {
  const query = find({ criteria, select })

  return query.executeTakeFirst()
}

export async function findNumberPrefixes({
  criteria,
  select
}: {
  criteria: Partial<NumberPrefix> & { name?: string }
  select?: (keyof NumberPrefix)[]
}) {
  const query = find({
    criteria,
    select
  })
  return query.execute()
}

export async function createNumberPrefix(numberPrefix: NewNumberPrefix) {
  return db
    .insertInto('numberPrefixes')
    .values(numberPrefix)
    .returningAll()
    .executeTakeFirstOrThrow()
}

export async function updateNumberPrefix(
  criteria: Partial<NumberPrefix> & { name?: string },
  updateWith: NumberPrefixUpdate
) {
  let query = db.updateTable('numberPrefixes')

  if (criteria.id) {
    query = query.where('id', '=', criteria.id)
  }

  return query.set(updateWith).executeTakeFirstOrThrow()
}

export async function deleteNumberPrefix(id: number) {
  return db.deleteFrom('numberPrefixes').where('id', '=', id).executeTakeFirst()
}
