import { db } from '../kysely/index.js'
import type { AccountsTable as Accounts } from '@modular-api/fastify-oidc/kysely'

import { sql, type Insertable, type Selectable, type Updateable } from 'kysely'
export type Account = Selectable<Accounts>
type NewAccount = Insertable<Accounts>
type AccountUpdate = Updateable<Accounts>

const defaultSelect = [
  'id',
  'email',
  'name',
  'roles',
  'uuid',
  'verified',
  'customFields'
] as (keyof Account)[]

function find({
  criteria,
  select,
  pagination
}: {
  criteria: Partial<Account> & { ids?: number[]; searchPhrase?: string }
  select?: (keyof Account)[]
  pagination?: {
    limit: number
    offset: number
    sortBy: 'id' | 'name' | 'email' | null
    descending: boolean
  }
}) {
  if (select) select = [...defaultSelect, ...select]
  else select = [...defaultSelect]

  let query = db.selectFrom('accounts')

  if (criteria.id) {
    query = query.where('id', '=', criteria.id)
  } else if (criteria.ids) {
    query = query.where('id', 'in', criteria.ids.length ? criteria.ids : [null])
  }

  if (criteria.email) {
    query = query.where('email', 'like', `%${criteria.email.toLowerCase()}%`)
  }

  if (criteria.name) {
    query = query.where((web) =>
      web(
        web.fn('lower', ['name']),
        'like',
        `%${criteria.name?.toLowerCase()}%`
      )
    )
  }

  if (criteria.searchPhrase) {
    query = query.where((web) =>
      web.or([
        web('email', 'like', `%${criteria.searchPhrase}%`),
        web('name', 'like', `%${criteria.name}%`)
      ])
    )
  }

  if (criteria.roles?.length) {
    query = query.where((web) =>
      web(
        sql`CAST(roles AS JSONB)`,
        '@>',
        `[${criteria.roles?.map((role) => `"${role}"`).join(', ')}]`
      )
    )
  }

  if (pagination) {
    if (pagination.sortBy)
      query = query.orderBy(
        pagination.sortBy,
        pagination.descending ? 'desc' : 'asc'
      )

    query = query.limit(pagination.limit).offset(pagination.offset)
  }

  return query.select([]).select(select)
}

export async function findAccount({
  criteria,
  select
}: {
  criteria: Partial<Account> & { searchPhrase?: string }
  select?: (keyof Account)[]
}) {
  const query = find({ criteria, select })

  return query.executeTakeFirst()
}

export async function findAccounts({
  criteria,
  select,
  pagination
}: {
  criteria: Partial<Account> & { ids?: number[]; searchPhrase?: string }
  select?: (keyof Account)[]
  pagination?: {
    limit: number
    offset: number
    sortBy: 'id' | 'name' | 'email' | null
    descending: boolean
  }
}) {
  const query = find({
    criteria,
    select,
    pagination
  })
  return query
    .orderBy(sql`json_array_length(roles)`, 'desc')
    .orderBy('id', 'asc')
    .execute()
}

export async function getAccountsCount({
  criteria
}: {
  criteria: Partial<Account> & { roles?: string[] }
}) {
  let query = db.selectFrom('accounts')

  if (criteria.email) {
    query = query.where('email', 'like', `%${criteria.email}%`)
  }

  if (criteria.name) {
    query = query.where((web) =>
      web(
        web.fn('lower', ['name']),
        'like',
        `%${criteria.name?.toLowerCase()}%`
      )
    )
  }

  if (criteria.roles?.length) {
    query = query.where((web) =>
      web(
        sql`CAST(roles AS JSONB)`,
        '@>',
        `[${criteria.roles?.map((role) => `"${role}"`).join(', ')}]`
      )
    )
  }

  return query
    .select(({ fn }) => [fn.count<number>('accounts.id').as('accountCount')])
    .executeTakeFirst()
    .then((result) => Number(result?.accountCount))
}

export async function createAccount(account: NewAccount) {
  return db
    .insertInto('accounts')
    .values(account)
    .returningAll()
    .executeTakeFirstOrThrow()
}

export async function updateAccount(
  criteria: Partial<Account>,
  updateWith: AccountUpdate
) {
  let query = db.updateTable('accounts')

  if (criteria.id) {
    query = query.where('id', '=', criteria.id)
  }

  return query.set(updateWith).executeTakeFirstOrThrow()
}
