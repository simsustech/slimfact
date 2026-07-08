# Changes: SlimFact infrastructure improvements (2026-06-23)

## New files
| File | Description |
|------|-------------|
| `PLAN.md` | Improvement plan document |
| `packages/api/src/config/index.ts` | `read()`, `required()` helpers with VITE_ prefix fallback |
| `packages/api/src/config/env.ts` | Centralized app env config with defaults |
| `packages/api/src/config/postgres.ts` | Centralized postgres env config with defaults |
| `packages/api/src/env.ts` | Backward-compatible re-export of config |
| `packages/api/src/routes/health.ts` | Unauthenticated GET /health with DB + pg-boss checks |

## Modified files
| File | Lines | Description |
|------|-------|-------------|
| `packages/api/src/setup.ts` | ~50 | Refactored to use centralized config instead of ad-hoc `env.read()`. Added `@fastify/rate-limit` registration. Added health route registration. Fixed hardcoded `client_secret: 'secret'` to use config. |
| `packages/api/src/kysely/index.ts` | ~15 | Refactored to use `postgresConfig` from config layer. |
| `packages/api/src/pgboss.ts` | +5 | Added `getBossOrThrow()` export for health check. |
| `packages/api/package.json` | +1 | Added `@fastify/rate-limit` dependency. |
| `Dockerfile` | +15 | Added DEBUG build arg, BuildKit `COPY --from=linked-*` for local packages, build/link loop. |
| `.env.example` | ~30 | Expanded with all documented env vars including `OIDC_CLIENT_SECRET`. |

## Removed files
| File | Description |
|------|-------------|
- `plans/` (entire dir) | Petboarding-specific improvement plans |
- `changes/*petboarding*` | 10 petboarding-specific change files |

## Notes
- Defaults for env vars are set in `config/env.ts` and `config/postgres.ts`, not in consuming code
- Rate limit default: 1,000,000 requests/minute per IP (configurable via `RATE_LIMIT_PER_MINUTE`)
- Health endpoint returns 200 with `{ status: 'ok', db: 'connected', pgboss: 'connected', timestamp }` or 503 on failure
- OIDC client secret now reads from `OIDC_CLIENT_SECRET` env var (defaults to 'secret' for backward compat)
