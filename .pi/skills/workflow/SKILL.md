---
name: slimfact-workflow
description: Development workflow conventions for SlimFact. Use when planning, tracking, reviewing, or running quality checks on changes.
---

# Workflow

## When to Use

Apply these conventions when:
- Planning or executing a multi-step implementation
- Tracking changes and saving recaps
- Running quality checks before committing
- Writing documentation or documenting env vars
- Writing Vue components or E2E tests

## Rules

### Planning & Execution

- **Work in small batches**: When making code changes, work in small batches and run quality checks between each batch to keep changes manageable and catch regressions early.
- **Think first**: Before starting a multi-step implementation, think through the approach first and confirm the design is correct. Do not propose or execute several approaches back-to-back when the initial idea is already clear. Take the time to think it through first.
- **Continue autonomously**: When working through a planned batch of changes, continue autonomously through all steps without pausing — only stop when hitting a blocker, an ambiguous decision, or when quality checks need to run.
- **Prefer simpler implementations**: If a working approach exists, keep the existing structure rather than introducing elaborate abstractions (lookup maps, probe instances, multi-step iteration) unless there's a clear, demonstrated need.

### Change Tracking

- **Save change recaps**: After making significant changes, save a recap file (file location, line numbers, change description) to `.pi/changes/` with a dated filename like `YYYY-MM-DD-topic.md`. Do not save to `docs/` or any other directory.
- **"Track changes" response**: When the user asks to "track changes" for specific features or additions, create a markdown recap file summarizing the changes — do not attempt to stage them in git.

### Quality & Testing

- **Full quality check sequence**: Quality checks must always include running Playwright E2E tests (not just lint/format/build). Follow the full quality check sequence from `AGENTS.md` including Docker test environment setup and `pnpm run test:e2e`.
- **Investigate skipped tests**: Do not dismiss skipped E2E tests — investigate and fix them before continuing with other work, even if they appear to be conditionally skipped due to data/seeding issues.
- **Seed data programmatically**: When E2E tests need bulk data (e.g., for pagination testing), seed the data programmatically beforehand (via API calls or DB seeding) rather than creating it through repeated browser form interactions.
- **Vacation dates don't overlap**: Vacation date ranges cannot overlap — each vacation must have a unique, non-overlapping date range. When seeding multiple vacations, ensure sequential non-overlapping date ranges.

### Documentation

- **Keep AGENTS.md compact**: Avoid verbose examples, long file lists, or feature-specific details that will quickly become stale. Keep strategies concise and essential.
- **Maintain CHANGELOG.md**: Keep a human-readable `CHANGELOG.md` as the main changelog file for the repository, separate from automated change-tracking files.

### Security

- **Never expose env var values**: Never expose environment variable values in plain text in conversation or committed files. Environment variables exist precisely to keep secrets out of plain text. This includes ALL env var values, not just tokens/passwords.
- **Use placeholders in docs**: When documenting environment variables, use generic placeholders like `ntfy.example.com` or `<token>` instead of the actual env var values. Even seemingly non-sensitive values like hostnames should not be committed.

### Vue

- **Avoid `getCurrentInstance()`**: Do not use `getCurrentInstance()` in application code — it is an internal API intended for official Vue libraries, not userland code.
- **Pass handlers as props**: When a child component needs to detect whether a parent is listening to an event, pass the handler function as a prop (e.g., `:on-open-customer="openCustomer"`) and check `!!props.onOpenCustomer` in the child, rather than using boolean flags or `getCurrentInstance()`.

## Verification

- Change recaps go to `.pi/changes/` with dated filenames
- Full quality check sequence is run before commits (lint → format → build → E2E)
- AGENTS.md stays compact and focused
- No env var values appear in plain text in conversation or docs
- No `getCurrentInstance()` calls in component code
