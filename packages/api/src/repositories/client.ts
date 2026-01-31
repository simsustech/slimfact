import { db } from '../kysely/index.js'
import type { Clients } from '../kysely/types.js'

import { sql, type Insertable, type Selectable, type Updateable } from 'kysely'
type Client = Selectable<Clients>
type NewClient = Insertable<Clients>
type ClientUpdate = Updateable<Clients>

const defaultSelect = [
  'id',
  'number',
  'address',
  'city',
  'companyName',
  'contactPersonName',
  'country',
  'vatIdNumber',
  'cocNumber',
  'email',
  'postalCode',
  'accountId'
] as (keyof Client)[]

function find({
  criteria,
  select,
  pagination
}: {
  criteria: Partial<Client> & { name?: string }
  select?: (keyof Client)[]
  pagination?: {
    limit: number
    offset: number
    sortBy: 'id'
    descending: boolean
  }
}) {
  if (select) select = [...defaultSelect, ...select]
  else select = [...defaultSelect]

  let query = db.selectFrom('clients')

  if (criteria.id) {
    query = query.where('id', '=', criteria.id)
  }
  if (criteria.name) {
    query = query.where((eb) =>
      eb.or([
        eb(
          eb.fn('lower', ['clients.companyName']),
          'like',
          `%${criteria.name?.toLowerCase()}%`
        ),
        eb(
          eb.fn('lower', ['clients.contactPersonName']),
          'like',
          `%${criteria.name?.toLowerCase()}%`
        )
      ])
    )
  }

  if (criteria.accountId) {
    query = query.where('accountId', '=', criteria.accountId)
  }

  if (pagination) {
    if (pagination.sortBy)
      query = query.orderBy(
        pagination.sortBy,
        pagination.descending ? 'desc' : 'asc'
      )

    query = query
      .select((seb) =>
        seb.cast<number>(seb.fn.count('id').over(), 'integer').as('total')
      )
      .limit(pagination.limit)
      .offset(pagination.offset)
  }
  return query.select((seb) => [...select])
}

export async function findClient({
  criteria,
  select
}: {
  criteria: Partial<Client> & { name?: string }
  select?: (keyof Client)[]
}) {
  const query = find({ criteria, select })

  return query.executeTakeFirst()
}

export async function findClients({
  criteria,
  select,
  pagination
}: {
  criteria: Partial<Client> & { name?: string }
  select?: (keyof Client)[]
  pagination?: {
    limit: number
    offset: number
    sortBy: 'id'
    descending: boolean
  }
}) {
  const query = find({
    criteria,
    select,
    pagination
  })
  return query.execute()
}

export async function createClient(client: NewClient) {
  return db.transaction().execute(async (trx) => {
    const result = await trx
      .insertInto('clients')
      .values(client)
      .returningAll()
      .executeTakeFirstOrThrow()

    if (client.email) {
      await trx
        .updateTable('checkout.invoices')
        .where(sql`client_details->>'email'`, '=', client.email)
        .set({
          clientId: result.id
        })
        .execute()
    }
    return result
  })
}

export async function updateClient(
  criteria: Partial<Client> & { name?: string },
  updateWith: ClientUpdate
) {
  let query = db.updateTable('clients')

  if (criteria.id) {
    query = query.where('id', '=', criteria.id)
  }

  return query.set(updateWith).executeTakeFirstOrThrow()
}

export async function deleteClient(id: number) {
  return db.deleteFrom('clients').where('id', '=', id).executeTakeFirst()
}

export async function searchClients({
  criteria,
  select,
  pagination
}: {
  criteria: Partial<Client> & { name?: string }
  select?: (keyof Client)[]
  pagination?: {
    limit: number
    offset: number
    sortBy: 'id'
    descending: boolean
  }
}) {
  const query = find({ criteria, select, pagination })

  return query.orderBy('id', 'desc').execute()
}
