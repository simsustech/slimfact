import type { Kysely } from "kysely";

/** Captures the PSP payment's description (the checkout plugin stores the
 * invoice uuid there) so settlements can resolve each PSP payment to its
 * invoice when the external id doesn't line up with checkout.payments. */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable("open_banking.psp_payments")
    .addColumn("description", "varchar(255)")
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.alterTable("open_banking.psp_payments").dropColumn("description").execute();
}
