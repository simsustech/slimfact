---
name: slimfact-env
description: Environment variable configuration conventions for SlimFact. Use when reading, setting, or documenting environment variables.
---

# Environment Variables

## When to Use

Apply these conventions when:
- Reading environment variables in code
- Adding new environment variables
- Documenting env vars
- Setting up configuration modules

## Rules

- **Validate at startup**: Validate mandatory environment variables at startup and throw descriptive errors when they are undefined.
- **Use `env.read()`**: Use `env.read()` from `@vitrify/tools/env` instead of raw `process.env`, since `process.env` may not be available in ESM contexts.
- **Use `VITE_LANG`**: Use `VITE_LANG` (e.g. `"en-US"`) for locale instead of `LANG` (e.g. `"en_US.UTF-8"`) to avoid platform-dependent format issues.
- **Pass unprefixed key to `read()`**: When calling `read()` from `@vitrify/tools/env`, pass the unprefixed key (e.g. `read('LANG')`) so it can auto-fallback to the VITE_-prefixed version (`VITE_LANG`). Passing `read('VITE_LANG')` causes a nonsensical `VITE_VITE_LANG` fallback.
- **NTFY_HOST without https://**: `NTFY_HOST` should be set without the `https://` protocol prefix (e.g., `"ntfy.example.com"`), since the code constructs the full URL with `https://${NTFY_HOST}`.
- **Defaults in config file**: Set default values for environment variables in the env configuration file (e.g., `env.ts`), not at the usage/consumption sites where the value is used.

## Verification

- All env reads use `env.read()` from `@vitrify/tools/env`, not `process.env` directly
- Configuration modules set defaults in one central place
- New env vars have validation with descriptive error messages
