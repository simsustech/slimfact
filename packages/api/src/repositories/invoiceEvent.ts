import { db } from '../kysely/index.js'
import type { InvoiceEvents } from '../kysely/types.js'

import { type Insertable, type Selectable, type Updateable } from 'kysely'
type InvoiceEvent = Selectable<InvoiceEvents>
type NewInvoiceEvent = Insertable<InvoiceEvents>
type InvoiceEventUpdate = Updateable<InvoiceEvents>

const defaultSelect = [
  'id',
  'invoiceId',
  'type',
  'timestamp'
] as (keyof InvoiceEvent)[]

function find({
  criteria,
  select
}: {
  criteria: Partial<InvoiceEvent> & { invoiceIds?: number[] }
  select?: (keyof InvoiceEvent)[]
}) {
  if (select) select = [...defaultSelect, ...select]
  else select = [...defaultSelect]

  let query = db.selectFrom('invoiceEvents')

  if (criteria.id) {
    query = query.where('id', '=', criteria.id)
  }

  if (criteria.invoiceId) {
    query = query.where('invoiceEvents.invoiceId', '=', criteria.invoiceId)
  } else if (criteria.invoiceIds) {
    query = query.where(
      'invoiceEvents.invoiceId',
      'in',
      criteria.invoiceIds.length ? criteria.invoiceIds : [null]
    )
  }

  return query.select(select)
}

export async function findInvoiceEvent({
  criteria,
  select
}: {
  criteria: Partial<InvoiceEvent> & { invoiceIds?: number[] }
  select?: (keyof InvoiceEvent)[]
}) {
  const query = find({ criteria, select })

  return query.executeTakeFirst()
}

export async function findInvoiceEvents({
  criteria,
  select
}: {
  criteria: Partial<InvoiceEvent> & { invoiceIds?: number[] }
  select?: (keyof InvoiceEvent)[]
}) {
  const query = find({
    criteria,
    select
  })
  return query.execute()
}

export async function createInvoiceEvent(invoiceEvent: NewInvoiceEvent) {
  return db
    .insertInto('invoiceEvents')
    .values(invoiceEvent)
    .returningAll()
    .executeTakeFirstOrThrow()
}

export async function updateInvoiceEvent(
  criteria: Partial<InvoiceEvent> & { invoiceIds?: number[] },
  updateWith: InvoiceEventUpdate
) {
  let query = db.updateTable('invoiceEvents')

  if (criteria.id) {
    query = query.where('id', '=', criteria.id)
  }

  return query.set(updateWith).executeTakeFirstOrThrow()
}

export async function deleteInvoiceEvent(id: number) {
  return db.deleteFrom('invoiceEvents').where('id', '=', id).executeTakeFirst()
}

export async function getGroupedInvoiceEventsByInvoiceIds(
  invoiceIds: number[]
) {
  const results = await db
    .selectFrom('invoiceEvents')
    .selectAll()
    .where(
      'invoiceEvents.invoiceId',
      'in',
      invoiceIds.length ? invoiceIds : [null]
    )
    .execute()

  return results.reduce(
    (acc, cur) => {
      if (!acc[cur.invoiceId]) acc[cur.invoiceId] = []
      acc[cur.invoiceId].push(cur)
      return acc
    },
    {} as Record<number, InvoiceEvent[]>
  )
}
