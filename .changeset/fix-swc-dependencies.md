---
"@anatolykoptev/krolik-cli": patch
---

### Fix: Critical dependency issue for new installations

**CRITICAL FIX**: Previously, new users installing `krolik-cli` globally would get runtime errors:
```
Cannot find module '@swc/core'
```

This happened because `@swc/core` was incorrectly placed in `devDependencies` instead of `dependencies`, even though it's used at runtime for AST parsing.

**Changes:**
- Move `@swc/core` from `devDependencies` to `dependencies`
- Remove `@swc/core-darwin-arm64` (platform-specific, auto-installed by `@swc/core`)
- Remove unused `ora` dependency
- Add `@swc/core` to `pnpm.onlyBuiltDependencies` for proper native module compilation
