// Generated-style Kysely DB types for the banking-api schema (7 tables).
// Property names are camelCase: the CamelCasePlugin maps them to snake_case
// columns at the query layer. Columns with DB defaults are `Generated<T>` so
// inserts can omit them.

import type { Generated, JSONColumnType } from "kysely";

export interface ApiKey {
  id: Generated<number>;
  label: string;
  /** SHA-256 hex (64 chars) — the raw key never touches the DB. */
  keyHash: string;
  /** First characters of the raw key, safe to display. */
  keyPrefix: string;
  /** e.g. ['read'] or ['read', 'sync']. */
  scopes: string[];
  expiresAt: Date | null;
  revokedAt: Date | null;
  createdAt: Generated<Date>;
  lastUsedAt: Date | null;
}

export interface ApiKeyAccount {
  apiKeyId: number;
  accountId: number;
}

export interface Account {
  id: Generated<number>;
  /** open-banking.io account id. */
  externalId: string;
  aspspName: string;
  aspspCountry: string;
  currency: string;
  accountType: string | null;
  bic: string | null;
  iban: string | null;
  bban: string | null;
  ownerName: string | null;
  accountName: string | null;
  product: string | null;
  displayName: string | null;
  needsReconnect: Generated<boolean>;
  syncedAt: Date | null;
  createdAt: Generated<Date>;
}

export interface Balance {
  id: Generated<number>;
  accountId: number;
  /** ISO 20022 code (ITBD booked, ITAV available, …). */
  type: string;
  name: string | null;
  /** Decimal converted to integer cents. */
  amountCents: number;
  currency: string;
  referenceDate: string | null;
}

export interface Transaction {
  id: Generated<number>;
  accountId: number;
  /** open-banking.io transaction id. */
  externalId: string;
  currency: string;
  creditDebit: string;
  status: string | null;
  bookingDate: string | null;
  valueDate: string | null;
  transactionDate: string | null;
  bankTransactionCode: string | null;
  /** Decimal converted to integer cents. */
  amountCents: number;
  creditorName: string | null;
  creditorIban: string | null;
  creditorBban: string | null;
  creditorAgentBic: string | null;
  debtorName: string | null;
  debtorIban: string | null;
  debtorBban: string | null;
  debtorAgentBic: string | null;
  remittanceInformation: string | null;
  note: string | null;
  referenceNumber: string | null;
  exchangeRate: string | null;
  merchantCategoryCode: string | null;
  balanceAfterTransactionCents: number | null;
  balanceAfterCurrency: string | null;
  createdAt: Generated<Date>;
}

export interface Connection {
  id: Generated<number>;
  /** open-banking.io session id. */
  externalId: string;
  aspspName: string;
  aspspCountry: string;
  status: string;
  validUntil: string;
  accountCount: Generated<number>;
  lastSyncedAt: string | null;
  psuType: string | null;
  createdAt: Generated<Date>;
}

export interface SyncRun {
  id: Generated<number>;
  runId: string;
  status: Generated<"running" | "finished" | "failed" | "rate_limited">;
  startedAt: Generated<Date>;
  finishedAt: Date | null;
  accountsTotal: Generated<number>;
  accountsSynced: Generated<number>;
  accountsSkippedReauth: Generated<number>;
  accountsSkippedRateLimited: Generated<number>;
  error: string | null;
}
export interface PspSettlement {
  /** Mollie settlement id / Stripe payout id. */
  externalId: string;
  psp: string;
  /** Net payout amount in integer cents. */
  amountCents: number;
  feeCents: number | null;
  currency: string;
  payoutDate: string | null;
  status: string | null;
  syncedAt: Date | null;
  /** Raw PSP payload (never deleted; history accumulates). */
  metadata: JSONColumnType<Record<string, unknown>, string> | null;
}

export interface PspPayment {
  psp: string;
  /** Mollie payment id / Stripe payout id. */
  externalId: string;
  /** Links the payment to its payout settlement. */
  settlementId: string | null;
  /** Gross amount (pre-fee) in integer cents. */
  amountCents: number;
  currency: string;
  /** PSP-provided description (the checkout plugin stores the invoice uuid). */
  description: string | null;
  status: string | null;
  paidAt: Date | null;
  syncedAt: Date | null;
}

export interface DB {
  api_keys: ApiKey;
  api_key_accounts: ApiKeyAccount;
  accounts: Account;
  balances: Balance;
  transactions: Transaction;
  connections: Connection;
  sync_runs: SyncRun;
  psp_settlements: PspSettlement;
  psp_payments: PspPayment;
}
