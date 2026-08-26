import type { EventBus } from "@modular-api/event-bus";
import type { FastifyInstance } from "fastify";
import type { Kysely } from "kysely";
import type { BankingApi } from "./banking/client.js";
import type { BankEventSchemas } from "./events.js";
import type { DB } from "./kysely/types.js";

declare module "fastify" {
  interface FastifyInstance {
    banking: {
      db: Kysely<DB>;
      getClient: () => BankingApi | null;
      eventBus: ReturnType<(typeof import("./event-bus.js"))["createProxyEventBus"]> & {
        bus: EventBus<BankEventSchemas>;
      };
    };
  }
}

export type { FastifyInstance };
