---
"@anatolykoptev/krolik-cli": minor
---

### New Features

**Context command improvements:**
- Add `--search <pattern>` option to find files/code matching pattern (uses ripgrep or grep)
- Add `--changed-only` option to include only files changed in git
- Improved lib-modules section with function signatures for all modules

**Modules command:**
- Fixed signature extraction for files with UTF-8/Russian text (byte offset vs char index bug)
- AST-based type reconstruction via `typeNodeToString()` function
- Proper handling of complex TypeScript types

**Audit command:**
- New `mode=queries` to detect duplicate Prisma/tRPC queries
- Pattern-based detection for consolidation opportunities
