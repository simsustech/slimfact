import type { EventBus } from "@modular-api/event-bus";
import type { Account, Balance, Connection, Transaction } from "@open-banking-io/client";
import type { Kysely } from "kysely";
import { appConfig } from "../config/env.js";
import type { BankEventSchemas } from "../events.js";
import type { DB } from "../kysely/types.js";
import type { BankingApi } from "./client.js";
import { parseAmountToCents } from "./money.js";

const PAGE_SIZE = 100;
const DAY_MS = 24 * 60 * 60 * 1000;

/** YYYY-MM-DD (the open-banking API's from/to format). */
const toDateString = (date: Date): string => date.toISOString().slice(0, 10);

export interface SyncLogger {
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
}

export interface SyncRunDeps {
  db: Kysely<DB>;
  client: BankingApi;
  bus: EventBus<BankEventSchemas>;
  log: SyncLogger;
  runId: string;
}

export interface SyncRunResult {
  runId: string;
  status: "finished" | "rate_limited" | "failed";
  accountsTotal: number;
  accountsSynced: number;
  accountsSkippedReauth: number;
  accountsSkippedRateLimited: number;
  newTransactions: number;
}

const connectionRequiresReauth = (connection: Connection): boolean =>
  connection.status !== "Active" ||
  (connection.validUntil ? new Date(connection.validUntil).getTime() < Date.now() : false);

const accountKey = (account: { aspspName: string; aspspCountry: string }): string =>
  `${account.aspspName}|${account.aspspCountry}`;

/**
 * HTTP status carried by an error, found via typed properties first
 * (`status`/`statusCode`), falling back to undefined when absent.
 */
const errorStatus = (error: unknown): number | undefined => {
  if (typeof error === "object" && error !== null) {
    const candidate = error as { status?: unknown; statusCode?: unknown };
    if (typeof candidate.status === "number") return candidate.status;
    if (typeof candidate.statusCode === "number") return candidate.statusCode;
  }
  return undefined;
};

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

export const isRateLimited = (error: unknown): boolean => {
  const status = errorStatus(error);
  if (status !== undefined) return status === 429;
  // String fallback for SDK errors that only embed the status in the message.
  return /\b429\b/.test(errorMessage(error));
};

/** The SDK throws `GET/POST … failed: <status>` for expired consent. */
export const isExpiredConsent = (error: unknown): boolean => {
  const status = errorStatus(error);
  if (status !== undefined) return status === 400 || status === 401 || status === 403;
  return (
    /failed: (400|401|403)/.test(errorMessage(error)) ||
    errorMessage(error).includes("no active session")
  );
};

const upsertAccount = async (db: Kysely<DB>, apiAccount: Account): Promise<{ id: number }> => {
  const values = {
    externalId: apiAccount.id,
    aspspName: apiAccount.aspspName,
    aspspCountry: apiAccount.aspspCountry,
    currency: apiAccount.currency,
    accountType: apiAccount.accountType,
    bic: apiAccount.bic,
    iban: apiAccount.iban,
    bban: apiAccount.bban,
    ownerName: apiAccount.ownerName,
    accountName: apiAccount.accountName,
    product: apiAccount.product,
    displayName: apiAccount.displayName,
    needsReconnect: apiAccount.needsReconnect,
  };
  const inserted = await db
    .insertInto("accounts")
    .values(values)
    .onConflict((conflict) =>
      conflict
        .column("externalId")
        .doUpdateSet({ ...values, needsReconnect: apiAccount.needsReconnect }),
    )
    .returning("id")
    .executeTakeFirst();
  if (inserted) return inserted;
  return db
    .selectFrom("accounts")
    .select("id")
    .where("externalId", "=", apiAccount.id)
    .executeTakeFirstOrThrow();
};

const upsertBalances = async (
  db: Kysely<DB>,
  accountId: number,
  balances: Balance[],
): Promise<void> => {
  for (const balance of balances) {
    await db
      .insertInto("balances")
      .values({
        accountId,
        type: balance.type,
        name: balance.name,
        amountCents: parseAmountToCents(balance.amount),
        currency: balance.currency,
        referenceDate: balance.referenceDate,
      })
      .onConflict((conflict) =>
        conflict.columns(["accountId", "type"]).doUpdateSet({
          name: balance.name,
          amountCents: parseAmountToCents(balance.amount),
          currency: balance.currency,
          referenceDate: balance.referenceDate,
        }),
      )
      .execute();
  }
};

