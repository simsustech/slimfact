import type { Kysely } from "kysely";
import type { DB } from "../kysely/types.js";

/**
 * Connection hygiene for the bank settings page.
 *
 * open-banking.io issues a **new session id per authorisation**, so reconnecting
 * a bank leaves the previous row behind forever: `upsertConnections` only
 * inserts/updates by session id and nothing ever removes the old one. The
 * settings page then lists the same bank several times — once per reconnect.
 *
 * The SDK exposes no way to revoke a session, so this is local bookkeeping:
 * connection rows are a cache for the settings page and the sync never reads
 * them (it works from the live API responses), so dropping a superseded row
 * costs nothing. Accounts, balances and transactions are keyed by their own
 * external ids and are deliberately left alone.
 */

/** The stored columns that decide whether a connection can still be used. */
export interface ConnectionValidity {
  status: string;
  validUntil: string | null;
}

/**
 * Usable = Active and consent not lapsed (open-banking.io consents expire after
 * 180 days). Mirrors the reauth rule the sync applies to the live API data.
 */
export const connectionUsable = (connection: ConnectionValidity, now: Date = new Date()): boolean =>
  connection.status === "Active" &&
  (!connection.validUntil || new Date(connection.validUntil).getTime() >= now.getTime());

/** `aspspCountry|aspspName` — a reconnect to the same bank lands in one group. */
export const connectionGroupKey = (connection: {
  aspspName: string;
  aspspCountry: string;
}): string => `${connection.aspspCountry}|${connection.aspspName}`;

export interface StoredConnection extends ConnectionValidity {
  id: number;
  aspspName: string;
  aspspCountry: string;
  createdAt: Date;
}

/** Newest first: our insert time, then id, so ties are deterministic. */
const byNewest = (a: StoredConnection, b: StoredConnection): number =>
  b.createdAt.getTime() - a.createdAt.getTime() || b.id - a.id;

/**
 * Ids worth keeping, per ASPSP group:
 *
 * - the **newest** row, always — a session that was just created and still needs
 *   authorising must not vanish from the settings page;
 * - the **newest usable** row, so a reconnect never hides the only working
 *   session: it stays visible next to the new one until the new one works.
 *
 * Everything else is a superseded or expired session.
 */
export const keepConnectionIds = (
  rows: StoredConnection[],
  now: Date = new Date(),
): Set<number> => {
  const groups = new Map<string, StoredConnection[]>();
  for (const row of rows) {
    const key = connectionGroupKey(row);
    const group = groups.get(key);
    if (group) group.push(row);
    else groups.set(key, [row]);
  }

  const keep = new Set<number>();
  for (const group of groups.values()) {
    const sorted = [...group].sort(byNewest);
    keep.add(sorted[0]!.id);
    const newestUsable = sorted.find((row) => connectionUsable(row, now));
    if (newestUsable) keep.add(newestUsable.id);
  }
  return keep;
};

export interface StaleConnections {
  scanned: number;
  kept: StoredConnection[];
  stale: StoredConnection[];
}

/** Reads the connection rows and splits them into kept / superseded-or-expired. */
export const findStaleConnections = async (
  db: Kysely<DB>,
  now: Date = new Date(),
): Promise<StaleConnections> => {
  const rows = await db
    .selectFrom("connections")
    .select(["id", "aspspName", "aspspCountry", "status", "validUntil", "createdAt"])
    .execute();

  const keep = keepConnectionIds(rows, now);
  return {
    scanned: rows.length,
    kept: rows.filter((row) => keep.has(row.id)),
    stale: rows.filter((row) => !keep.has(row.id)),
  };
};

export interface PruneConnectionsResult {
  scanned: number;
  deleted: number;
}

/**
 * Deletes superseded/expired connection rows and reports what it did. Called
 * after every sync, so the settings page stays clean on its own.
 */
export const pruneConnections = async (
  db: Kysely<DB>,
  options: { now?: Date; log?: { info(message: string): void } } = {},
): Promise<PruneConnectionsResult> => {
  const { scanned, stale } = await findStaleConnections(db, options.now ?? new Date());
  if (stale.length === 0) return { scanned, deleted: 0 };

  const deleted = await db
    .deleteFrom("connections")
    .where(
      "id",
      "in",
      stale.map((row) => row.id),
    )
    .execute();

  const count = Number(deleted[0]?.numDeletedRows ?? 0);
  const described = stale
    .map((row) => `${row.aspspName} ${row.status} (since ${row.createdAt.toISOString()})`)
    .join(", ");
  options.log?.info(`open-banking: pruned ${count} superseded/expired connection(s): ${described}`);
  return { scanned, deleted: count };
};
