#!/usr/bin/env bash
#
# Regression tests for .github/scripts/verify-build-contexts.sh.
#
# Encodes the 2026-09-15 staging release failure: the workflow_run definition
# (run from the default branch, main) declared 8 build contexts while the
# checked out staging Dockerfile copied from a 9th one
# (linked-modular-api-event-bus). BuildKit resolves an undeclared --from name as
# the image docker.io/library/<name>:latest, so the build died with
# "pull access denied" instead of a build-config error.
#
# Usage: bash .github/scripts/verify-build-contexts.test.sh

set -uo pipefail

root=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
script="$root/.github/scripts/verify-build-contexts.sh"
workflow=${WORKFLOW:-$root/.github/workflows/release staging.yaml}

failures=0
passed=0

extract_contexts() {
  awk '/^  LINKED_BUILD_CONTEXTS: \|/{ found = 1; next }
       found && /^    /{ sub(/^    /, ""); print; next }
       found{ exit }' "$1"
}

# run_case <description> <expected-rc> <dockerfile> <contexts> [expected-substring]
run_case() {
  local desc=$1 want_rc=$2 dockerfile=$3 contexts=$4 want_text=${5:-}
  local out rc
  out=$(cd "$root" && DOCKERFILE="$dockerfile" LINKED_BUILD_CONTEXTS="$contexts" bash "$script" 2>&1)
  rc=$?

  if [[ $rc -ne $want_rc ]]; then
    printf 'FAIL %s\n     expected exit %s, got %s\n%s\n' "$desc" "$want_rc" "$rc" "$out"
    failures=$((failures + 1))
    return
  fi
  if [[ -n $want_text && $out != *"$want_text"* ]]; then
    printf 'FAIL %s\n     expected output to contain: %s\n%s\n' "$desc" "$want_text" "$out"
    failures=$((failures + 1))
    return
  fi
  printf 'ok   %s\n' "$desc"
  passed=$((passed + 1))
}

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

git -C "$root" show main:Dockerfile >"$tmp/Dockerfile.main" 2>/dev/null ||
  { echo "skip: cannot read main:Dockerfile"; exit 0; }

contexts=$(extract_contexts "$workflow")
[[ -n $contexts ]] || { echo "FAIL cannot extract LINKED_BUILD_CONTEXTS from $workflow"; exit 1; }

stale_contexts=$(printf '%s\n' "$contexts" | grep -v 'linked-modular-api-event-bus' || true)

ok_text='OK: every Dockerfile COPY --from name is a declared build context'

echo 'current Dockerfile + current workflow list'
run_case 'all copied contexts are declared' 0 "$root/Dockerfile" "$contexts" "$ok_text"

echo
echo 'the incident: staging Dockerfile vs the stale (main) context list'
run_case 'undeclared context fails fast and names it' 1 "$root/Dockerfile" "$stale_contexts" 'linked-modular-api-event-bus=.docker/empty'

echo
echo 'other cases'
run_case 'a Dockerfile that only copies from stages passes' 0 "$tmp/Dockerfile.main" "$contexts" "$ok_text"

printf 'FROM node:lts-slim AS build\nCOPY --from=linked-new-pkg ./ /x/\n' >"$tmp/Dockerfile.new"
run_case 'new overlay without a declared context fails' 1 "$tmp/Dockerfile.new" "$contexts" 'linked-new-pkg=.docker/empty'

printf 'FROM node:lts-slim AS build\nCOPY --from=build /a /b\n' >"$tmp/Dockerfile.stages"
run_case 'build stages are not treated as contexts' 0 "$tmp/Dockerfile.stages" ''

printf 'FROM node:lts-slim AS build\n' >"$tmp/Dockerfile.empty"
run_case 'empty context list is accepted when nothing is copied' 0 "$tmp/Dockerfile.empty" ''

run_case 'missing Dockerfile fails' 1 "$tmp/does-not-exist" "$contexts"

printf '\n%s passed, %s failed\n' "$passed" "$failures"
(( failures == 0 ))
