---
"@anatolykoptev/krolik-cli": minor
---

## 0.6.0 - Structural Clone Detection

### Features

- **Structural Clone Detection** - New fingerprint-based algorithm for detecting renamed clones
  - Catches functions with same logic but different variable/function names
  - Uses AST normalization + MD5 hashing for structural comparison
  - Integrated into `refactor` command output as `[structural clone]` entries

### Fixes

- **SWC Parser Fix** - Fixed critical bug with accumulating span offsets
  - SWC's `parseSync` accumulates byte offsets across multiple calls
  - Now uses centralized `parseFile` from `@ast/swc/parser` with `baseOffset` normalization

### Changes

- **Fixers Risk Assessment** - All fixers marked as `risky` (not production-ready)
  - 16 fixers updated to prevent accidental code modifications
  - Use `--all` flag to enable risky fixers explicitly
