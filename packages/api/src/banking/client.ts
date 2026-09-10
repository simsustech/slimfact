import { createBankingApiClient } from '@slimfact/banking-api/client'
import { centsToAmountString } from '@slimfact/tools/banking'

/**
 * SDK-shaped types the api consumes. The proxy returns DB rows; the client
 * maps them to these shapes so the rest of the api works unchanged.
 */
export interface Account {
  id: string
  aspspName: string
  aspspCountry: string
  currency: string
  iban: string | null
  needsReconnect: boolean
}

export interface Transaction {
  id: string
  currency: string
  creditDebitIndicator: string
  status: string | null
  bookingDate: string | null
  valueDate: string | null
  transactionDate: string | null
  bankTransactionCode: string | null
  /** Decimal amount string (e.g. "-9.73") — parsed to cents downstream. */
  amount: string
  creditorName: string | null
  creditorIban: string | null
  creditorBban: string | null
  creditorAgentBic: string | null
  debtorName: string | null
  debtorIban: string | null
  debtorBban: string | null
  debtorAgentBic: string | null
  remittanceInformation: string | null
  note: string | null
  referenceNumber: string | null
  exchangeRate: string | null
  merchantCategoryCode: string | null
  balanceAfterTransaction: string | null
  balanceAfterCurrency: string | null
}

export interface Connection {
  sessionId: string
  aspspName: string
  aspspCountry: string
  status: string
  validUntil: string
  accountCount: number
  lastSyncedAt: string | null
  psuType: string | null
}

export interface TransactionPage {
  items: Transaction[]
  total: number
}

/** A PSP payout/settlement row as exposed by the proxy (amounts in cents). */
export interface PspSettlement {
  externalId: string
  psp: 'mollie' | 'stripe'
  amountCents: number
  feeCents: number | null
  currency: string
  payoutDate: string | null
  status: string | null
  syncedAt: Date | null
  metadata: Record<string, unknown> | null
}

/** A payment inside a PSP settlement (gross amount in cents). */
export interface PspPayment {
  psp: 'mollie' | 'stripe'
  externalId: string
  settlementId: string | null
  amountCents: number
  currency: string
  /** PSP-provided description — the checkout plugin stores the invoice uuid. */
  description: string | null
  status: string | null
  paidAt: Date | null
  syncedAt: Date | null
}

export interface PspSettlementQuery {
  from?: string
  psp?: 'mollie' | 'stripe'
}

export interface PspPaymentQuery {
  settlementId?: string
  psp?: 'mollie' | 'stripe'
}
export interface TransactionQuery {
  from?: string
  to?: string
  limit?: number
  offset?: number
}

export interface SyncStatus {
  status: 'idle' | 'running' | 'finished' | 'failed' | 'rate_limited'
  runId?: string
  startedAt?: string
  finishedAt?: string | null
  accountsTotal?: number
  accountsSynced?: number
  accountsSkippedReauth?: number
  accountsSkippedRateLimited?: number
  error?: string | null
}

export interface SyncLogger {
  info(message: string, ...args: unknown[]): void
  warn(message: string, ...args: unknown[]): void
  error(message: string, ...args: unknown[]): void
}

/**
 * Narrow seam over the banking source of truth. `sync.ts` and tests depend on
 * this interface, never on a concrete client. The proxy (banking-api) now owns
 * the open-banking.io SDK; SlimFact reads through it over tRPC.
 */
export interface BankingApi {
  getAccounts(): Promise<Account[]>
  getTransactions(
    accountId: string,
    query?: TransactionQuery
  ): Promise<TransactionPage>
  getPspSettlements(query?: PspSettlementQuery): Promise<PspSettlement[]>
  getPspPayments(query?: PspPaymentQuery): Promise<PspPayment[]>
  getConnections(): Promise<Connection[]>
  syncAll(): Promise<{ queued: boolean; runId: string }>
  /** Latest sync run state on the proxy (bus-wait fallback). */
  getSyncStatus(): Promise<SyncStatus>
}

export interface ProxyClientOptions {
  url: string
  apiKey: string
}

const mapAccount = (row: {
  externalId: string
  aspspName: string
  aspspCountry: string
  currency: string
  iban: string | null
  needsReconnect: boolean
}): Account => ({
  id: row.externalId,
  aspspName: row.aspspName,
  aspspCountry: row.aspspCountry,
  currency: row.currency,
  iban: row.iban,
  needsReconnect: row.needsReconnect
})

