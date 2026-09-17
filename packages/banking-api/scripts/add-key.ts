import { readFileSync, writeFileSync } from "node:fs";
import type { Kysely } from "kysely";
import { generateKey, keyPrefix } from "../src/api-keys/keys.js";
import type { ApiKeyEntry } from "../src/config/keys.js";
import {
  apiKeyConfigSchema,
  buildKeyEntry,
  resolveAccountSelectors,
  upsertKeyEntry,
  type AccountSelector,
} from "../src/config/keys.js";
import type { DB } from "../src/kysely/types.js";

/**
 * Mints an API key and merges it into the mounted key config, granting only the
 * accounts you list — so several clients can share one banking-api with
 * disjoint IBANs instead of each key granting everything the proxy syncs.
 *
 *   add-key [outPath] [live|test] --label <label> [--iban <iban>]... [--account <id>]...
 *
 *     --in <path>       config to merge into (default $BANKING_API_CONFIG_PATH)
 *     --scope <scopes>  comma list of read,sync (default read,sync)
 *     --expires <iso>   optional expiry timestamp
 *     --force           replace an entry with the same label (rotates that key)
 *     --dry-run         print the merged config without writing anything
 *
 * The container mounts the config read-only, so write to /tmp and copy it out:
 *
 *   docker compose exec banking-api node dist/scripts/add-key.js /tmp/config.json \
 *     --label client-a --iban NL20KNAB0123456780
 *   docker compose cp banking-api:/tmp/config.json ./banking-api-config.json
 *   docker compose restart banking-api
 */
const HELP = `Usage: add-key [outPath] [live|test] --label <label> [options]

  --in <path>       config to merge into (default $BANKING_API_CONFIG_PATH)
  --label <label>   required; names the consumer, e.g. client-a
  --iban <iban>     grant one account by IBAN (repeatable)
  --account <id>    grant one account by external id (repeatable)
  --scope <scopes>  comma list of read,sync (default read,sync)
  --expires <iso>   optional expiry timestamp
  --force           replace an entry with the same label (rotates that key)
  --dry-run         print the merged config without writing anything

Writes the merged config to [outPath], defaulting to the --in path. In the
container that path is mounted read-only: write to /tmp and copy it out, then
restart banking-api so the key is reconciled into the database.

  docker compose exec banking-api node dist/scripts/add-key.js /tmp/config.json \\
    --label client-a --iban NL20KNAB0123456780
  docker compose cp banking-api:/tmp/config.json ./banking-api-config.json`;

const VALUE_FLAGS = new Set(["in", "label", "iban", "account", "scope", "expires"]);
/** Set once the DB module is loaded, so `--help` runs without POSTGRES_*. */
let closeDb: (() => Promise<void>) | undefined;
const BOOLEAN_FLAGS = new Set(["force", "dry-run", "help"]);

interface ParsedArgs {
  /** Value flags in command-line order, so grants keep the order they were given. */
  entries: { name: string; value: string }[];
  booleans: Set<string>;
  positional: string[];
}

const parseArgs = (argv: string[]): ParsedArgs => {
  const parsed: ParsedArgs = { entries: [], booleans: new Set(), positional: [] };

  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index]!;
    if (!arg.startsWith("--")) {
      parsed.positional.push(arg);
      continue;
    }
    // `--flag=value` and `--flag value` both work.
    const equals = arg.indexOf("=");
    const name = equals === -1 ? arg.slice(2) : arg.slice(2, equals);
    const inline = equals === -1 ? undefined : arg.slice(equals + 1);

    if (VALUE_FLAGS.has(name)) {
      const value = inline ?? argv[++index];
      if (value === undefined) throw new Error(`--${name} needs a value`);
      parsed.entries.push({ name, value });
      continue;
    }
    if (BOOLEAN_FLAGS.has(name)) {
      if (inline !== undefined) throw new Error(`--${name} takes no value`);
      parsed.booleans.add(name);
      continue;
    }
    // Catches typos like --lable instead of silently ignoring them.
    throw new Error(`unknown flag --${name}`);
  }

  return parsed;
};

