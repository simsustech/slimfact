# Staging release build failed on a missing build context

Date: 2026-09-15

## Symptom

`Release staging build` failed at `docker/build-push-action`:

```text
ERROR: failed to build: failed to solve: linked-modular-api-event-bus:
failed to resolve source metadata for
docker.io/library/linked-modular-api-event-bus:latest:
pull access denied, repository does not exist or may require authorization
```

plus a Node 20 deprecation warning from `docker/build-push-action@v6`.

## Cause

`release staging.yaml` is triggered by `workflow_run`. GitHub always executes a
`workflow_run` workflow from the workflow file as it exists on the **default
branch (main)**, while the job itself checks out `ref: staging`. main's copy of
the workflow still declared the eight pre-open-banking build contexts, so the
ninth one — `linked-modular-api-event-bus`, copied by the staging Dockerfile
(line 16) — never reached buildx. BuildKit resolves an undeclared
`COPY --from=<name>` as the image `docker.io/library/<name>:latest`, hence the
misleading registry error. The Node 20 warning came from
`docker/build-push-action@v6` (Node 20 runtime); `action-gh-release@v2` has the
same issue in `version-and-release.yaml`.

## Changes

- `.github/workflows/release staging.yaml`, `.github/workflows/release.yaml`:
  contexts moved into a workflow-level `LINKED_BUILD_CONTEXTS` env var (single
  source of truth, `build-contexts: ${{ env.LINKED_BUILD_CONTEXTS }}`), new
  `verify-build-contexts` job that both build jobs `needs:`, per-workflow
  `concurrency` groups, `persist-credentials: false` on non-pushing checkouts,
  `docker/build-push-action@v7`.
- `.github/scripts/verify-build-contexts.sh`: preflight that fails fast naming
  any Dockerfile `COPY --from=` context the workflow does not declare.
- `.github/workflows/version-and-release.yaml`: `action-gh-release@v3`.
- `.github/scripts/verify-build-contexts.test.sh`: 7 unit cases, including the
  stale-context incident.
- `.github/scripts/act-release-workflows.test.sh`: runs the preflight job of
  both workflows under act, including the stale-context failure.
- `AGENTS.md`: section on the release workflows and the `workflow_run` trap.

## Verification

- `bash .github/scripts/verify-build-contexts.test.sh` → 7 passed.
- `act --validate -W .github/workflows/` clean; `act -l` shows
  `0 verify-build-contexts → 1 build-and-push-*`.
- `bash .github/scripts/act-release-workflows.test.sh` → 3 passed (staging ok,
  staging with the stale list fails with the actionable error, production ok).
- Local repro of the original failure without the guard:
  `COPY --from=linked-x` with no matching `--build-context` → same
  `pull access denied` error; adding the context makes the build resolve.

## Still to do (not part of this change)

The fix must reach **main** for the staging build to pick it up (`workflow_run`
reads the definition from the default branch), so merge this branch into main,
not just into staging.

The `workflow_run` indirection itself can be removed by running the build as a
job inside the staging workflow (or via a `workflow_call` file), which would make
definitions branch-local — proposed, not implemented.
