---
name: slimfact-dates
description: Date handling conventions using date-fns and date-holidays. Use when working with date manipulation, holiday lookups, or holiday surcharge logic.
---

# Dates

## When to Use

Apply these conventions when:
- Generating date sequences or intervals
- Looking up holidays via `date-holidays`
- Computing holiday surcharge line items on invoices
- Writing tests for date-related logic

## Rules

- **Use date-fns**: Use date-fns for generating date sequences and intervals instead of manual string arithmetic.
- **UTC YYYY-MM-DD iteration**: For date-only iteration where each day is matched against a UTC `YYYY-MM-DD` key (e.g., holiday lookups), do NOT use `eachDayOfInterval` with `parse(str, 'yyyy-MM-dd', new Date())` — it produces local-midnight dates that desync from UTC date strings in non-UTC timezones. Instead, build start/end with `Date.UTC(year, monthIdx, day)` from the input string, then iterate `t += 24*60*60*1000` and key by `new Date(t).toISOString().slice(0, 10)`.
- **date-holidays in UTC**: When working with `date-holidays` (`isHoliday`, `getHolidays`), keep everything in UTC — the library returns `YYYY-MM-DD` strings but `isHoliday(Date)` interprets in local time, so always pass a UTC-anchored Date and key lookups by the UTC date string.
- **Holiday name as description**: For holiday surcharge invoice line items, use the actual holiday name (e.g., `'Nieuwjaar'`, `'Kerstmis'`, `'Tweede kerstdag'`) as the line description — NOT the locale code. The description must answer "for what holiday?" and must be the human-readable holiday name.
- **Single Holidays instance**: Do not over-engineer the holiday name lookup: a single `Holidays(country)` with `setHoliday(rule, locale)` is sufficient — description comes directly from `result[0].name`. Do not construct separate "matcher" and "namer" instances to retrieve canonical names, and do not fall back to the locale string when a name is missing.
- **Use country config**: For the `new Holidays(country)` constructor, use the `country` config value (e.g., `new Holidays(country)`) — do not hardcode `'NL'` and do not pass `locale` as the country. The country comes from `VITE_COUNTRY` and is independent of the locale.
- **Default to US**: Default the `country` config to `'US'` (matching the default `en-US` locale) — do not default to `'NL'`.
- **Dynamic holiday name in tests**: For holiday surcharge tests, assert against the holiday name dynamically returned by the library for the given rule (e.g., resolve the expected name via the same `Holidays`/date-fns lookup at test time), NOT against a hardcoded string literal. This keeps the test aligned with what the code actually produces.
- **Explicit allowlist**: For the holiday surcharge handler, treat `surchargeHolidays` as an explicit allowlist of rules to surcharge — do NOT add extra filtering by `date-holidays` holiday `type` (e.g., `public`/`bank`/`school`/`observance`). If a rule resolves to a date, surcharge it.
- **Exact rule match**: For matching `surchargeHolidays` rules, do an exact `rule === result[0].rule` match only — do NOT add an `||` fallback that also matches against the holiday name or against a sliced MM-DD substring. The caller provides a list of date-holidays rule strings (e.g., `'01-01'`, `'easter'`, `'04-27 if sunday then previous saturday since 2014'`) and wants each matched against the rule field.

## Verification

- Date iteration uses UTC-based arithmetic, not `eachDayOfInterval`
- Holiday lookups always pass UTC-anchored Dates
- Surcharge descriptions show the actual holiday name, not a locale code
- Surcharge rules match exactly on `result[0].rule`