const main = async (): Promise<void> => {
  const { entries, booleans, positional } = parseArgs(process.argv.slice(2));
  if (booleans.has("help") || process.argv.length <= 2) {
    console.log(HELP);
    return;
  }

  const last = (name: string): string | undefined =>
    entries.findLast((entry) => entry.name === name)?.value;
  const label = last("label");
  if (!label) throw new Error(`--label is required\n\n${HELP}`);

  const scopes: ApiKeyEntry["scopes"] = [];
  for (const scope of (last("scope") ?? "read,sync")
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value.length > 0)) {
    if (scope !== "read" && scope !== "sync") {
      throw new Error(`unknown scope "${scope}" — expected read and/or sync`);
    }
    scopes.push(scope);
  }
  if (scopes.length === 0) throw new Error("--scope needs at least one of read, sync");

  const selectors: AccountSelector[] = entries
    .filter((entry) => entry.name === "iban" || entry.name === "account")
    .map((entry) => ({
      kind: entry.name === "iban" ? ("iban" as const) : ("externalId" as const),
      value: entry.value,
    }));

  // The image and a checkout both run this as ESM; the DB is imported here so
  // `--help` works without POSTGRES_* set.
  const { db } = (await import("../src/kysely/index.js")) as { db: Kysely<DB> };
  closeDb = () => db.destroy();

  const configPath =
    last("in") ?? process.env.BANKING_API_CONFIG_PATH ?? "./banking-api-config.json";
  const outPath = positional.find((arg) => arg !== "live") ?? configPath;
  const environment = positional.includes("live") ? "live" : "test";
  const dryRun = booleans.has("dry-run");

  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(configPath, "utf-8"));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      // Not created implicitly: starting from a blank file would drop every key
      // that is currently granted, and those keys get revoked at the next boot.
      throw new Error(
        `no config at ${configPath} — banking-api needs it to exist; create it first:\n` +
          `  printf '{"apiKeys": []}\\n' > ${configPath}`,
      );
    }
    throw error;
  }

  const existing = apiKeyConfigSchema.safeParse(raw);
  if (!existing.success) {
    throw new Error(`config at ${configPath} is invalid: ${existing.error.message}`);
  }

  const selection = await resolveAccountSelectors(db, selectors);
  if (selection.unknownIbans.length > 0) {
    throw new Error(
      `no synced account has IBAN ${selection.unknownIbans.join(", ")} — check "list-accounts"`,
    );
  }
  if (selection.ambiguousIbans.length > 0) {
    const described = selection.ambiguousIbans
      .map(({ iban, externalIds }) => `${iban} (${externalIds.join(", ")})`)
      .join("; ");
    throw new Error(`IBAN belongs to several accounts — grant by --account instead: ${described}`);
  }

  const key = generateKey(environment);
  const entry = buildKeyEntry({
    label,
    key,
    scopes,
    accounts: selection.accounts.map((account) => account.externalId),
    expiresAt: last("expires"),
  });
  const merged = upsertKeyEntry(existing.data, entry, { replace: booleans.has("force") });

  // Spread the raw object so fields this script doesn't know about survive.
  const serialized = `${JSON.stringify({ ...(raw as Record<string, unknown>), apiKeys: merged.apiKeys }, null, 2)}\n`;

  if (!dryRun) {
    try {
      writeFileSync(outPath, serialized, { mode: 0o600 });
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === "EROFS" || code === "EACCES") {
        throw new Error(
          `${outPath} is not writable (${code}) — the container mounts the config read-only.\n` +
            `Write to /tmp instead and copy it out:\n` +
            `  docker compose exec banking-api node dist/scripts/add-key.js /tmp/config.json \\\n` +
            `    --label ${label} --iban <iban>\n` +
            `  docker compose cp banking-api:/tmp/config.json ./banking-api-config.json`,
        );
      }
      throw error;
    }
  }

  console.log(`key:    ${key}`);
  console.log(`prefix: ${keyPrefix(key)}`);
  console.log(`label:  ${label}`);
  console.log(`scopes: ${scopes.join(",")}`);
  if (selection.accounts.length > 0) {
    console.log(`granted accounts (${selection.accounts.length}):`);
    for (const account of selection.accounts) {
      console.log(`  ${account.externalId} | ${account.aspspName} | ${account.iban ?? ""}`);
    }
  } else {
    console.log("granted accounts (0) — empty `accounts` means this key reads nothing.");
  }
  for (const externalId of selection.unknownExternalIds) {
    console.warn(
      `warning: no account with external id "${externalId}" is stored yet — the grant stays dormant`,
    );
  }

  if (dryRun) {
    console.log(`\n--dry-run: nothing written. Merged config:\n${serialized}`);
    return;
  }

  console.log(`\nWrote ${outPath} (mode 0600)`);
  if (outPath !== configPath) {
    console.log(`Copy it into place (${configPath}) before restarting banking-api.`);
  }
  console.log("\nPut this on the client that owns those IBANs:");
  console.log(`  BANKING_API_KEY=${key}`);
  console.log("\nThen restart banking-api so the key is reconciled into the database.");
};

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => {
    // Closes the pool; the DB is imported lazily, so nothing to do on --help.
    void closeDb?.().catch(() => {});
  });
