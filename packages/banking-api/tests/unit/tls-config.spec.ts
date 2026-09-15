import { afterAll, describe, expect, it, vi, type MockInstance } from "vitest";

process.env.API_HOST = process.env.API_HOST || "banking.test";
process.env.POSTGRES_HOST = process.env.POSTGRES_HOST || "localhost";
process.env.POSTGRES_PORT = process.env.POSTGRES_PORT || "5433";
process.env.POSTGRES_USER = process.env.POSTGRES_USER || "postgres";
process.env.POSTGRES_DB = process.env.POSTGRES_DB || "slimfact_unit";
process.env.POSTGRES_PASSWORD = process.env.POSTGRES_PASSWORD || "unused-in-this-spec";

// kysely/index.ts installs a BigInt.prototype.toJSON getter at import time;
// block that define (like trpc.spec.ts) so vitest's own BigInt serialization
// in this worker stays untouched. No DB connection is attempted on import.
const originalDefineProperty = Object.defineProperty;
const definePropertySpy: MockInstance = vi
  .spyOn(Object, "defineProperty")
  .mockImplementation((target, prop, desc) => {
    if (target === BigInt.prototype && prop === "toJSON") return target;
    return originalDefineProperty(target, prop, desc);
  });

const { buildSslConfig } = await import("../../src/kysely/index.js");

afterAll(() => {
  definePropertySpy.mockRestore();
});

describe("buildSslConfig (POSTGRES TLS)", () => {
  it("verifies certificates by default when SSL is enabled", () => {
    expect(buildSslConfig(true, false, undefined)).toEqual({
      rejectUnauthorized: true,
      ca: undefined,
    });
  });

  it("downgrades verification only with POSTGRES_SSL_INSECURE=true", () => {
    expect(buildSslConfig(true, true, undefined)).toEqual({
      rejectUnauthorized: false,
      ca: undefined,
    });
  });

  it("passes the CA cert through", () => {
    const config = buildSslConfig(true, false, "/path/to/ca.pem");
    expect(config).toMatchObject({ rejectUnauthorized: true, ca: "/path/to/ca.pem" });
  });

  it("disables TLS entirely when POSTGRES_SSL is unset", () => {
    expect(buildSslConfig(false, true, undefined)).toBe(false);
    expect(buildSslConfig(false, false, undefined)).toBe(false);
  });
});
