---
name: slimfact-docker
description: Docker development and test workflow conventions for SlimFact. Use when building, running, or debugging Docker containers.
---

# Docker

## When to Use

Apply these conventions when:
- Building or rebuilding Docker images
- Running the test Docker stack
- Developing with locally-linked packages in Docker
- Cleaning up Docker state between test runs

## Rules

- **Never tear down a stack you did not start yourself**: `down`, `down --volumes`, `stop`, `kill`, and `rm` destroy state for *everyone* using that compose project — including a parallel agent or the human's own session. Only tear down a stack this session started. If a stack you did not start is already running, leave it up and ask the user first. This holds across compose projects too: never `docker compose down` on another project to free a port or a name, and never `docker stop`/`docker rm` a container you did not create.
- **Scope every compose command with `-f`**: A bare `docker compose down` in the repo root targets `docker-compose.yaml` and can take down a stack another process is using. Always pass the exact file (`-f docker-compose.test.yaml`).
- **Avoid `--build`**: When using `docker compose up`, avoid `--build` (it can use stale cache). Instead, precede with `docker compose -f [file] build --no-cache` and run the up command without `--build`.
- **Clean volumes before tests**: Before every new test run, always run `docker compose -f docker-compose.test.yaml down --volumes` to ensure a clean database state with no stale seed data — subject to the first rule: this is for a stack you started.
- **Multiple named additional_contexts**: For multiple local packages in Docker builds, use separate named `additional_contexts` per package (e.g., `linked-quasar-components`, `linked-vitrify`) rather than a single context pointing to a directory of symlinked packages. Each context is referenced individually in the Dockerfile via `COPY --from=linked-<name>`.
- **linked- prefix convention**: For local package Docker contexts, use the `linked-` prefix naming convention (e.g., `linked-quasar-components`, `linked-vitrify`) to distinguish linked-package contexts from other context types.
- **/build/local-packages/ base path**: In the Dockerfile, use `/build/local-packages/` as the base path for local package overlays — not `/build/local-packages/linked/`. The "linked" qualifier is redundant since local packages in Docker are always linked.
- **Coexist with a proxy that owns 80/443**: A sibling project's caddy (e.g. petboarding's) may already hold the shared `web` network's host ports. Set `TEST_CADDY_HTTP_PORT=8080 TEST_CADDY_HTTPS_PORT=8443` instead of stopping the other stack.

## Verification

- Docker rebuilds use `build --no-cache` + `up` (not `up --build`)
- Test runs start with `down --volumes` for a clean DB — only for a stack this session started
- No stack the session did not start was stopped or removed; `docker compose ls` state matches how the session found it
- Linked package contexts use the `linked-` prefix naming convention