const upsertConnections = async (db: Kysely<DB>, connections: Connection[]): Promise<void> => {
  for (const connection of connections) {
    await db
      .insertInto("connections")
      .values({
        externalId: connection.sessionId,
        aspspName: connection.aspspName,
        aspspCountry: connection.aspspCountry,
        status: connection.status,
        validUntil: connection.validUntil,
        accountCount: connection.accountCount,
        lastSyncedAt: connection.lastSyncedAt,
        psuType: connection.psuType,
      })
      .onConflict((conflict) =>
        conflict.column("externalId").doUpdateSet({
          status: connection.status,
          validUntil: connection.validUntil,
          accountCount: connection.accountCount,
          lastSyncedAt: connection.lastSyncedAt,
          psuType: connection.psuType,
        }),
      )
      .execute();
  }
};

/** Inserts new transactions; returns the count of genuinely new rows. */
const upsertTransactions = async (
  db: Kysely<DB>,
  accountId: number,
  transactions: Transaction[],
): Promise<number> => {
  if (transactions.length === 0) return 0;
  const inserted = await db
    .insertInto("transactions")
    .values(
      transactions.map((transaction) => ({
        accountId,
        externalId: transaction.id,
        currency: transaction.currency,
        creditDebit: transaction.creditDebitIndicator,
        status: transaction.status,
        bookingDate: transaction.bookingDate,
        valueDate: transaction.valueDate,
        transactionDate: transaction.transactionDate,
        bankTransactionCode: transaction.bankTransactionCode,
        amountCents: parseAmountToCents(transaction.amount),
        creditorName: transaction.creditorName,
        creditorIban: transaction.creditorIban,
        creditorBban: transaction.creditorBban,
        creditorAgentBic: transaction.creditorAgentBic,
        debtorName: transaction.debtorName,
        debtorIban: transaction.debtorIban,
        debtorBban: transaction.debtorBban,
        debtorAgentBic: transaction.debtorAgentBic,
        remittanceInformation: transaction.remittanceInformation,
        note: transaction.note,
        referenceNumber: transaction.referenceNumber,
        exchangeRate: transaction.exchangeRate,
        merchantCategoryCode: transaction.merchantCategoryCode,
        balanceAfterTransactionCents: transaction.balanceAfterTransaction
          ? parseAmountToCents(transaction.balanceAfterTransaction)
          : null,
        balanceAfterCurrency: transaction.balanceAfterCurrency,
      })),
    )
    .onConflict((conflict) => conflict.columns(["accountId", "externalId"]).doNothing())
    .returning("id")
    .execute();
  return inserted.length;
};

/**
 * Runs one sync: persists connections/accounts/balances, syncs each active
 * account (paginated fetch + dedupe upsert), records the run in `sync_runs`,
 * enforces the per-account min interval + 429 backoff, and publishes
 * `bank.sync.*` events as it progresses.
 */
