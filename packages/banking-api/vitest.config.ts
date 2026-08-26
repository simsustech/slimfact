import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Pure-TS unit tests; no E2E specs live here (those run in packages/api).
    include: ["tests/unit/**/*.spec.ts"],
    globals: true,
    environment: "happy-dom",
    // DB-backed specs (keys-config, trpc) share the banking test DB — run files
    // sequentially so their beforeEach cleanup can't clobber each other.
    fileParallelism: false,
  },
});
