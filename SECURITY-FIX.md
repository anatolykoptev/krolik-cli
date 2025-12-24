# Path Traversal Security Fix

## Summary

Fixed path traversal vulnerability in `krolik fix` command that allowed user-provided paths to escape the project root directory.

## Vulnerability

**Location:** `src/commands/fix/analyze.ts` lines 56-74

**Issue:** User-provided paths via `options.path` were not validated before use, allowing path traversal attacks:

```typescript
// BEFORE (vulnerable)
const targetPath = options.path
  ? path.isAbsolute(options.path)
    ? options.path
    : path.join(projectRoot, options.path)
  : projectRoot;
```

**Attack vectors:**
- `krolik fix --path="../../../etc/passwd"`
- `krolik fix --path="/etc/passwd"`
- `krolik fix --path="src/../../../../../../etc/passwd"`
- Symlinks pointing outside project root

## Fix

### 1. Created new security utility

**File:** `src/commands/fix/core/path-utils.ts`

```typescript
export function validatePathWithinProject(
  projectRoot: string,
  targetPath: string
): PathValidationResult {
  const resolvedRoot = path.resolve(projectRoot);
  const resolved = path.resolve(projectRoot, targetPath);
  const relative = path.relative(resolvedRoot, resolved);

  // Prevent path traversal
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    return {
      valid: false,
      resolved,
      error: `Path "${targetPath}" escapes project root`
    };
  }

  // Prevent symlink attacks
  try {
    const stats = fs.lstatSync(resolved);
    if (stats.isSymbolicLink()) {
      return {
        valid: false,
        resolved,
        error: `Symlinks are not allowed: "${targetPath}"`
      };
    }
  } catch {
    // File doesn't exist yet, that's ok
  }

  return { valid: true, resolved };
}
```

### 2. Updated analyze.ts

**File:** `src/commands/fix/analyze.ts`

```typescript
// AFTER (secure)
let targetPath: string;

if (options.path) {
  const validation = validatePathWithinProject(projectRoot, options.path);
  if (!validation.valid) {
    throw new Error(validation.error);
  }
  targetPath = validation.resolved;
} else {
  targetPath = projectRoot;
}
```

### 3. Exported from core module

**File:** `src/commands/fix/core/index.ts`

```typescript
export {
  validatePathWithinProject,
  type PathValidationResult,
} from './path-utils';
```

## Testing

**File:** `tests/commands/fix/core/path-utils.test.ts`

- 14 test cases covering:
  - Valid paths (relative, absolute, nested, current directory)
  - Path traversal attacks (`..`, `../../..`, absolute paths)
  - Edge cases (empty path, multiple slashes, trailing slashes)
  - Path normalization (`.`, `..` within project)

**Test results:** All 14 tests passed ✓

```bash
cd krolik-cli
pnpm test tests/commands/fix/core/path-utils.test.ts
```

## Impact

**Before:**
- Attackers could read/write files outside project directory
- Symlink attacks possible
- No validation of user-provided paths

**After:**
- All user paths validated against project root
- Path traversal attempts rejected with clear error
- Symlinks detected and rejected
- Secure path resolution using Node.js `path.resolve` + `path.relative`

## Files Changed

1. `src/commands/fix/core/path-utils.ts` (NEW) - Security validation utility
2. `src/commands/fix/analyze.ts` (MODIFIED) - Apply validation before using user paths
3. `src/commands/fix/core/index.ts` (MODIFIED) - Export new utility
4. `tests/commands/fix/core/path-utils.test.ts` (NEW) - Unit tests

## Build Status

✓ Build successful
✓ All tests pass (14/14)
✓ No TypeScript errors
✓ No linting errors

---

**Date:** 2025-12-23
**Severity:** High (Path Traversal)
**Status:** Fixed ✓
