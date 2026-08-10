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

- **Avoid `--build`**: When using `docker compose up`, avoid `--build` (it can use stale cache). Instead, precede with `docker compose -f [file] build --no-cache` and run the up command without `--build`.
- **Clean volumes before tests**: Before every new test run, always run `docker compose -f docker-compose.test.yaml down --volumes` to ensure a clean database state with no stale seed data.
- **Multiple named additional_contexts**: For multiple local packages in Docker builds, use separate named `additional_contexts` per package (e.g., `linked-quasar-components`, `linked-vitrify`) rather than a single context pointing to a directory of symlinked packages. Each context is referenced individually in the Dockerfile via `COPY --from=linked-<name>`.
- **linked- prefix convention**: For local package Docker contexts, use the `linked-` prefix naming convention (e.g., `linked-quasar-components`, `linked-vitrify`) to distinguish linked-package contexts from other context types.
- **/build/local-packages/ base path**: In the Dockerfile, use `/build/local-packages/` as the base path for local package overlays — not `/build/local-packages/linked/`. The "linked" qualifier is redundant since local packages in Docker are always linked.

## Verification

- Docker rebuilds use `build --no-cache` + `up` (not `up --build`)
- Test runs start with `down --volumes` for a clean DB
- Linked package contexts use the `linked-` prefix naming convention
