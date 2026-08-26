import { describe, expect, it } from "vitest";
import {
  generateKey,
  hashKey,
  isValidKey,
  isValidKeyFormat,
  keyPrefix,
} from "../../src/api-keys/keys.js";

describe("api keys", () => {
  it("generates keys matching obk_<env>_<43 base64url chars>", () => {
    const key = generateKey("test");
    expect(key).toMatch(/^obk_test_[A-Za-z0-9_-]{43}$/);
    expect(isValidKeyFormat(key)).toBe(true);
    expect(isValidKeyFormat(generateKey("live"))).toBe(true);
    expect(isValidKeyFormat("obk_prod_abc")).toBe(false);
    expect(isValidKeyFormat("not-a-key")).toBe(false);
    expect(isValidKeyFormat("")).toBe(false);
  });

  it("contains 256 bits of entropy (32 random bytes, unpadded base64url)", () => {
    const key = generateKey();
    const entropyPart = key.split("_").slice(2).join("_");
    expect(entropyPart).toHaveLength(43);
    expect(key).not.toBe(generateKey());
  });

  it("hashes stably to a 64-char hex digest", () => {
    const key = generateKey();
    const hash = hashKey(key);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hashKey(key)).toBe(hash);
    expect(hashKey(generateKey())).not.toBe(hash);
  });

  it("exposes a short displayable prefix", () => {
    const key = generateKey();
    expect(keyPrefix(key)).toBe(key.slice(0, 12));
  });

  it("validates revoked and expired keys", () => {
    const now = Date.now();
    const past = new Date(now - 1000);
    const future = new Date(now + 1000);
    expect(isValidKey({ revokedAt: null, expiresAt: null })).toBe(true);
    expect(isValidKey({ revokedAt: past, expiresAt: null })).toBe(false);
    expect(isValidKey({ revokedAt: null, expiresAt: past })).toBe(false);
    expect(isValidKey({ revokedAt: null, expiresAt: future })).toBe(true);
  });
});
