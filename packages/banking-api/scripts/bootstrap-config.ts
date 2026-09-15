import { existsSync, writeFileSync } from "node:fs";
import { generateKey } from "../src/api-keys/keys.js";
import { db } from "../src/kysely/index.js";

/**
 * Writes a complete API-key config file: generates a key and grants it every
 * account currently in the database.
 *
 * Run this *after* the first sync has populated accounts — `accounts: []` means
 * no access, not all access, so the ids have to exist before they can be granted.
 *
 *   pnpm bootstrap-config [outPath] [live]
 */

const args = process.argv.slice(2);
const env = args.includes("live") ? "live" : "test";
const outPath =
  args.find((arg) => arg !== "live") ?? process.env.BANKING_API_CONFIG_PATH ?? "./config.json";

const bootstrap = async () => {
  const accounts = await db
    .selectFrom("accounts")
    .select(["externalId", "aspspName", "iban"])
    .orderBy("externalId")
    .execute();
  await db.destroy();

  if (accounts.length === 0) {
    console.error(
      [
        "No accounts in the database yet — refusing to write a config.",
        "",
        "A key with an empty `accounts` array has NO access (not all access), so",
        "writing one now would produce a key that silently reads nothing.",
        "",
        "Start banking-api once with OPENBANKING_CREDENTIALS_JSON set so the first",
        "sync populates accounts, then re-run this.",
      ].join("\n"),
    );
    process.exit(1);
  }

  if (existsSync(outPath) && !args.includes("--force")) {
    console.error(`${outPath} already exists — pass --force to overwrite (this rotates the key).`);
    process.exit(1);
  }

  const key = generateKey(env);
  const config = {
    apiKeys: [
      {
        label: "slimfact-api",
        key,
        scopes: ["read", "sync"],
        accounts: accounts.map((account) => account.externalId),
      },
    ],
  };

  writeFileSync(outPath, `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 });

  console.log(`Wrote ${outPath} (mode 0600)\n`);
  console.log(`  key: ${key}\n`);
  console.log(`  granted accounts (${accounts.length}):`);
  for (const account of accounts) {
    console.log(`    ${account.externalId} | ${account.aspspName} | ${account.iban ?? ""}`);
  }
  console.log("");
  console.log("Put this on the SlimFact api service:");
  console.log(`  BANKING_API_KEY=${key}`);
  console.log("Then restart banking-api so it reconciles the key into the database.");
};

bootstrap().catch((error) => {
  console.error(error);
  process.exit(1);
});
