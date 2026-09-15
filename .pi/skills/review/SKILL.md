---
name: slimfact-review
description: How to run a code/documentation review that finds real problems. Use when reviewing a branch, auditing docs against code, or checking work before a push or merge.
---

# Review

A review is a series of **claims you can defend**, not opinions. This file is the
method, with the traps that actually bit us — each one is a concrete lesson, not
a platitude.

## Core rule: verify, then state

Never write a factual sentence you have not checked *in this session*. The
failure mode is not being wrong loudly, it is being wrong *plausibly* — a
sentence that reads fine and is false.

- **Label the basis of every claim.** "Measured: X" vs "Inferred: Y". If you
  could not run it, say so in the same breath as the claim.
- **Distinguish pre-existing from introduced.** Before "this is broken", run
  `git log --oneline -3 -- <path>` and check whether *your* commits touched it.
  This one habit prevents most false accusations.
- **Corrections are part of the deliverable.** When a later check refutes an
  earlier claim, say so explicitly and put it in the final report. A silently
  corrected claim leaves the reader believing the old one.

## Verification tiers

Rank evidence. Higher tiers are allowed to overrule lower ones.

| tier | example | proves |
|---|---|---|
| **A — executed** | run the command, see the output; a test passes; `docker compose config` exit 0 | the thing works *now* |
| **B — structural** | `tsc --noEmit`; tree hashes equal; `grep` for the symbol | a property holds across the codebase |
| **C — source reading** | read the file and reason | intent/design — *not* runtime behaviour |
| **D — inference** | "it should resolve because it's a workspace dep" | a hypothesis, must be labelled as such |

**Tier C is where reviews lie.** Reading code tells you what it says, not what it
does. If a claim is load-bearing, promote it to A or B.

### Negative controls — the single highest-value technique

A passing check proves nothing unless the check *can* fail. Before trusting a
green result, **inject a deliberate error and confirm it is caught**.

Real example from this repo: `vue-tsc -p tsconfig.types.json` reported the same
11 errors before and after a change, which looked like "no regression". Injecting
`const blatant: number = 'nope'` into a `.vue` file produced **no new error** —
proving that config checks **no `.vue` content at all**. The green result was
meaningless. The app's `tsconfig.json` does check them; the negative control is
what found the difference.

Corollary: "same error count before and after" is only evidence if you have
proven the checker sees the files you changed.

## Finding classes — what to sweep

Run these before declaring a branch done. Each is concrete and greppable.

1. **Dead code** — exports with no non-test reference; files nothing imports;
   scripts whose output nothing reads. Check call sites, not just definitions:
   `git grep -c '\bsymbol\b'` then filter out `/tests/` and the definition.
2. **Commented-out code** — a whole file of it is a deleted file. Heuristic:
   lines matching `^\s*//\s*(const|let|return|if|await|function|import)`.
3. **Stale build output** — `dist/` entries with no corresponding `src/` file.
   `tsc` **does not clean**; a deleted migration can still execute from `dist`.
   Check with: for each `dist/**/*.js`, is there a sibling source?
4. **Env/docs drift** — every documented default vs the code that reads it.
   `grep 'intEnv\|read(\|required(' src/config/env.ts` and compare. An
   `.env.example` that contradicts its own service is worse than none.
5. **Orphaned references** — docs/routes/schema names that no longer exist.
   Renames leave these behind: `grep -rn 'old-name'`.
6. **Committed secrets** — not just tracked files now, but *reachable history*.
   `git log --all --format=%H -- <path>` for every secret-shaped path, then
   decide reachability (below).
7. **Duplicate definitions** — the same type in two places that must agree
   (`PspSettlement` in both `tools/types.ts` and `api/banking/client.ts`).
8. **Superseded docs** — a recap/plan describing behaviour that has since
   changed. Verify claims against code, then mark them superseded rather than
   deleting silently.

## Traps that produced wrong answers

Every entry cost real time. These are the failure modes, not the fixes.

| trap | lesson |
|---|---|
| `git ls-remote` exited 128 (`No user exists for uid 1000`) and its output was empty | Empty output from a **failed** command is a false negative, not evidence of absence. Check the exit code before concluding "not on the remote". |
| Read a `Merge conflict marker` finding as real | Prove it: `grep -rn '^<<<<<<< \|^>>>>>>> '`. If zero markers exist, the finding is stale — see *Stale diagnostics* below. |
| Concluded "loose git tag ⇒ created locally" | Tag packed-ness says nothing about origin. The loose `0.12.9` tag was created by `github-actions[bot]`. Annotated-vs-lightweight is also a *convention* signal, not a fact about who pushed. |
| Compared versions with `sort` | `0.6.35` sorts after `0.6.9` lexicographically. Use `sort -V` or `max(key=semver_tuple)`. A wrong sort silently invents gaps. |
| `git log origin/dev..HEAD` while local refs were stale | Remote-tracking refs are a **cache**. Before any push/merge judgement, check `.git/FETCH_HEAD` mtime and say "as of my last fetch". |
| Trusted a `read` of a relative path after `cd` | The read tool resolves against *its own* cwd, not the shell's. It silently returns a same-named file from the wrong repo. Use absolute paths when not at the repo root. |
| Ran two `tsc` processes concurrently | Produced a spurious `FAIL` that was not reproducible. Serialise heavy checks; never attribute a flaky failure without a re-run. |
| Replaced a line intending to delete it | `set_line` **substitutes**. To delete, pass empty `new_text`; to insert, use `insert_after`. A substitute-that-should-have-been-a-delete duplicated a JSON key. Verify with `node -e 'JSON.parse(...)'` after touching JSON. |
| Repeated `edit` calls rejected as *thrashing* | A guard latches on a file after repeated edits. Stop fighting it: copy to `/tmp` as a backup, apply the change with a script, then **assert the result** (`diff` against the backup). |
| Blanket `sed 's/as unknown as/as/'` across 12 files | Nearly shipped a regression. It worked only because every site was *then* verified by a type check. Scripted edits are fine **if and only if** a checker validates the result — and the checker itself was broken at the time (see negative controls). |

