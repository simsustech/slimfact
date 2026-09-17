import { describe, expect, it } from "vitest";
import { generateKey } from "../../src/api-keys/keys.js";
import type { ApiKeyConfig } from "../../src/config/keys.js";
import { apiKeyConfigSchema, buildKeyEntry, upsertKeyEntry } from "../../src/config/keys.js";

// zod defaults (scopes: ['read'], accounts: []) apply at parse time, so configs
// are built through the schema exactly like loadKeyConfig does.
const config = (entries: unknown[]): ApiKeyConfig => apiKeyConfigSchema.parse({ apiKeys: entries });

describe("buildKeyEntry", () => {
  it("defaults to the read scope and no grants", () => {
    const entry = buildKeyEntry({ label: "client-a", key: generateKey() });

    expect(entry.scopes).toEqual(["read"]);
    expect(entry.accounts).toEqual([]);
  });

  it("rejects a key that is not obk_(live|test)_<43 base64url chars>", () => {
    expect(() => buildKeyEntry({ label: "client-a", key: "not-a-key" })).toThrow(/obk_/);
  });

  it("rejects an unparseable expiry instead of writing one that never expires", () => {
    expect(() =>
      buildKeyEntry({ label: "client-a", key: generateKey(), expiresAt: "next tuesday" }),
    ).toThrow(/parseable/);
  });

  it("keeps a live key, its grants and a valid expiry", () => {
    const key = generateKey("live");
    const entry = buildKeyEntry({
      label: "client-a",
      key,
      scopes: ["read", "sync"],
      accounts: ["knab-acc"],
      expiresAt: "2027-01-01T00:00:00.000Z",
    });

    expect(entry).toEqual({
      label: "client-a",
      key,
      scopes: ["read", "sync"],
      accounts: ["knab-acc"],
      expiresAt: "2027-01-01T00:00:00.000Z",
    });
  });
});

describe("upsertKeyEntry", () => {
  it("appends a new label and leaves the existing entries alone", () => {
    const first = buildKeyEntry({ label: "client-a", key: generateKey(), accounts: ["a"] });
    const second = buildKeyEntry({ label: "client-b", key: generateKey(), accounts: ["b"] });

    const merged = upsertKeyEntry(config([first]), second);

    expect(merged.apiKeys.map((entry) => entry.label)).toEqual(["client-a", "client-b"]);
    expect(merged.apiKeys[0]).toEqual(first);
  });

  it("refuses a duplicate label without replace, so a retry cannot orphan a key", () => {
    const first = buildKeyEntry({ label: "client-a", key: generateKey(), accounts: ["a"] });
    const retry = buildKeyEntry({ label: "client-a", key: generateKey(), accounts: ["b"] });

    expect(() => upsertKeyEntry(config([first]), retry)).toThrow(/already in the config/);
  });

  it("replaces in place when told to, rotating only that key", () => {
    const a = buildKeyEntry({ label: "client-a", key: generateKey(), accounts: ["a"] });
    const b = buildKeyEntry({ label: "client-b", key: generateKey(), accounts: ["b"] });
    const rotated = buildKeyEntry({ label: "client-a", key: generateKey(), accounts: ["a2"] });

    const merged = upsertKeyEntry(config([a, b]), rotated, { replace: true });

    expect(merged.apiKeys.map((entry) => entry.label)).toEqual(["client-a", "client-b"]);
    expect(merged.apiKeys[0]!.key).toBe(rotated.key);
    expect(merged.apiKeys[0]!.accounts).toEqual(["a2"]);
    expect(merged.apiKeys[1]).toEqual(b);
  });
});
