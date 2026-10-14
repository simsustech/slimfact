# 2026-10-13 — Dashboard: empty revenue, dead preset toggle, broken icons

Investigation from a report that a production dashboard was broken: "none of
the period buttons can be selected, there is no data, the timeline icons look
strange". Diagnosed against the live demo, a local stack, and two production
dumps (instance DB + banking-api DB). No customer data is reproduced here.

## Root causes

### 1. Empty revenue — `checkout.payments.paid_at` is NULL for legacy rows

On the affected instance every payment is `status = 'paid'` with
`paid_at IS NULL`. `getPaidRevenue`, `getPaymentMethodSplit` and
`getActivityFeed` all filter `paid_at IS NOT NULL`, so **every** period
(day/week/month/quarter/year) rendered an empty revenue section and no
payment-posting activity — the "there is no data" symptom.

Why: the bank-transfer payment handler only started writing `paidAt` in
modular-api #161 (commit `30b38f46`). Before that it inserted
`status = 'paid'` and no date at all (it accepted `date` and ignored it), and
the bank-link **adoption** path only updates `transaction_reference`, so those
rows never gain a date. Every bank-transfer payment recorded before that
release is permanently NULL. All of the instance's payments are bank
transfers, so 100% were affected.

This is a **data repair, not a code change**: the current handler writes
`paidAt` correctly, and the instance's real dates still exist in the banking
API's `open_banking.transactions` (verified: every bank-linked payment matched
its transaction, and the true `booking_date` was recovered for all of them).
The recovery recipe is below.

### 2. Period preset never showed a selection

`DashboardPage` bound the toggle to `activePreset` and wired both `DateInput`s'
`@update:model-value` to `onCustomDateChange`, which unconditionally set
`activePreset = 'custom'`. `DateInput` echoes `update:modelValue` during setup
(it calls `setInternalDate(modelValue.value)` *after* registering its
`watch(year/month/day)`), and again whenever a preset writes the inputs — so
`'custom'` (not an option) was set on mount and after every click, and no
button was ever active. The dates did change, which is why clicking looked
inert. Reproduces locally and on the demo, and is visible in the committed
Aug-2026 reference screenshot.

Fix: `onCustomDateChange` derives the preset from the resulting range
(`presetMatchingRange`).

### 3. Activity timeline icons never rendered

`iconForActivity` returned bare `mdi-*`, so `QIcon` emitted
`class="q-icon mdi mdi-receipt-text-outline"` — matched by no stylesheet.
Independently, the names live only in `recentActivity.ts` and this build's
UnoCSS does not scan plain `.ts` files (only `.vue`/`.tsx` plus the explicit
`content.pipeline.include` list), so no icon CSS was generated for them at
all (only the three names that also appear in `DashboardActionItems.vue` were
emitted, by accident).

Fix: `i-mdi-*` names + add `src/components/dashboard/recentActivity.ts` to the
UnoCSS include list.

### 4. Timeline dot renders a "mushroom" blob (separate package)

`unocss-preset-quasar@0.7.0`
(`packages/preset/src/components/timeline/rules.ts`) emits
`.q-timeline__dot { … height: 12px; border-radius: 50%;
background-color: var(--q-primary) }` on top of the `::before` circle.
With `:icon` the dot paints a blue ellipse over the coloured circle. Reference
Quasar sets no background on `.q-timeline__dot`. Fixed in that repo, not here.

## Changes (this repo)

| File | Change |
| --- | --- |
| `packages/app/src/pages/admin/DashboardPage.vue` | Derive the active preset from the date range. |
| `packages/app/src/components/dashboard/recentActivity.ts` | `i-mdi-*` icon names. |
| `packages/app/vitrify.config.ts` | Scan `recentActivity.ts` for icons. |
| `packages/app/tests/unit/recentActivity.test.ts` | Updated expectations. |
| `packages/api/tests/e2e/dashboard.spec.ts` | New preset-active test + icon assertion. |

## Paid_at recovery recipe (run once, per affected instance)

The api database and the banking-api database may be separate. `\copy` is
client-side, so this works whenever both are reachable; run it from the
banking DB into a file, then load and update in the api DB. No extensions
needed.

```bash
# 1) Export the real transaction dates from the banking-api database.
psql -U <user> -h <banking-host> -d <banking-db> \
  -c "\copy (SELECT external_id, coalesce(booking_date, transaction_date, value_date) AS booking_date FROM open_banking.transactions) TO '/tmp/txmap.csv' CSV"

# 2) Load them into the api database and backfill the bank-linked payments.
psql -U <user> -h <api-host> -d <api-db> <<'SQL'
CREATE TEMP TABLE _tx_map (external_id text, booking_date text);
\copy _tx_map FROM '/tmp/txmap.csv' CSV
UPDATE checkout.payments p
SET paid_at = m.booking_date::timestamptz
FROM _tx_map m
WHERE p.status = 'paid'
  AND p.paid_at IS NULL
  AND p.transaction_reference = 'bank:' || m.external_id
  AND m.booking_date ~ '^\d{4}-\d{2}-\d{2}';
SQL
```

Verified on a copy of the instance dump: every bank-linked payment received
its real booking date, and the year view went from zero rows to populated.

If the two databases share one Postgres server, the same thing runs in one
statement with `dblink` / `postgres_fdw` instead of the CSV hop.

Payments with no bank reference (recorded manually) keep a NULL `paid_at` and
stay out of the revenue chart. If they should be included, either link them to
their transaction, or fall back to the recorded time (optional, lossy):

```sql
UPDATE checkout.payments
SET paid_at = created_at::timestamptz
WHERE status = 'paid' AND paid_at IS NULL
  AND created_at ~ '^\d{4}-\d{2}-\d{2}';
```

## Verification done

- App unit tests: 91 passed.
- `unocss-*.css` now contains all six activity icons; live dot has a real
  `mask-image`.
- Live: `This month` has `aria-pressed="true"` + `bg-primary text-white`.
- Playwright `dashboard.spec.ts`: 20 passed on a freshly rebuilt stack.
- `pnpm run build` (`PI_RTK_BYPASS=1`), `lint`, `format:check` clean.

## Follow-ups

- Run the paid_at recovery recipe on each affected instance.
- Bump/link `unocss-preset-quasar` once its dot fix is released.
- Optional: re-seed the demo (seeded from an older fixture, so its own default
  month is empty — the current `seed:demo` already places payments in the
  current month).
- Optional: make the checkout analytics tolerate a NULL `paid_at`
  (`coalesce(paid_at, created_at)`) so future legacy rows cannot blank the
  dashboard again.
