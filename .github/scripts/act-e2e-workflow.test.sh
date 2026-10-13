#!/usr/bin/env bash
#
# Local end-to-end test of the `Test staging build` workflow's e2e job with act
# (https://github.com/nektos/act).
#
# Why these flags:
#   - the workflow only has the `playwright-test` job and triggers on a push to
#     `staging`, so a matching push-event JSON is fed in;
#   - act already bind-mounts the host docker socket, so `docker compose` inside
#     the job drives the host daemon (no docker-in-docker). Do NOT pass your own
#     `-v /var/run/docker.sock:...` — Docker rejects it as a duplicate mount;
#   - the Playwright run reaches the stack at https://slimfact.localhost, which
#     the compose containers publish on the host, so the container gets a
#     host-gateway entry for that name.
#
# The job is long (pnpm install + Playwright browser + image build + the suite),
# so run it when the workflow or the e2e plumbing changes rather than on every
# commit.
#
# Usage:
#   SIMSUSTECH_NPM_TOKEN=... bash .github/scripts/act-e2e-workflow.test.sh
#   # SIMSUSTECH_NPM_TOKEN is read from ./env/SIMSUSTECH_NPM_TOKEN when unset.
# Requires: act, docker, and the act runner image (default
# catthehacker/ubuntu:act-latest, override with ACT_RUNNER_IMAGE=...).

set -uo pipefail

root=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
workflow="$root/.github/workflows/test staging.yaml"
runner_image=${ACT_RUNNER_IMAGE:-catthehacker/ubuntu:act-latest}

command -v act >/dev/null || {
  echo 'skip: act is not installed'
  exit 0
}
command -v docker >/dev/null || {
  echo 'skip: docker is not installed'
  exit 0
}

token=${SIMSUSTECH_NPM_TOKEN:-}
if [[ -z $token && -f $root/env/SIMSUSTECH_NPM_TOKEN ]]; then
  token=$(cat "$root/env/SIMSUSTECH_NPM_TOKEN")
fi
[[ -n $token ]] || {
  echo 'FAIL set SIMSUSTECH_NPM_TOKEN or create ./env/SIMSUSTECH_NPM_TOKEN'
  exit 1
}

tmp=$(mktemp -d)
cleanup() { rm -rf "$tmp"; }
trap cleanup EXIT

cat >"$tmp/push.json" <<'JSON'
{
  "ref": "refs/heads/staging",
  "repository": {
    "name": "slimfact",
    "full_name": "simsustech/slimfact",
    "owner": { "login": "simsustech" },
    "default_branch": "main"
  },
  "sender": { "login": "stefan" }
}
JSON

echo '--- act: Test staging build / playwright-test'
(cd "$root" && act push \
  -W "$workflow" \
  -j playwright-test \
  -e "$tmp/push.json" \
  -P "ubuntu-latest=$runner_image" \
  --secret SIMSUSTECH_NPM_TOKEN="$token" \
  --container-options '--add-host slimfact.localhost:host-gateway')
