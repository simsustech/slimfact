import { findStaleConnections, pruneConnections } from "../src/banking/connections.js";
import { db } from "../src/kysely/index.js";

/**
 * Removes superseded/expired open-banking connections.
 *
 * A reconnect issues a new session id, so the previous row stays behind and the
 * bank settings page lists the same bank once per reconnect. Sync prunes
 * automatically after each run; this script does the same on demand, for rows
 * that are already sitting in the database:
 *
 *   node dist/scripts/prune-connections.js [--dry-run]
 *
 * In the container: `docker exec banking-api node dist/scripts/prune-connections.js`
 * Accounts, balances and transactions are never touched — only the connection
 * rows, which exist for the settings page.
 */
const main = async (): Promise<void> => {
  const dryRun = process.argv.includes("--dry-run");
  const { scanned, kept, stale } = await findStaleConnections(db);

  console.log(`${scanned} connection(s): ${kept.length} kept, ${stale.length} stale`);
  for (const connection of kept) {
    console.log(
      `  keep  | ${connection.aspspName} | ${connection.status} | since ${connection.createdAt.toISOString()}`,
    );
  }
  for (const connection of stale) {
    console.log(
      `  stale | ${connection.aspspName} | ${connection.status} | since ${connection.createdAt.toISOString()}`,
    );
  }

  if (stale.length === 0) return;
  if (dryRun) {
    console.log("\n--dry-run: nothing deleted.");
    return;
  }

  const { deleted } = await pruneConnections(db);
  console.log(`\nDeleted ${deleted} superseded/expired connection(s).`);
};

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => db.destroy());
