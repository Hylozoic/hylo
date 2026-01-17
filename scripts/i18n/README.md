# Locale Utilities

Utilities for managing translation files that use English as the canonical source. Each tool understands nested objects and validates common placeholder formats (`{{variable}}`, `%{variable}`, `%s`).

## sort-locale.js

```
node scripts/i18n/sort-locale.js <path/to/locale.json>
```

Recursively sorts every object so that keys are written in alphabetical order, producing stable diffs across locales.

## check-locale-keys.js

```
node scripts/i18n/check-locale-keys.js <path/to/en.json> [other-locale|dir ...]
```

Compares each translation with the canonical English file. If no other paths are supplied, every sibling `*.json` file is checked. Reports missing keys, extra keys, type mismatches (including nested structures), array length differences, and placeholder discrepancies. Exits with a non-zero status when problems are found so it can be wired into CI or pre-commit hooks.

## auto-translate-locale.js

```
node scripts/i18n/auto-translate-locale.js --english <path/to/en.json> --target <path/to/<lang>.json>
  [--language <friendly name>] [--model <openai-model>] [--temperature <value|default>] [--force]
  [--dry-run] [--output <path>] [--env <path>]
  [--retries <count>] [--rate-limit <milliseconds>] [--batch-size <count>] [--limit <count>]
```

Translates any missing (or, with `--force`, all) string values from the English file into the target locale using the OpenAI Chat Completions API. The script resolves `OPENAI_API_KEY` from the current environment first, then from `apps/backend/.env` (override with `--env`).

Features:
- Respects nested keys and rewrites the result with alphabetically sorted objects.
- Validates placeholder parity and retries with stronger instructions when a placeholder is dropped.
- Retries transient OpenAI errors with exponential backoff and optional pacing between requests (`--rate-limit`, default 250 ms).
- `--dry-run` previews the generated translations without writing them, while still surfacing placeholder issues.
- `--output` can be used to write to a separate file for review instead of overwriting `--target`.
- `--batch-size` batches multiple keys into a single API call (default 1) to stay within tight request-per-day limits; entries that fail placeholder checks automatically fall back to single-key retries.
- `--limit` processes only the first N missing keys, making it easy to work within daily quotas by running multiple passes.
- `--temperature` overrides the sampling temperature (default 0). Use `--temperature default` to let models that disallow manual control (e.g. `gpt-5-mini`) use their preset value.
