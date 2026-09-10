import type { Kysely } from "kysely";

/**
 * Drop the stale `open_banking.suggestions` table. It was never read by
 * any code — the suggestion engine runs in-memory in @slimfact/tools/banking
 * and the api calls it on each request.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable("suggestions").ifExists().execute();
}

export async function down(): Promise<void> {
  // No down migration — the table was never used.
}
