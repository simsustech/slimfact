import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join, relative } from 'node:path'

// Regression guard for the "NaN in a select" class of bug.
//
// A QSelect with `map-options` renders a model that matches no option verbatim,
// so a NaN filter default shows up as "NaN" in the input. That shipped twice:
// fixed 2026-08-20, then silently reverted by the open-banking merge — because
// the only guard asserted a *form* combobox inside the Add-bill dialog, never a
// list-page filter select. This test covers the source shape instead, so a
// re-introduced sentinel fails in CI regardless of which page it is on.
//
// `NaN` deliberately survives in the two internal id modules: those ids are
// never bound to a select, and `enabled: !Number.isNaN(id.value)` gates the
// query because `getInvoiceEmail` and `getInvoiceEvents` both require a numeric
// input (their schemas are `z.number()`, not nullable).
const NAN_SENTINEL_ALLOWLIST = [
  'queries/admin/email.ts',
  'queries/admin/invoiceEvents.ts'
]

// The package runner's cwd is the package root, so this needs no import.meta
// gymnastics (vitrify does not expose a file:-scheme import.meta.url here).
const srcDir = join(process.cwd(), 'src')

const sourceFiles = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) return sourceFiles(path)
    return /\.(ts|vue)$/.test(entry.name) ? [path] : []
  })

const sources = sourceFiles(srcDir).map((path) => ({
  path: relative(srcDir, path),
  text: readFileSync(path, 'utf8')
}))

/** Paths of the scanned sources matching `pattern`. */
const matching = (pattern: RegExp): string[] =>
  sources.filter(({ text }) => pattern.test(text)).map(({ path }) => path)

describe('select state never holds NaN', () => {
  it('scans the app sources', () => {
    // Guards the guard: a broken walk would make every assertion below vacuous.
    expect(sources.length).toBeGreaterThan(100)
    expect(sources.map(({ path }) => path)).toContain(
      'queries/admin/invoices.ts'
    )
  })

  it('assigns null, never NaN, to a company or client filter model', () => {
    expect(
      matching(/\b(companyId|clientId)\s*(?:\.value)?\s*=\s*NaN\b/)
    ).toEqual([])
  })

  it('never creates an untyped NaN ref', () => {
    expect(matching(/\bref\(\s*NaN\s*\)/)).toEqual([])
  })

  it('never tests a company or client model with Number.isNaN', () => {
    // `!Number.isNaN(model)` as a presence check inverts once the unset value
    // is null — the "clear search" button would always look active.
    expect(
      matching(/Number\.isNaN\(\s*(?:[A-Za-z]+\.)?(companyId|clientId)\b/)
    ).toEqual([])
  })

  it('keeps typed NaN sentinels to the internal id modules', () => {
    expect(matching(/\bref<number>\(\s*NaN\s*\)/).sort()).toEqual(
      [...NAN_SENTINEL_ALLOWLIST].sort()
    )
  })
})
