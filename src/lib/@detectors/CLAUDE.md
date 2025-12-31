# Detectors Library

> `lib/@detectors/` — code analysis and issue detection

## Structure

```
@detectors/
├── noise-filter/     # Duplicate filtering (5-stage pipeline)
├── quality/          # complexity/, hardcoded/, env-config/
├── security/         # Vulnerabilities + secrets detection
├── lint/             # console, debugger, any, assertions
├── patterns/         # Skip logic, react hooks, issue factory
├── i18n/             # Hardcoded strings (Cyrillic)
├── modernization/    # require → import
├── complexity.ts     # Thresholds and patterns
└── env-severity.ts   # Env var sensitivity analysis
```

---

## Noise Filter (Duplicates)

### Pipeline

```
Input → [Skip] → [Generated] → [Semantic] → [Dedup] → [Score] → Output
         ↓           ↓             ↓           ↓          ↓
      vendors    @generated    intent+     fingerprint  quality
                 Prisma        domain+JSX   grouping    scoring
```

### Skippable Intents

| Intent | Pattern | Skip Because |
|--------|---------|--------------|
| `route-handler` | page.tsx, route.tsx | Next.js convention |
| `component-wrapper` | Single JSX child | Structural, not logic |
| `factory-instance` | `create*()` call | Factory pattern |
| `schema-generator` | `*Schema` + JsonLd | JSON-LD wrappers |

### Key Constants

```typescript
MIN_STRUCTURAL_COMPLEXITY = 25   // Below = too simple
SIMILARITY_THRESHOLD_MERGE = 0.85
MIN_BODY_LENGTH = 100
```

---

## Quick Reference

| Detector | Flags When | Skip When | Key Threshold |
|----------|------------|-----------|---------------|
| **complexity** | cyclomatic > 10, nesting > 4 | config files | `COMPLEXITY_RANGE: 10-120` |
| **hardcoded** | magic numbers, URLs, hex colors | const declarations, 0/1/-1/100 | `ACCEPTABLE_NUMBERS` |
| **env-config** | secrets in code, hardcoded ports | `.env` files | compound patterns |
| **security** | command injection, path traversal, secrets | test files, placeholders | `entropy > 4.5` |
| **lint** | console.*, debugger, alert, eval, empty catch | — | — |
| **type-safety** | `: any`, `as any`, `foo!`, double assertions | — | — |
| **i18n** | 2+ Cyrillic chars in JSX | className, id, href, data-testid | `RUSSIAN_TEXT_PATTERN` |
| **modernization** | `require()`, `require.resolve()` | — | — |

---

## Env Severity Levels

| Severity | Triggers | Examples |
|----------|----------|----------|
| `critical` | database + url, secret + key, auth words | `DATABASE_URL`, `JWT_SECRET` |
| `high` | third-party service prefix, credential words | `STRIPE_KEY`, `API_TOKEN` |
| `medium` | url/config words without PUBLIC | `API_URL`, `PORT` |
| `low` | PUBLIC prefix, general config | `NEXT_PUBLIC_*`, `DEBUG` |

---

## Patterns Module

| Submodule | Purpose |
|-----------|---------|
| `skip-logic.ts` | `shouldSkipForAnalysis()`, `shouldSkipForLint()` |
| `react-patterns.ts` | `isReactHook()`, `isBuiltInHook()` |
| `issue-factory/` | `createLintIssue()`, `createSecurityIssue()` |
| `fixer-ids.ts` | Detection type → fixer ID mapping |
| `backwards-compat.ts` | Shim detection |

---

## i18n: Relevant vs Skip Attributes

| Flag (user-facing) | Skip (technical) |
|--------------------|------------------|
| placeholder, title, label | className, id, key |
| aria-label, description | href, src, to, path |
| errorMessage, helperText | data-testid, value |
| buttonText, tooltip | onClick, onChange |

---

## Adding New Detector

1. Create in appropriate module
2. Return `Detection | null` from AST node
3. Export in `index.ts`
4. Add skip patterns if needed
