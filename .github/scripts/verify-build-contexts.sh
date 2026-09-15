#!/usr/bin/env bash
#
# Preflight for the Docker release builds (.github/workflows/release*.yaml).
#
# Fails when ./Dockerfile copies from a build context that the running workflow
# does not declare in LINKED_BUILD_CONTEXTS.
#
# BuildKit silently treats an undeclared `COPY --from=<name>` as an image
# reference, so a drifted context list surfaces as
#
#   pull access denied ... docker.io/library/<name>:latest
#
# instead of a build-config error. That misdiagnosis is likely in these two
# workflows specifically, because `workflow_run` always executes the copy of
# `release staging.yaml` from the default branch (main) while the job checks out
# staging — the Dockerfile and the context list come from different refs.
#
# Inputs: LINKED_BUILD_CONTEXTS  newline separated `name=path` list (workflow env)
#         DOCKERFILE             path to the Dockerfile (default: Dockerfile)
#
# Usage:  bash .github/scripts/verify-build-contexts.sh
#
# Locally (no yaml parser needed):
#   context=$(awk '/^  LINKED_BUILD_CONTEXTS: \|/{ f = 1; next }
#                  f && /^    /{ sub(/^    /, ""); print; next } f{ exit }' \
#                 '.github/workflows/release staging.yaml')
#   LINKED_BUILD_CONTEXTS="$context" bash .github/scripts/verify-build-contexts.sh

set -euo pipefail

dockerfile=${DOCKERFILE:-Dockerfile}
if [[ ! -f $dockerfile ]]; then
  echo "::error::Dockerfile not found at '$dockerfile'"
  exit 1
fi

# Build-stage names are valid `COPY --from=` targets that are not contexts.
stages=()
while IFS= read -r stage; do
  [[ -n $stage ]] && stages+=("$stage")
done < <(awk 'toupper($1) == "FROM" { for (i = 2; i <= NF; i++) if (toupper($i) == "AS") print $(i + 1) }' "$dockerfile")

declare -A declared=()
while IFS= read -r line; do
  line=${line%%#*}
  line=$(printf '%s' "$line" | tr -d '[:space:]')
  [[ -z $line ]] && continue
  declared["${line%%=*}"]=1
done <<< "${LINKED_BUILD_CONTEXTS:-}"

missing=()
while IFS= read -r name; do
  [[ -z $name ]] && continue
  for stage in ${stages[@]+"${stages[@]}"}; do
    [[ $name == "$stage" ]] && continue 2
  done
  [[ -n ${declared[$name]+set} ]] || missing+=("$name")
done < <(grep -oE '^COPY[[:space:]]+--from=[^[:space:]]+' "$dockerfile" | sed 's/^COPY[[:space:]]*--from=//' | sort -u)

if (( ${#missing[@]} > 0 )); then
  echo "::error::Dockerfile copies from build context(s) that this workflow does not declare: ${missing[*]}"
  echo "Add the missing line(s) to LINKED_BUILD_CONTEXTS in ${GITHUB_WORKFLOW:-the release workflow}:"
  for name in "${missing[@]}"; do
    echo "  $name=.docker/empty"
  done
  echo "Remember: a workflow_run triggered workflow runs from its copy on the default branch (main),"
  echo "so the fix has to land there before this check can pass."
  exit 1
fi

echo "OK: every Dockerfile COPY --from name is a declared build context (${#declared[@]} declared, ${#stages[@]} build stages)."
