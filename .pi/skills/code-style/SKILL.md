---
name: slimfact-code-style
description: Coding conventions and style preferences for the SlimFact project. Use when writing TypeScript, Vue, or test/factory code.
---

# Code Style

## When to Use

Apply these conventions when writing TypeScript or Vue code, especially when:
- Creating configuration modules (use `config/` directory, not `env/`)
- Casting environment config values as string literals for handler routing
- Writing object map lookups for handler dispatch
- Writing test/factory `buildParams`-style helpers
- Deciding whether to add defensive fallbacks around library calls

## Rules

- **Config directory**: Use a `config/` directory (not `env/`) for configuration module files like `env.ts` and `postgres.ts`.
- **Type assertions**: When casting env config values as specific string literals (e.g., `as 'mollie' | 'stripe'`), do NOT include `| undefined` inside the type assertion — the value being asserted is a string when defined, and the `|| undefined` fallback already handles the undefined case. The type assertion should only reflect the valid defined values.
- **Prefer simplicity**: Prefer simple, direct code over complex implementations. When iterating on a solution, don't over-engineer (e.g., nested probes, rule-by-date maps, UTC indirection, double init calls) when a straightforward loop with a counter or map would work. The user will explicitly call out overly complicated code.
- **Trust library return values**: Avoid defensive fallbacks like `fn()?.[0]?.name ?? result[0].name` or `?? locale`. If a function returns `false`, `!result` is sufficient. If it returns a hit, `result[0].name` and `result[0].rule` are sufficient. The user will point out when defensive code is unnecessary.
- **Object map lookups**: For mapping config string values to handler instances (e.g., ideal/creditcard payment handler routing), use an object map/record lookup (`const psp = { mollie: mollieHandler, stripe: stripeHandler }[config]`) instead of a ternary chain.
- **Factory param naming**: For test/factory `buildParams`-style helpers, let the destructured parameter name match the param name and shadow a module-scope default constant (e.g., `country = country`) — do NOT use a `passed<Name>` prefix or an "Argument" suffix. The parameter is passed by design, not as an argument.

## Verification

- New code follows the conventions above
- Config modules live in `config/` not `env/`
- Type assertions on env values don't include `| undefined`
- Handler routing uses object map lookups, not ternary chains
