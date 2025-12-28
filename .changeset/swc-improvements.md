---
"@anatolykoptev/krolik-cli": minor
---

## SWC AST for Accurate Analysis

- **Architecture analyzer**: Uses SWC AST instead of regex for import detection
- Properly skips type-only imports and re-exports
- Architecture score improved from 35 → 70

## Duplicate Detection Improvements

- Fixed false positives for arrow functions in object literals
- Duplicates reduced from 33 → 0

## New Features

- XML optimization with 4 levels for AI context
- Context modes: --minimal, --quick, --deep
- Library docs caching via Context7
- Updated README with new commands
