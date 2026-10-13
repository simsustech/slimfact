import { isAbsolute, resolve } from 'node:path'

/** Opt-out flag for a run that should not manage the docker test stack. */
export const E2E_OWN_STACK_ENV = 'E2E_OWN_STACK'

const E2E_COMPOSE_FILES_ENV = 'E2E_COMPOSE_FILES'

/**
 * Repo root: an explicit override, else four levels up from this file
 * (packages/api/tests/e2e).
 */
function repoRoot(env: NodeJS.ProcessEnv): string {
  return env.SLIMFACT_ROOT || resolve(import.meta.dirname, '../../../..')
}

/**
 * Whether this run owns the docker test stack.
 *
 * The default is to own it (down → build → up). A run against an already
 * running stack — a wrapper, a manual exploration session — sets
 * `E2E_OWN_STACK=0` so the global setup leaves the stack alone. The auth
 * capture still runs either way.
 */
export function shouldOwnStack(env: NodeJS.ProcessEnv): boolean {
  return env[E2E_OWN_STACK_ENV] !== '0'
}

/**
 * Compose files for the test stack: the base file first, then any
 * `E2E_COMPOSE_FILES` overlays (colon- or comma-separated), each resolved
 * against the repo root so callers can pass them straight to `docker compose
 * -f`. This is how a run adds the Mollie/Stripe PSP overlays without a
 * bespoke config.
 */
export function composeFiles(env: NodeJS.ProcessEnv): string[] {
  const root = repoRoot(env)
  const overlays = (env[E2E_COMPOSE_FILES_ENV] ?? '')
    .split(/[:,]/)
    .map((file) => file.trim())
    .filter(Boolean)
    .map((file) => (isAbsolute(file) ? file : resolve(root, file)))

  return [resolve(root, 'docker-compose.test.yaml'), ...overlays]
}