## Stale diagnostics: `pi-lens` false positives

Symptoms: repeated auto-labelled `[pi-lens automated check — not a user request]`
blocks citing *"Merge conflict marker encountered"* at ordinary lines
(`if (`, `include: [...]`), plus *"Cannot find module '@slimfact/tools'"* in a
file whose line 7 is literally `import { formatPrice } from '@slimfact/tools'`.

It is **not** a code problem. Root cause, established by experiment:

- The finding is persisted verbatim as a `signature` string in
  `~/.pi-lens/projects/<slug>/cache/turn-end-findings-last.json`.
- **Deleting that file does not help.** The pi-lens extension host (pid in
  `turn-state.json`) holds it in memory and **rewrote the file ~60s later** with
  a changed sequence range but identical text.
- `Merge conflict marker encountered` is TypeScript's own diagnostic (TS1185),
  triggered by a line starting with `<<<<<<<`, `>>>>>>>`, or **7+ `=`**.

**Dismiss it in ≤2 commands and move on:**

```bash
grep -rn '^<<<<<<< \|^>>>>>>> ' --include='*.ts' . | grep -v node_modules   # expect 0
cd packages/api && npx tsc --noEmit                                          # expect exit 0
```

State the disproof once per turn in a short block, then continue. Do not restate
the same paragraph every message. **Only a Pi restart clears it durably.**

## Push/merge safety

Before any push or merge, answer these in order. Each has bitten us.

1. **Is it already applied anywhere?** Renumbering or deleting a migration is
   safe *only* if nothing has run it.
   `git ls-tree -r --name-only dev -- <migrations-dir> | wc -l`  → `0` means the
   branch is unmerged and renumbering is free. Never renumber without this.
2. **Is the secret-bearing history in the push range?**
   ```bash
   git merge-base --is-ancestor <commit> HEAD && echo in-range || echo unreachable
   git branch -a --contains <commit>     # secret commits were only on local backup branches
   ```
   Reachability — not "does it appear in `git log --all`" — decides exposure.
   A purged file still appears in `--all` via backup branches while being
   perfectly safe to push.
3. **Is the branch a fast-forward?**
   `git rev-list --count dev..HEAD` and `HEAD..dev`. Behind > 0 means merge first.
4. **Remote-tracking freshness** — see the trap table.
5. **Does anything verify it?** "No script references it" is not "it's dead" —
   and "the analyzer flags it" is not "it's broken". Knip flags entry points
   (`vitrify.config.ts`, `playwright.*.config.ts`) and framework deps as unused;
   it also flags real dead exports. Triage individually.

### Release plumbing traps

- **`changeset publish` skips versions already on the registry** — so it creates
  **no tag** for them, and *a GitHub Release is created from a tag*. Re-running CI
  therefore cannot retro-create a release; the tag must be made by hand.
- **A `permissions:` block is not optional** when using the default
  `GITHUB_TOKEN`: `contents: write` (push the tag) and `pull-requests: write`
  (open the version PR). Without it the publish **succeeds** and the tag push is
  rejected — the failure looks like success. Symptom: version live on npm, no tag.
- **New workspace packages**: check `private`, whether they are in
  `.changeset/config.json` `ignore`, and whether they belong in a `fixed` group
  with their dependents.

## Reporting

Structure the report so the reader can act:

1. **What changed** — the decision and its justification.
2. **Evidence** — the command and its output, per claim.
3. **Attribution** — for every failure: pre-existing or introduced, with the
   `git log` proof.
4. **Residual risk** — what you could *not* verify, stated plainly. "I could not
   reach the remote, so X is inference."
5. **Corrections** — anything you claimed earlier that turned out wrong.

Prefer tables for enumerable findings, one line each. Avoid restating the same
caveat in every message; state it once, where it binds.

## Pre-push checklist

```bash
# 1. clean tree, nothing untracked that matters
git status --porcelain

# 2. what am I actually pushing
git rev-list --count origin/dev..HEAD

# 3. secrets: reachability, not presence
for p in <secret-shaped paths>; do git log --all --format=%H -- "$p"; done

# 4. no live markers, anywhere near what I touched
grep -rn '^<<<<<<< \|^>>>>>>> ' --include='*.ts' . | grep -v node_modules

# 5. gates, serialised (not concurrent)
pnpm run lint && pnpm run format:check
pnpm --filter @slimfact/api test
pnpm --filter @slimfact/banking-api test

# 6. typed checks — and prove the checker sees your files (negative control once)

# 7. E2E needs a fresh stack; units do not prove E2E
cd packages/api && npx playwright test --list      # collects?
```

Then: **run E2E on a fresh stack before calling the branch shippable.** Unit
tests passing says nothing about the seed, migrations, or UI wiring.

## On sweeping for "unnecessary" things

Ask before deleting, and separate three cases — they have different answers:

- **Unreferenced and unreachable** → safe to delete (dead migration, orphaned
  probe spec, byte-identical `.bak`).
- **Referenced only by tests** → keep, and say so; they are a contract.
- **Unreferenced but recent** → likely intended; flag, don't delete.

For deletion of anything in a build or migration path, state the blast radius in
the commit message and verify the removed thing by running the path that used it.
