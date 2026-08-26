import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // Unit tests are pure-TS and framework-agnostic. Playwright specs live in
    // tests/e2e and are run separately via `pnpm run test:e2e`.
    include: ['tests/unit/**/*.spec.ts'],
    globals: true,
    environment: 'happy-dom',
    // DB-backed banking specs (sync, apply) share the test database — run
    // files sequentially so their beforeEach cleanup can't clobber each other.
    fileParallelism: false
  }
})
