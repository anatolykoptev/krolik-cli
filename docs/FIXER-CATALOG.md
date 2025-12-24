# Krolik Fixer Catalog

> All available and planned fixers for `krolik fix`

## Quick Reference

| Category | Done | Planned | Examples |
|----------|------|---------|----------|
| Lint & Style | 3 | 4 | console, debugger, alert |
| Type Safety | 2 | 3 | any, @ts-ignore |
| Imports | 0 | 3 | unused-imports, import-order |
| Hardcoded | 2 | 3 | magic-numbers, urls |
| Complexity | 2 | 3 | complexity, long-functions |
| Architecture | 2 | 4 | srp, refine |
| Security | 0 | 4 | eval, sql-injection |
| React | 0 | 4 | react-keys, react-deps |
| **Total** | **11** | **28** | |

## By Difficulty

| Difficulty | Auto-Apply | Examples |
|------------|------------|----------|
| **Trivial** | Yes | console, debugger, alert |
| **Safe** | With review | any→unknown, unused-imports |
| **Risky** | Manual only | srp, circular-deps |

---

## Lint & Style (Trivial)

| Fixer | CLI Flag | Status |
|-------|----------|--------|
| console | `--fix-console` | ✅ Done |
| debugger | `--fix-debugger` | ✅ Done |
| alert | `--fix-alert` | ✅ Done |
| formatting | `--fix-formatting` | ⏳ Planned |
| semicolons | `--fix-semicolons` | ⏳ Planned |
| quotes | `--fix-quotes` | ⏳ Planned |
| trailing-commas | `--fix-trailing-commas` | ⏳ Planned |

## Type Safety (Safe)

| Fixer | CLI Flag | Status |
|-------|----------|--------|
| any-type | `--fix-any` | ✅ Done |
| ts-ignore | `--fix-ts-ignore` | ✅ Done |
| implicit-any | `--fix-implicit-any` | ⏳ Planned |
| non-null | `--fix-non-null` | ⏳ Planned |
| optional-chain | `--fix-optional-chain` | ⏳ Planned |

## Imports (Safe)

| Fixer | CLI Flag | Status |
|-------|----------|--------|
| unused-imports | `--fix-unused-imports` | ⏳ Planned |
| import-order | `--fix-import-order` | ⏳ Planned |
| duplicate-imports | `--fix-duplicate-imports` | ⏳ Planned |

## Hardcoded Values (Safe)

| Fixer | CLI Flag | Status |
|-------|----------|--------|
| magic-numbers | `--fix-magic-numbers` | ✅ Done |
| hardcoded-urls | `--fix-urls` | ✅ Done |
| hardcoded-strings | `--fix-strings` | ⏳ Planned |
| hardcoded-colors | `--fix-colors` | ⏳ Planned |
| env-values | `--fix-env` | ⏳ Planned |

## Complexity (Risky)

| Fixer | CLI Flag | Status |
|-------|----------|--------|
| complexity | `--fix-complexity` | ✅ Done |
| long-functions | `--fix-long-functions` | ✅ Done |
| nesting | `--fix-nesting` | ⏳ Planned |
| if-chains | `--fix-if-chains` | ⏳ Planned |
| duplicates | `--fix-duplicates` | ⏳ Planned |

## Architecture (Risky)

| Fixer | CLI Flag | Status |
|-------|----------|--------|
| srp | `--fix-srp` | ✅ Done |
| refine | `--fix-refine` | ✅ Done |
| god-objects | `--fix-god-objects` | ⏳ Planned |
| barrels | `--fix-barrels` | ⏳ Planned |
| circular-deps | `--fix-circular-deps` | ⏳ Planned |
| deep-imports | `--fix-deep-imports` | ⏳ Planned |

## Security (Safe)

| Fixer | CLI Flag | Status |
|-------|----------|--------|
| eval | `--fix-eval` | ⏳ Planned |
| unsafe-regex | `--fix-unsafe-regex` | ⏳ Planned |
| prototype-pollution | `--fix-prototype` | ⏳ Planned |
| sql-injection | `--fix-sql` | ⏳ Planned |

## React (Safe)

| Fixer | CLI Flag | Status |
|-------|----------|--------|
| react-keys | `--fix-react-keys` | ⏳ Planned |
| react-deps | `--fix-react-deps` | ⏳ Planned |
| react-renders | `--fix-react-renders` | ⏳ Planned |
| props-spreading | `--fix-props-spreading` | ⏳ Planned |

---

*See also: `krolik fix --list-fixers`*
