import { OpenBankingClient } from "@open-banking-io/client";
import type {
  Account,
  Connection,
  CredentialsBundle,
  SyncAllResult,
  SyncResult,
  TransactionPage,
} from "@open-banking-io/client";

export interface TransactionQuery {
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
}

/**
 * Narrow seam over the open-banking.io SDK. `sync.ts` and tests depend on this
 * interface, never on the SDK class directly, so a vendor change touches one
 * file. This is the proxy's copy of the same seam SlimFact used pre-decoupling.
 */
export interface BankingApi {
  getAccounts(): Promise<Account[]>;
  getTransactions(accountId: string, query?: TransactionQuery): Promise<TransactionPage>;
  getConnections(): Promise<Connection[]>;
  sync(accountId: string): Promise<SyncResult>;
  syncAll(): Promise<SyncAllResult>;
}

/**
 * Decodes the base64 `credentials.json` bundle and parses it. Returns null when
 * unconfigured or malformed (sync stays inert). The bundle holds the P-256
 * decryption key — treat it like a password: the warning below reports only
 * the failure reason, never any credential content.
 */
export const loadCredentials = (
  credentialsJson: string | undefined,
  log?: { error(message: string): void },
): CredentialsBundle | null => {
  if (!credentialsJson) return null;
  try {
    const decoded = Buffer.from(credentialsJson, "base64").toString("utf-8");
    return JSON.parse(decoded) as CredentialsBundle;
  } catch (error) {
    log?.error(
      `[banking-api] OPENBANKING_CREDENTIALS_JSON is set but could not be decoded/parsed — bank sync stays disabled (${(error as Error).message})`,
    );
    return null;
  }
};

/** Builds a BankingApi backed by the open-banking.io SDK. */
export const createClient = (credentials: CredentialsBundle, apiBaseUrl?: string): BankingApi => {
  const bundle = apiBaseUrl ? { ...credentials, apiBaseUrl } : credentials;
  return OpenBankingClient.fromBundle(bundle);
};
