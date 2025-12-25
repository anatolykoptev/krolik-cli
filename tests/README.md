# Tests

Test structure following Next.js/Vercel conventions.

## Structure

```
tests/
├── unit/                    # Unit tests (fast, isolated)
│   ├── commands/            # Command tests
│   │   ├── fix/             # Fix command (fixers, analyzers, core)
│   │   ├── refactor/        # Refactor command
│   │   └── context/         # Context command (parsers)
│   ├── lib/                 # Library tests
│   ├── config/              # Config tests
│   └── mcp/                 # MCP server tests
├── integration/             # Integration tests (slower, real I/O)
├── fixtures/                # Test data files
│   ├── test-types-sample.ts
│   ├── test-component-*.ts
│   └── test-db-relations.ts
├── helpers/                 # Shared test utilities
│   ├── fix-helpers.ts       # Helpers for fix command tests
│   └── refactor-helpers.ts  # Helpers for refactor tests
└── scripts/                 # Debug/manual test scripts
    ├── test-parser.ts       # Parser comparison script
    ├── test-import-graph.ts # Import graph testing
    └── debug-types.ts       # Type debugging utilities
```

## Running Tests

```bash
# Run all tests
pnpm test

# Run specific test file
pnpm exec vitest run tests/unit/commands/fix/core/runner.test.ts

# Watch mode
pnpm exec vitest

# Coverage
pnpm exec vitest run --coverage
```

## Writing Tests

1. Place unit tests in `tests/unit/` mirroring `src/` structure
2. Use helpers from `tests/helpers/` for common utilities
3. Place test data in `tests/fixtures/`
4. Name test files `*.test.ts`

## Aliases

- `@` → `src/`
- `@tests` → `tests/`