const mapTransaction = (row: {
  externalId: string
  currency: string
  creditDebit: string
  status: string | null
  bookingDate: string | null
  valueDate: string | null
  transactionDate: string | null
  bankTransactionCode: string | null
  amountCents: number
  creditorName: string | null
  creditorIban: string | null
  creditorBban: string | null
  creditorAgentBic: string | null
  debtorName: string | null
  debtorIban: string | null
  debtorBban: string | null
  debtorAgentBic: string | null
  remittanceInformation: string | null
  note: string | null
  referenceNumber: string | null
  exchangeRate: string | null
  merchantCategoryCode: string | null
  balanceAfterTransactionCents: number | null
  balanceAfterCurrency: string | null
}): Transaction => ({
  id: row.externalId,
  currency: row.currency,
  creditDebitIndicator: row.creditDebit,
  status: row.status,
  bookingDate: row.bookingDate,
  valueDate: row.valueDate,
  transactionDate: row.transactionDate,
  bankTransactionCode: row.bankTransactionCode,
  amount: centsToAmountString(row.amountCents),
  creditorName: row.creditorName,
  creditorIban: row.creditorIban,
  creditorBban: row.creditorBban,
  creditorAgentBic: row.creditorAgentBic,
  debtorName: row.debtorName,
  debtorIban: row.debtorIban,
  debtorBban: row.debtorBban,
  debtorAgentBic: row.debtorAgentBic,
  remittanceInformation: row.remittanceInformation,
  note: row.note,
  referenceNumber: row.referenceNumber,
  exchangeRate: row.exchangeRate,
  merchantCategoryCode: row.merchantCategoryCode,
  balanceAfterTransaction: row.balanceAfterTransactionCents
    ? centsToAmountString(row.balanceAfterTransactionCents)
    : null,
  balanceAfterCurrency: row.balanceAfterCurrency
})

const mapConnection = (row: {
  externalId: string
  aspspName: string
  aspspCountry: string
  status: string
  validUntil: string
  accountCount: number
  lastSyncedAt: string | null
  psuType: string | null
}): Connection => ({
  sessionId: row.externalId,
  aspspName: row.aspspName,
  aspspCountry: row.aspspCountry,
  status: row.status,
  validUntil: row.validUntil,
  accountCount: row.accountCount,
  lastSyncedAt: row.lastSyncedAt,
  psuType: row.psuType
})

/**
 * Builds a BankingApi backed by the proxy's tRPC machine API (Bearer auth).
 * Per-account `sync` was removed with the SDK: the proxy owns the sync loop,
 * SlimFact ingests passively.
 */
export const createClient = ({
  url,
  apiKey
}: ProxyClientOptions): BankingApi => {
  const client = createBankingApiClient({ url, apiKey })
  return {
    getAccounts: async () => {
      const rows = await client.listAccounts.query()
      return rows.map(mapAccount)
    },
    getTransactions: async (accountId, query) => {
      const page = await client.listTransactions.query({
        accountId,
        from: query?.from,
        to: query?.to,
        limit: query?.limit ?? 50,
        offset: query?.offset ?? 0
      })
      return { items: page.items.map(mapTransaction), total: page.total }
    },
    // SAFETY: the proxy serializes open_banking.psp_settlements rows directly;
    // PspSettlement mirrors that row shape, but tRPC can only infer its generic
    // wire type here, so the assertion bridges the two.
    getPspSettlements: async (query) =>
      client.listPspSettlements.query({
        ...query
      }) as unknown as PspSettlement[],
    getPspPayments: async (query) =>
      // SAFETY: same as getPspSettlements — mirrors the psp_payments row shape.
      client.listPspPayments.query({ ...query }) as unknown as PspPayment[],
    getConnections: async () => {
      const rows = await client.listConnections.query()
      return rows.map(mapConnection)
    },
    syncAll: async () => {
      const result = await client.sync.mutate()
      return { queued: result.queued, runId: result.runId }
    },
    getSyncStatus: async () =>
      // SAFETY: mirrors the proxy's sync-status payload (pg-boss run state).
      client.getSyncStatus.query() as unknown as SyncStatus
  }
}
