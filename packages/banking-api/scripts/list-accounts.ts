import { db } from "../src/kysely/index.js";

// Prints `externalId | aspspName | iban` for every account — paste ids into the
// key config file's `accounts` grants.
const listAccounts = async () => {
  const accounts = await db
    .selectFrom("accounts")
    .select(["externalId", "aspspName", "iban"])
    .orderBy("externalId")
    .execute();
  for (const account of accounts) {
    console.log(`${account.externalId} | ${account.aspspName} | ${account.iban ?? ""}`);
  }
  await db.destroy();
};

listAccounts().catch((error) => {
  console.error(error);
  process.exit(1);
});