export const runSync = async (deps: SyncRunDeps): Promise<SyncRunResult> => {
  const { db, client, bus, log, runId } = deps;
  const result: SyncRunResult = {
    runId,
    status: "finished",
    accountsTotal: 0,
    accountsSynced: 0,
    accountsSkippedReauth: 0,
    accountsSkippedRateLimited: 0,
    newTransactions: 0,
  };

  await db
    .insertInto("sync_runs")
    .values({ runId, status: "running" })
    .onConflict((conflict) => conflict.column("runId").doNothing())
    .execute();
  bus.publish("bank.sync.started", { runId });

  let failureMessage: string | undefined;

  const finishRun = async (status: SyncRunResult["status"]) => {
    await db
      .updateTable("sync_runs")
      .set({
        status,
        finishedAt: new Date(),
        accountsTotal: result.accountsTotal,
        accountsSynced: result.accountsSynced,
        accountsSkippedReauth: result.accountsSkippedReauth,
        accountsSkippedRateLimited: result.accountsSkippedRateLimited,
        error: failureMessage ?? null,
      })
      .where("runId", "=", runId)
      .execute();
  };

  try {
    const [connections, apiAccounts] = await Promise.all([
      client.getConnections(),
      client.getAccounts(),
    ]);

    await upsertConnections(db, connections);
    const reauthConnections = connections.filter(connectionRequiresReauth);
    for (const connection of reauthConnections) {
      log.warn(
        `open-banking: connection ${connection.sessionId} (${connection.aspspName}) requires reauth (status ${connection.status}, validUntil ${connection.validUntil})`,
      );
      bus.publish("bank.connection.requiresReauth", {
        connectionId: connection.sessionId,
        aspspName: connection.aspspName,
        validUntil: connection.validUntil,
      });
    }

    result.accountsTotal = apiAccounts.length;
    const reauthKeys = new Set(reauthConnections.map((connection) => accountKey(connection)));
    const reauthAccountIds = new Set(
      apiAccounts
        .filter((apiAccount) => apiAccount.needsReconnect || reauthKeys.has(accountKey(apiAccount)))
        .map((apiAccount) => apiAccount.id),
    );

    for (const apiAccount of apiAccounts) {
      const stored = await upsertAccount(db, apiAccount);
      await upsertBalances(db, stored.id, apiAccount.balances);
    }

    const minIntervalMs = appConfig.openbankingMinSyncIntervalSeconds * 1000;

    for (const apiAccount of apiAccounts) {
      if (reauthAccountIds.has(apiAccount.id)) {
        result.accountsSkippedReauth++;
        bus.publish("bank.sync.accountSkipped", {
          runId,
          accountId: apiAccount.id,
          reason: "reauth",
        });
        continue;
      }

      const stored = await db
        .selectFrom("accounts")
        .select("id")
        .where("externalId", "=", apiAccount.id)
        .executeTakeFirstOrThrow();
      const syncedAt = await db
        .selectFrom("accounts")
        .select("syncedAt")
        .where("externalId", "=", apiAccount.id)
        .executeTakeFirst();

      // Incremental cursor: first sync fetches unbounded (full history);
      // afterwards from = synced_at − 1 day (overlap covers late postings).
      // History accumulates because upsertTransactions never deletes.
      const from = syncedAt?.syncedAt
        ? toDateString(new Date(syncedAt.syncedAt.getTime() - DAY_MS))
        : undefined;

      if (syncedAt?.syncedAt && Date.now() - syncedAt.syncedAt.getTime() < minIntervalMs) {
        result.accountsSkippedRateLimited++;
        bus.publish("bank.sync.accountSkipped", {
          runId,
          accountId: apiAccount.id,
          reason: "rate_limited",
        });
        continue;
      }

      try {
        await client.sync(apiAccount.id);
      } catch (error) {
        if (isRateLimited(error)) {
          result.accountsSkippedRateLimited++;
          result.status = "rate_limited";
          bus.publish("bank.sync.accountSkipped", {
            runId,
            accountId: apiAccount.id,
            reason: "rate_limited",
          });
          continue;
        }
        log.error(`open-banking: sync failed for account ${apiAccount.id}: ${String(error)}`);
        if (isExpiredConsent(error)) {
          result.accountsSkippedReauth++;
          bus.publish("bank.sync.accountSkipped", {
            runId,
            accountId: apiAccount.id,
            reason: "reauth",
          });
          continue;
        }
        result.status = "failed";
        failureMessage = String(error);
        continue;
      }

      let offset = 0;
      let fetched: Transaction[] = [];
      while (true) {
        const page = await client.getTransactions(apiAccount.id, {
          from,
          limit: PAGE_SIZE,
          offset,
        });
        if (page.items.length === 0) break;
        fetched = fetched.concat(page.items);
        offset += page.items.length;
        if (offset >= page.total) break;
        if (page.items.length < PAGE_SIZE) break;
      }

      const newTransactions = await upsertTransactions(db, stored.id, fetched);
      result.newTransactions += newTransactions;
      result.accountsSynced++;
      await db
        .updateTable("accounts")
        .set({ syncedAt: new Date() })
        .where("id", "=", stored.id)
        .execute();
      bus.publish("bank.sync.accountSynced", {
        runId,
        accountId: apiAccount.id,
        newTransactions,
      });
    }

    await finishRun(result.status);
    bus.publish("bank.sync.finished", {
      runId,
      status: result.status,
      accountsSynced: result.accountsSynced,
      accountsSkippedReauth: result.accountsSkippedReauth,
      newTransactions: result.newTransactions,
    });
    return result;
  } catch (error) {
    const message = String(error);
    log.error(`open-banking: sync run ${runId} failed: ${message}`);
    failureMessage = message;
    await finishRun("failed");
    bus.publish("bank.sync.failed", { runId, error: message });
    return { ...result, status: "failed" };
  }
};
