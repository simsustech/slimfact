import type { Kysely } from "kysely";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type MockInstance,
} from "vitest";
import {
  connectionUsable,
  keepConnectionIds,
  pruneConnections,
  type StoredConnection,
} from "../../src/banking/connections.js";
import type { DB } from "../../src/kysely/types.js";

const dbAvailable = !!process.env.POSTGRES_PASSWORD;

const setRequiredEnv = () => {
  process.env.POSTGRES_HOST = process.env.POSTGRES_HOST || "localhost";
  process.env.POSTGRES_PORT = process.env.POSTGRES_PORT || "5433";
  process.env.POSTGRES_USER = process.env.POSTGRES_USER || "postgres";
  process.env.POSTGRES_DB = process.env.POSTGRES_DB || "slimfact_unit";
};

const FUTURE = "2030-01-01T00:00:00.000Z";
const PAST = "2020-01-01T00:00:00.000Z";
const NOW = new Date("2026-06-01T00:00:00.000Z");

const storedConnection = (over: Partial<StoredConnection> & { id: number }): StoredConnection => ({
  aspspName: "Knab",
  aspspCountry: "NL",
  status: "Active",
  validUntil: FUTURE,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  ...over,
});

describe("connectionUsable", () => {
  it("is true for an Active connection whose consent has not lapsed", () => {
    expect(connectionUsable({ status: "Active", validUntil: FUTURE }, NOW)).toBe(true);
  });

  it("treats the exact expiry moment as still usable", () => {
    expect(connectionUsable({ status: "Active", validUntil: NOW.toISOString() }, NOW)).toBe(true);
  });

  it("is false once the consent window has passed", () => {
    expect(connectionUsable({ status: "Active", validUntil: PAST }, NOW)).toBe(false);
  });

  it("is false for any non-Active status, however far the expiry is", () => {
    expect(connectionUsable({ status: "Revoked", validUntil: FUTURE }, NOW)).toBe(false);
  });

  it("is true for an Active connection without an expiry", () => {
    expect(connectionUsable({ status: "Active", validUntil: null }, NOW)).toBe(true);
  });
});

describe("keepConnectionIds", () => {
  it("keeps only the new session after a reconnect", () => {
    const keep = keepConnectionIds(
      [
        storedConnection({ id: 1, status: "Revoked", validUntil: PAST }),
        storedConnection({ id: 2, createdAt: new Date("2026-05-01T00:00:00.000Z") }),
      ],
      NOW,
    );

    expect([...keep]).toEqual([2]);
  });

  it("keeps the newest when an old session still claims to be Active", () => {
    const keep = keepConnectionIds(
      [
        storedConnection({ id: 1, createdAt: new Date("2026-01-01T00:00:00.000Z") }),
        storedConnection({ id: 2, createdAt: new Date("2026-05-01T00:00:00.000Z") }),
      ],
      NOW,
    );

    expect([...keep]).toEqual([2]);
  });

  it("keeps the working session next to a newer one that is not usable yet", () => {
    const keep = keepConnectionIds(
      [
        storedConnection({ id: 1, createdAt: new Date("2026-01-01T00:00:00.000Z") }),
        storedConnection({
          id: 2,
          status: "Pending",
          createdAt: new Date("2026-05-01T00:00:00.000Z"),
        }),
      ],
      NOW,
    );

    expect([...keep].sort()).toEqual([1, 2]);
  });

  it("groups per ASPSP, so other banks are untouched", () => {
    const keep = keepConnectionIds(
      [
        storedConnection({ id: 1, status: "Revoked", validUntil: PAST }),
        storedConnection({ id: 2, createdAt: new Date("2026-05-01T00:00:00.000Z") }),
        storedConnection({
          id: 3,
          aspspName: "Rabobank",
          createdAt: new Date("2026-02-01T00:00:00.000Z"),
        }),
        storedConnection({
          id: 4,
          aspspName: "Rabobank",
          status: "Revoked",
          validUntil: PAST,
          createdAt: new Date("2026-03-01T00:00:00.000Z"),
        }),
        // Same name, different country: a different ASPSP group.
        storedConnection({ id: 5, aspspCountry: "BE", status: "Revoked", validUntil: PAST }),
      ],
      NOW,
    );

    // Knab NL keeps only its newest session (1 is superseded); Rabobank keeps its
    // newest row as the reauth breadcrumb *and* the older session that still
    // works; the lone Knab BE row is its own group and survives.
    expect([...keep].sort()).toEqual([2, 3, 4, 5]);
  });

  it("always keeps a lone connection, usable or not", () => {
    expect([...keepConnectionIds([storedConnection({ id: 7, status: "Revoked" })], NOW)]).toEqual([
      7,
    ]);
  });
});

