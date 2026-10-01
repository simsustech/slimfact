#!/usr/bin/env bash
# Regression test: every surcharge, discount and tax-summary entry must render
# on its own row in the totals grid of the Typst invoice template.
#
# Bug: the `for` loops in the totals grid were passed un-spread, so each loop
# joined into a single grid cell and multiple entries were concatenated on one
# line ("Cheap:Expensive: − € 5.00− € 2.50").
#
# Requires: typst (compile) and pdftotext (poppler-utils).
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
TEMPLATE="$HERE/../../templates/invoice/default.typ"
FIXTURE="$HERE/fixtures/invoice-multiple-discounts.json"
OUT="$(mktemp -d)"
trap 'rm -rf "$OUT"' EXIT

typst compile "$TEMPLATE" "$OUT/invoice.pdf" \
  --input "invoice=$(cat "$FIXTURE")" \
  --input "includeTax=true" \
  --input "pageSize=a4"
pdftotext -layout "$OUT/invoice.pdf" "$OUT/invoice.txt"

status=0
for pair in "Cheap|Expensive" "Shipping|Handling" "21%|9%"; do
  a="${pair%%|*}"
  b="${pair##*|}"
  if grep -qE "$a.*$b|$b.*$a" "$OUT/invoice.txt"; then
    echo "FAIL: '$a' and '$b' rendered concatenated on one line" >&2
    status=1
  fi
done

if [ "$status" -eq 0 ]; then
  echo "PASS: all discounts/surcharges on separate rows"
fi
exit "$status"
