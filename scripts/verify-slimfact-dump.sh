#!/usr/bin/env bash
#
# verify-slimfact-dump.sh
# =======================
# Reproduces bank-inbox matching verification against a real SlimFact production
# dump. Restores the dump, syncs the real NL30RABO0153402105 account into the
# banking-api DB, links it to the (shared-IBAN) dump companies, points the stack
# at slimfact_dump, and leaves it up for manual testing in the bank-inbox tab.
#
# What it does
#  1. (re)creates `slimfact_dump` on the test-stack Postgres and restores
#     dump-slimfact_*.sql (custom-format despite the .sql name → pg_restore).
#  2. applies additive migrations (adds the bank/open_banking schema).
#  3. resets the admin@slimfact.app password to a known value (the dump hash is
#     not recoverable).
#  4. runs scripts/fetch-dump-account.mjs to pull the real NL30RABO0153402105
#     transactions into open_banking.* (no live sync; respects Retry-After).
#  5. links that account to EVERY company whose IBAN matches it — the dump has
#     three companies sharing one IBAN, and the IBAN fallback resolves to only
#     one, which would otherwise hide the other companies' open invoices.
#  6. brings up the api+banking-api pointed at slimfact_dump via
#     docker-compose.dump.yaml, then runs verify:links.
#  7. leaves the stack UP for manual bank-inbox testing.
#
# Prereqs:
#  - base test stack buildable: docker compose -f docker-compose.test.yaml up -d --wait
#  - env/SIMSUSTECH_NPM_TOKEN (image build), env/credentials.json, env/MOLLIE_API_KEY
#  - LINKED_MODULAR_API_EVENT_BUS_PATH=~/Projects/modular-api/packages/event-bus
#  - env/OPENBANKING_CREDENTIALS_JSON + MOLLIE_API_KEY exported (see docker-compose.dump.yaml)
#
# Usage:  POSTGRES_PASSWORD=ufgouifdgjdfg ./scripts/verify-slimfact-dump.sh
#
# Manual test:  https://slimfact.localhost/admin/payments?tab=bank
#               login admin@slimfact.app / Sif5uEG5hcTH

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

COMPOSE="docker compose -f docker-compose.test.yaml"
DB_SVC="database"
DB_USER="${POSTGRES_USER:-postgres}"
DB_PASS="${POSTGRES_PASSWORD:-ufgouifdgjdfg}"
DB_NAME="slimfact_dump"
DUMP_FILE="${DUMP_FILE:-$(ls dump-slimfact_*.sql 2>/dev/null | head -1)}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-Sif5uEG5hcTH}"
ACCOUNT_IBAN="${ACCOUNT_IBAN:-NL30RABO0153402105}"

[ -n "$DUMP_FILE" ] || {
  echo "no dump-slimfact_*.sql found"
  exit 1
}

PSQL() { PGPASSWORD="$DB_PASS" $COMPOSE exec -T "$DB_SVC" psql -U "$DB_USER" "$@"; }

echo "==[1/7] restoring $DUMP_FILE into $DB_NAME =="
PSQL -c "DROP DATABASE IF EXISTS $DB_NAME;"
PSQL -c "CREATE DATABASE $DB_NAME;"
$COMPOSE cp "$DUMP_FILE" "$DB_SVC":/tmp/slimfact_dump.dump
set +e
PGPASSWORD="$DB_PASS" $COMPOSE exec -T "$DB_SVC" \
  pg_restore -U "$DB_USER" -d "$DB_NAME" --no-owner /tmp/slimfact_dump.dump
set -e
echo "  invoices=$(PSQL -d "$DB_NAME" -tAc 'select count(*) from checkout.invoices')"

echo "==[2/7] applying additive migrations =="
$COMPOSE exec -T -e POSTGRES_DB=$DB_NAME api node dist/kysely/migrate.js
# The banking-api owns the open_banking schema (001-004, incl. suggestions);
# step 4 fetches into open_banking.accounts, so apply these migrations now.
$COMPOSE exec -T -e POSTGRES_DB=$DB_NAME banking-api sh -c 'cd /app && node dist/src/kysely/migrate.js'

echo "==[3/7] resetting admin@slimfact.app password =="
HASH="$(cd packages/api && node -e \
  "import('@vitrify/tools/scrypt').then(async m=>{console.log(await m.hashPassword(process.argv[1]))})" "$ADMIN_PASSWORD")"
PSQL -d "$DB_NAME" -c "UPDATE public.authentication_methods
  SET password='$HASH'
  WHERE account_id=(SELECT id FROM public.accounts WHERE email='admin@slimfact.app')
    AND provider='native';"

echo "==[4/7] fetching $ACCOUNT_IBAN data into open_banking (no live sync) =="
(cd packages/banking-api && node scripts/fetch-dump-account.mjs)

echo "==[5/7] linking the account to every company sharing its IBAN =="
# The IBAN fallback resolves to a single company when several share one IBAN;
# an explicit bank_account_companies link is required so the matcher sees the
# open invoices of ALL companies on that account.
ACCT_EXT="$(PGPASSWORD="$DB_PASS" $COMPOSE exec -T "$DB_SVC" psql -U "$DB_USER" -d "$DB_NAME" -tAc \
  "select external_id from open_banking.accounts where replace(upper(iban),' ','')='$ACCOUNT_IBAN' limit 1")"
PSQL -d "$DB_NAME" -c "INSERT INTO public.bank_account_companies (account_external_id, company_id)
  SELECT '$ACCT_EXT', id FROM public.companies
  WHERE replace(upper(iban),' ','')='$ACCOUNT_IBAN' ON CONFLICT DO NOTHING;"

echo "==[5b/7] computing suggestions from fetched credits + invoices =="
(cd packages/banking-api && node scripts/compute-suggestions.mjs)

docker compose -f docker-compose.test.yaml -f docker-compose.dump.yaml up -d --wait api banking-api

# Step 4 fetched the accounts into a freshly restored DB, but a banking-api
# that was ALREADY running reconciled its key grants against the empty
# accounts table (unknownAccounts>0, grants wiped -> empty overview).
# Restart so reconcileKeys re-runs against the populated accounts.
echo "==[6b/8] re-reconciling banking-api key grants against fetched accounts =="
docker compose -f docker-compose.test.yaml -f docker-compose.dump.yaml restart banking-api
docker compose -f docker-compose.test.yaml -f docker-compose.dump.yaml up -d --wait banking-api

echo "==[7/8] stack UP. Manual test: admin@slimfact.app / $ADMIN_PASSWORD =="
echo "  open https://slimfact.localhost/admin/payments?tab=bank"
