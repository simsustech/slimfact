import { describe, expect, it } from "vitest";

// env.ts requires API_HOST at import time; set it before the dynamic import
// (static imports would hoist above this assignment).
process.env.API_HOST = process.env.API_HOST || "banking.test";

const { isExpiredConsent, isRateLimited } = await import("../../src/banking/sync.js");

describe("sync error classification", () => {
  describe("isRateLimited", () => {
    it("detects a typed status property", () => {
      expect(isRateLimited(Object.assign(new Error("Too Many Requests"), { status: 429 }))).toBe(
        true,
      );
    });

    it("detects a typed statusCode property", () => {
      expect(isRateLimited({ statusCode: 429, message: "rate limited" })).toBe(true);
    });

    it("falls back to the message when no typed status exists", () => {
      expect(isRateLimited(new Error("GET /accounts failed: 429"))).toBe(true);
      expect(isRateLimited("GET /accounts failed: 429")).toBe(true);
    });

    it("does not match unrelated statuses or substrings like ids containing 429", () => {
      expect(isRateLimited({ status: 500 })).toBe(false);
      // Typed status wins over a misleading message.
      expect(isRateLimited({ status: 200, message: "failed: 429" })).toBe(false);
      expect(isRateLimited(new Error("payment id pay-4290 settled"))).toBe(false);
    });
  });

  describe("isExpiredConsent", () => {
    it("detects typed auth/client-error statuses", () => {
      expect(isExpiredConsent({ status: 401 })).toBe(true);
      expect(isExpiredConsent({ statusCode: 403 })).toBe(true);
      expect(isExpiredConsent({ status: 400 })).toBe(true);
    });

    it("keeps the message fallback for SDK errors without typed status", () => {
      expect(isExpiredConsent(new Error("GET /sessions failed: 403"))).toBe(true);
      expect(isExpiredConsent(new Error("no active session for this user"))).toBe(true);
    });

    it("rejects other errors", () => {
      expect(isExpiredConsent({ status: 429 })).toBe(false);
      expect(isExpiredConsent(new Error("ECONNRESET"))).toBe(false);
    });
  });
});
