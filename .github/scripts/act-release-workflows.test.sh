#!/usr/bin/env bash
#
# Local end-to-end test of the release workflows' `verify-build-contexts` job
# with act (https://github.com/nektos/act).
#
# Why the workflow is rewritten for this run: `release staging.yaml` and
# `release.yaml` check out an explicit branch (`ref: staging` / `ref: main`).
# act only replaces actions/checkout with "copy the local tree into the
# container" when it recognizes a local checkout, and actions/checkout@v6
# demands a token for a private repository — so act would abort in the checkout
# step before reaching the job under test. The copy generated here drops the
# checkout `with:` blocks and changes nothing else, which lets act seed the
# workspace from the local tree, exactly as GitHub does with the checkout in
# place.
#
# Cases:
#   1. staging workflow, LINKED_BUILD_CONTEXTS as committed  -> job passes
#   2. staging workflow, event-bus context removed           -> job fails with the
#      actionable error (this is the 2026-09-15 production incident: the stale
#      default-branch copy of the workflow declared 8 contexts while the staging
#      Dockerfile copied from 9)
#   3. production workflow, LINKED_BUILD_CONTEXTS as committed -> job passes
#
# Usage: bash .github/scripts/act-release-workflows.test.sh
# Requires: act, docker, and a cached human-readable act runner image
# (default catthehacker/ubuntu:act-latest, override with ACT_RUNNER_IMAGE=...).

set -uo pipefail

root=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
staging_workflow="$root/.github/workflows/release staging.yaml"
production_workflow="$root/.github/workflows/release.yaml"
runner_image=${ACT_RUNNER_IMAGE:-catthehacker/ubuntu:act-latest}

command -v act >/dev/null || {
  echo 'skip: act is not installed'
  exit 0
}
command -v docker >/dev/null || {
  echo 'skip: docker is not installed'
  exit 0
}

tmp=$(mktemp -d)
cleanup() { rm -rf "$tmp"; }
trap cleanup EXIT

failures=0
passed=0

extract_contexts() {
  awk '/^  LINKED_BUILD_CONTEXTS: \|/{ found = 1; next }
       found && /^    /{ sub(/^    /, ""); print; next }
       found{ exit }' "$1"
}

# Copies a workflow, dropping checkout `with:` blocks (the only blocks that
# carry a `ref:`) and optionally replacing the LINKED_BUILD_CONTEXTS payload.
make_wrapper() {
  local src=$1 out=$2 contexts=$3
  python3 - "$src" "$out" "$contexts" <<'PY'
import re, sys

src, out, contexts = sys.argv[1], sys.argv[2], sys.argv[3]
lines = open(src, encoding="utf-8").read().splitlines(keepends=True)
result, i = [], 0
while i < len(lines):
    if lines[i].rstrip("\n") == "        with:":
        base = len(lines[i]) - len(lines[i].lstrip())
        block, j = [], i + 1
        while j < len(lines) and lines[j].strip() and len(lines[j]) - len(lines[j].lstrip()) > base:
            block.append(lines[j])
            j += 1
        if any("ref:" in line for line in block):
            i = j
            continue
    result.append(lines[i])
    i += 1

text = "".join(result)
text = re.sub(
    r"(  LINKED_BUILD_CONTEXTS: \|\n)(?:    [^\n]*\n)*",
    lambda m: m.group(1) + "".join(f"    {line}\n" for line in contexts.splitlines() if line.strip()),
    text,
)
open(out, "w", encoding="utf-8").write(text)
PY
}

make_event() {
  local out=$1 name=$2 ref=$3 branch=$4 ref_key=$5
  python3 - "$out" "$name" "$ref" "$branch" "$ref_key" <<'PY'
import json, sys

out, name, ref, branch, ref_key = sys.argv[1:6]
payload = {
    ref_key: ref,
    "repository": {
        "id": 1,
        "name": "slimfact",
        "full_name": "simsustech/slimfact",
        "owner": {"login": "simsustech"},
        "default_branch": "main",
    },
    "sender": {"login": "stefan"},
}
if name == "workflow_run":
    payload["action"] = "completed"
    payload["workflow_run"] = {
        "id": 123456789,
        "name": "Test staging build",
        "head_branch": branch,
        "head_sha": "f1837c4f0000000000000000000000000000000",
        "event": "push",
        "status": "completed",
        "conclusion": "success",
        "repository": payload["repository"],
        "pull_requests": [],
    }
    payload["ref"] = f"refs/heads/{branch}"
json.dump(payload, open(out, "w"), indent=2)
PY
}

run_case() {
  local desc=$1 wrapper=$2 event=$3 event_name=$4 want_rc=$5 want_text=$6
  local log="$tmp/act.log" rc
  echo "--- $desc"
  (cd "$root" && act "$event_name" -W "$wrapper" -e "$event" -j verify-build-contexts \
    --action-offline-mode -P "ubuntu-latest=$runner_image") >"$log" 2>&1
  rc=$?

  if [[ $rc -ne $want_rc ]]; then
    printf 'FAIL %s\n     act exited %s, expected %s\n' "$desc" "$rc" "$want_rc"
    grep -E 'error|Error|❌|🏁' "$log" | tail -10
    failures=$((failures + 1))
    return
  fi
  if [[ -n $want_text ]] && ! grep -qF "$want_text" "$log"; then
    printf 'FAIL %s\n     expected output to contain: %s\n' "$desc" "$want_text"
    grep -E 'error|❌|🏁|OK:' "$log" | tail -10
    failures=$((failures + 1))
    return
  fi
  printf 'ok   %s\n' "$desc"
  passed=$((passed + 1))
}

ok_text='OK: every Dockerfile COPY --from name is a declared build context'
contexts=$(extract_contexts "$staging_workflow")
stale_contexts=$(printf '%s\n' "$contexts" | grep -v 'linked-modular-api-event-bus' || true)

make_wrapper "$staging_workflow" "$tmp/staging.yaml" "$contexts"
make_wrapper "$staging_workflow" "$tmp/staging-stale.yaml" "$stale_contexts"
make_wrapper "$production_workflow" "$tmp/production.yaml" "$contexts"

make_event "$tmp/workflow-run.json" workflow_run "refs/heads/staging" staging ref
make_event "$tmp/workflow-dispatch.json" workflow_dispatch "refs/tags/v9.9.9" main ref

run_case 'staging workflow, committed build contexts' \
  "$tmp/staging.yaml" "$tmp/workflow-run.json" workflow_run 0 \
  "$ok_text"

run_case 'staging workflow, stale default-branch context list (incident)' \
  "$tmp/staging-stale.yaml" "$tmp/workflow-run.json" workflow_run 1 \
  'does not declare: linked-modular-api-event-bus'

run_case 'production workflow, committed build contexts' \
  "$tmp/production.yaml" "$tmp/workflow-dispatch.json" workflow_dispatch 0 \
  "$ok_text"

printf '\n%s passed, %s failed\n' "$passed" "$failures"
((failures == 0))
