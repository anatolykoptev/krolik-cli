# @anatolykoptev/krolik-cli

## 0.1.4

### Patch Changes

- Consolidate duplicate code via multi-agent orchestration:
  - Extracted shared scanDir utility for directory traversal
  - Consolidated formatJson/formatMarkdown formatting utilities
  - Merged domain detection functions into single module
  - Unified agent utilities (forceRescan, readAgentFile, parseEnv)
  - Consolidated CommandOptions type into single source
  - Merged Git types into unified git types module
  - Consolidated parser types (ZodSchema, Relation, etc.)
  - Fixed MCP server TOOLS export for backward compatibility

  Net reduction: ~641 lines of code

## 0.1.3

### Patch Changes

- [`c84b8dc`](https://github.com/anatolykoptev/krolik-cli/commit/c84b8dc238640ba335c1fc98739f9e5276fd8374) - ## v0.1.2
  - Simplified README with focus on benefits
  - Fixed TypeScript errors across codebase
  - All 14 MCP tools documented
  - All 12 agent categories listed

## 0.1.1

### Patch Changes

- [`86ebc59`](https://github.com/anatolykoptev/krolik-cli/commit/86ebc59d53934bbdd4b40f200fd7383ec90bc110) - CI/CD setup complete: dual registry publishing (npmjs.org + GitHub Packages)