describe.skipIf(!dbAvailable)("pruneConnections", () => {
  const envBackup = { ...process.env };
  let db: Kysely<DB>;
  let originalDefineProperty: typeof Object.defineProperty;
  let definePropertySpy: MockInstance;

  beforeAll(async () => {
    setRequiredEnv();
    originalDefineProperty = Object.defineProperty;
    definePropertySpy = vi
      .spyOn(Object, "defineProperty")
      .mockImplementation(
        (
          target: unknown,
          prop: PropertyKey,
          descriptor?: PropertyDescriptor & ThisType<unknown>,
        ) =>
          target === BigInt.prototype && prop === "toJSON"
            ? target
            : originalDefineProperty.call(
                Object,
                target as object,
                prop as PropertyKey,
                descriptor as PropertyDescriptor,
              ),
      );

    db = (await import("../../src/kysely/index.js")).db as Kysely<DB>;
  });

  afterAll(async () => {
    await db?.destroy();
    definePropertySpy?.mockRestore();
    Object.defineProperty = originalDefineProperty;
    process.env = { ...envBackup };
  });

  beforeEach(async () => {
    await db.deleteFrom("connections").execute();
    await db.deleteFrom("transactions").execute();
    await db.deleteFrom("accounts").execute();
  });

  const seedConnections = async () => {
    await db
      .insertInto("connections")
      .values([
        {
          externalId: "session-old",
          aspspName: "Knab",
          aspspCountry: "NL",
          status: "Revoked",
          validUntil: PAST,
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
        },
        {
          externalId: "session-new",
          aspspName: "Knab",
          aspspCountry: "NL",
          status: "Active",
          validUntil: FUTURE,
          createdAt: new Date("2026-05-01T00:00:00.000Z"),
        },
        {
          externalId: "session-rabobank",
          aspspName: "Rabobank",
          aspspCountry: "NL",
          status: "Active",
          validUntil: FUTURE,
          createdAt: new Date("2026-02-01T00:00:00.000Z"),
        },
      ])
      .execute();
  };

  it("deletes the superseded session and leaves bank data untouched", async () => {
    await seedConnections();
    const account = await db
      .insertInto("accounts")
      .values({
        externalId: "acc-1",
        aspspName: "Knab",
        aspspCountry: "NL",
        currency: "EUR",
      })
      .returning("id")
      .executeTakeFirstOrThrow();
    await db
      .insertInto("transactions")
      .values({
        accountId: account.id,
        externalId: "trx-1",
        currency: "EUR",
        creditDebit: "CRDT",
        bookingDate: "2026-05-02",
        amountCents: 4200,
      })
      .execute();

    const result = await pruneConnections(db);

    expect(result).toEqual({ scanned: 3, deleted: 1 });
    const remaining = await db
      .selectFrom("connections")
      .select("externalId")
      .orderBy("externalId")
      .execute();
    expect(remaining.map((row) => row.externalId)).toEqual(["session-new", "session-rabobank"]);
    // Connections are only a cache: nothing cascades out of them.
    expect(await db.selectFrom("accounts").select("id").execute()).toHaveLength(1);
    expect(await db.selectFrom("transactions").select("id").execute()).toHaveLength(1);
  });

  it("is idempotent and reports nothing to do once clean", async () => {
    await seedConnections();
    expect((await pruneConnections(db)).deleted).toBe(1);
    expect((await pruneConnections(db)).deleted).toBe(0);
  });

  it("keeps a bank that still needs a reconnect visible", async () => {
    await db
      .insertInto("connections")
      .values([
        {
          externalId: "session-expired",
          aspspName: "Knab",
          aspspCountry: "NL",
          status: "Expired",
          validUntil: PAST,
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
        },
      ])
      .execute();

    expect((await pruneConnections(db)).deleted).toBe(0);
  });
});
