import { ExpressionBuilder } from 'kysely'
import { db, type Database } from '../kysely/index.js'
import type { Subscriptions } from '../kysely/types.d.ts'

import type { Insertable, Selectable, Updateable } from 'kysely'
import { jsonObjectFrom } from 'kysely/helpers/postgres'
type Subscription = Selectable<Subscriptions>
type NewSubscription = Insertable<Subscriptions>
type SubscriptionUpdate = Updateable<Subscriptions>

const defaultSelect = [
  'id',
  'uuid',
  'active',
  'name',
  'companyId',
  'clientId',
  'currency',
  'locale',
  'startDate',
  'endDate',
  'paymentTermDays',
  'numberPrefixTemplate',
  'lines',
  'discounts',
  'surcharges',
  'cronSchedule',
  'type'
] as (keyof Subscription)[]

function withCompany(eb: ExpressionBuilder<Database, 'subscriptions'>) {
  return jsonObjectFrom(
    eb
      .selectFrom('companies')
      .whereRef('companies.id', '=', 'subscriptions.companyId')
      .select(['name'])
  ).as('company')
}

function withClient(eb: ExpressionBuilder<Database, 'subscriptions'>) {
  return jsonObjectFrom(
    eb
      .selectFrom('clients')
      .whereRef('clients.id', '=', 'subscriptions.clientId')
      .select(['companyName', 'contactPersonName'])
  ).as('client')
}

function find({
  criteria,
  select
}: {
  criteria: Partial<Subscription> & { name?: string }
  select?: (keyof Subscription)[]
}) {
  if (select) select = [...defaultSelect, ...select]
  else select = [...defaultSelect]

  let query = db.selectFrom('subscriptions')

  if (criteria.id) {
    query = query.where('id', '=', criteria.id)
  }

  if (criteria.companyId) {
    query = query.where('companyId', '=', criteria.companyId)
  }

  if (criteria.clientId) {
    query = query.where('clientId', '=', criteria.clientId)
  }

  if (criteria.active !== void 0) {
    query = query.where('active', '=', criteria.active)
  }

  return query.select(select).select([withClient, withCompany])
}

export async function findSubscription({
  criteria,
  select
}: {
  criteria: Partial<Subscription> & { name?: string }
  select?: (keyof Subscription)[]
}) {
  const query = find({ criteria, select })

  return query.executeTakeFirst()
}

export async function findSubscriptions({
  criteria,
  select
}: {
  criteria: Partial<Subscription> & { name?: string }
  select?: (keyof Subscription)[]
}) {
  const query = find({
    criteria,
    select
  })
  return query.execute()
}

export async function createSubscription(subscription: NewSubscription) {
  return db
    .insertInto('subscriptions')
    .values({
      numberPrefixTemplate: subscription.numberPrefixTemplate,
      currency: subscription.currency,
      lines: subscription.lines,
      discounts: subscription.discounts,
      surcharges: subscription.surcharges,
      paymentTermDays: subscription.paymentTermDays,
      locale: subscription.locale,
      startDate: subscription.startDate,
      endDate: subscription.endDate,
      companyId: subscription.companyId,
      clientId: subscription.clientId,
      cronSchedule: subscription.cronSchedule,
      name: subscription.name,
      type: subscription.type
    })
    .returningAll()
    .executeTakeFirstOrThrow()
}

export async function updateSubscription(
  criteria: Partial<Subscription> & { name?: string },
  updateWith: SubscriptionUpdate
) {
  let query = db.updateTable('subscriptions')

  if (criteria.id) {
    query = query.where('id', '=', criteria.id)
  }

  return query.set(updateWith).executeTakeFirstOrThrow()
}

export async function deleteSubscription(id: number) {
  return db.deleteFrom('subscriptions').where('id', '=', id).executeTakeFirst()
}
