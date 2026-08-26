import { createEventBusClient } from "@modular-api/event-bus/client";
import type { EventMessage } from "@modular-api/event-bus";
import { createTRPCClient, createWSClient, wsLink } from "@trpc/client";
import websocket from "@fastify/websocket";
import Fastify, { type FastifyInstance } from "fastify";
import type { Kysely } from "kysely";
import type { AddressInfo } from "node:net";
import WebSocket from "ws";
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
import { generateKey } from "../../src/api-keys/keys.js";
import { apiKeyConfigSchema } from "../../src/config/keys.js";
import type { DB } from "../../src/kysely/types.js";

const dbAvailable = !!process.env.POSTGRES_PASSWORD;

const setRequiredEnv = () => {
  process.env.POSTGRES_HOST = process.env.POSTGRES_HOST || "localhost";
  process.env.POSTGRES_PORT = process.env.POSTGRES_PORT || "5433";
  process.env.POSTGRES_USER = process.env.POSTGRES_USER || "postgres";
  process.env.POSTGRES_DB = process.env.POSTGRES_DB || "banking";
};

let originalDefineProperty: typeof Object.defineProperty;
let definePropertySpy: MockInstance;

describe.skipIf(!dbAvailable)("event-bus API-key auth", () => {
  const envBackup = { ...process.env };
  let app: FastifyInstance;
  let server: ReturnType<(typeof import("../../src/event-bus.js"))["createProxyEventBus"]>;
  let db: Kysely<DB>;
  let port: number;
  let key: string;

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
        ): unknown => {
          if (target === BigInt.prototype && prop === "toJSON") return target;
          return originalDefineProperty.call(
            Object,
            target as object,
            prop as PropertyKey,
            descriptor as PropertyDescriptor,
          );
        },
      );

    db = (await import("../../src/kysely/index.js")).db as Kysely<DB>;
    const keys = await import("../../src/config/keys.js");
    key = generateKey();
    await keys.reconcileKeys(
      db,
      apiKeyConfigSchema.parse({ apiKeys: [{ label: "bus-test", key }] }),
    );

    const { createProxyEventBus } = await import("../../src/event-bus.js");
    server = createProxyEventBus(db);

    app = Fastify();
    await app.register(websocket);
    app.get("/ws", { websocket: true }, (socket, req) => {
      server.handleWS(socket, req);
    });
    await app.listen({ port: 0 });
    port = (app.server.address() as AddressInfo).port;
  });

  afterAll(async () => {
    await app?.close();
    await db?.destroy();
    definePropertySpy?.mockRestore();
    Object.defineProperty = originalDefineProperty;
    process.env = { ...envBackup };
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("authenticates a valid key from the handshake header and streams events", async () => {
    const bus = createEventBusClient({
      url: `http://localhost:${port}`,
      transport: "node",
      wsHeaders: { authorization: `Bearer ${key}` },
    });
    const received: EventMessage[] = [];
    bus.subscribe("bank.sync.*", (message) => received.push(message));

    await vi.waitFor(() => {
      expect(server.connectionCount).toBeGreaterThan(0);
    });
    await new Promise((resolve) => setTimeout(resolve, 200));

    server.bus.publish("bank.sync.finished", {
      runId: "r1",
      status: "finished",
      accountsSynced: 1,
      accountsSkippedReauth: 0,
      newTransactions: 2,
    });

    await vi.waitFor(() => {
      expect(received).toHaveLength(1);
    });
    expect(received[0]!.data).toMatchObject({ runId: "r1", status: "finished" });
    await bus.close();
  });

  it("rejects a bad key — the socket is closed", async () => {
    const closed: unknown[] = [];
    const wsClient = createWSClient({
      url: `ws://localhost:${port}/ws`,
      WebSocket: class WebSocketWithHeaders extends WebSocket {
        constructor(wsUrl: string) {
          super(wsUrl, { headers: { authorization: "Bearer definitely-not-a-key" } });
        }
      } as unknown as typeof globalThis.WebSocket,
      onClose: (cause) => closed.push(cause),
    });
    const client = createTRPCClient<
      ReturnType<(typeof import("../../src/event-bus.js"))["createProxyEventBus"]>["router"]
    >({
      links: [wsLink({ client: wsClient })],
    });
    client.subscribe.subscribe("bank.sync.*", { onData: () => {} });

    await vi.waitFor(
      () => {
        expect(closed.length).toBeGreaterThan(0);
      },
      { timeout: 5000 },
    );
    await wsClient.close();
  });
});
