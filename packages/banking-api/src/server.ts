import Fastify from "fastify";
import websocketPlugin from "@fastify/websocket";
import rateLimit from "@fastify/rate-limit";
import { fastifyTRPCPlugin } from "@trpc/server/adapters/fastify";
import { PgBoss } from "pg-boss";
import { loadCredentials, createClient } from "./banking/client.js";
import { appConfig } from "./config/env.js";
import { loadKeyConfig, reconcileKeys } from "./config/keys.js";
import { postgresConfig } from "./config/postgres.js";
import { createProxyEventBus } from "./event-bus.js";
import { db } from "./kysely/index.js";
import { initialize as initializeSyncQueue } from "./pgboss.js";
import { createAppRouter, createContext } from "./trpc/index.js";

const start = async (): Promise<void> => {
  // Fail-closed (D11): the key config file is the source of truth. A missing or
  // invalid file aborts startup instead of running with partial/zero keys.
  const keyConfig = loadKeyConfig(appConfig.bankingApiConfigPath);
  const reconcile = await reconcileKeys(db, keyConfig);
  console.log(
    `[keys] reconciled: created=${reconcile.created} updated=${reconcile.updated} ` +
      `revoked=${reconcile.revoked} unknownAccounts=${reconcile.unknownAccounts.length}`,
  );

  const app = Fastify({ logger: { level: appConfig.debug ? "debug" : "info" } });

  await app.register(rateLimit, {
    max: Number(appConfig.rateLimitPerMinute),
    timeWindow: "1 minute",
  });
  await app.register(websocketPlugin);

  app.get("/health", async () => ({ ok: true, keys: keyConfig.apiKeys.length }));

  const credentials = loadCredentials(appConfig.openbankingCredentialsJson, app.log);

  app.decorate("banking", {
    db,
    getClient: () =>
      credentials ? createClient(credentials, appConfig.openbankingApiBaseUrl) : null,
    eventBus: createProxyEventBus(db),
  });

  // The sync queue (cron + singleton worker) shares the same Postgres server.
  const boss = new PgBoss({
    connectionString: `postgres://${postgresConfig.user}:${encodeURIComponent(
      postgresConfig.password,
    )}@${postgresConfig.host}:${postgresConfig.port}/${postgresConfig.database}`,
    schema: "pgboss_banking_v11",
  });
  await boss.start();
  app.decorate("pg-boss", boss);

  // Machine API: API-key authenticated tRPC (D3/D5). All procedures go through
  // `apiKeyProcedure` (UNAUTHORIZED when the Bearer key is unknown/revoked).
  await app.register(fastifyTRPCPlugin, {
    prefix: "/trpc",
    trpcOptions: {
      router: createAppRouter(),
      createContext: createContext({ db, boss }),
    },
  });

  // Event bus (D10): tRPC WS endpoint authenticated from the handshake
  // `Authorization` header; the proxy publishes `bank.sync.*` + reauth events.
  app.get("/ws", { websocket: true }, (socket, req) => {
    app.banking.eventBus.handleWS(socket, req);
  });

  await initializeSyncQueue({ fastify: app as never, boss });

  app.addHook("onClose", async () => {
    await boss.stop();
  });

  const port = Number(process.env.PORT || "80");
  const host = process.env.HOST || "0.0.0.0";
  await app.listen({ port, host });
  console.log(`[banking-api] listening on ${host}:${port}`);
};

start().catch((error) => {
  console.error("[banking-api] startup failed:", error);
  process.exit(1);
});
