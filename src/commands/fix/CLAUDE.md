# Fix Command — Fixer Development Guide

> `krolik fix` — auto-fix code quality issues

## Structure

```
fix/
├── core/         # Infrastructure (types, registry, runner, cache, AST pool)
├── fixers/       # ⭐ ADD NEW FIXERS HERE
├── analyzers/    # Analysis functions
```

## Core Modules

```typescript
import { fileCache } from '../core/file-cache';
import { withSourceFile } from '../core/ast-pool';
import { isInsideString } from '../core/string-utils';
import { validatePathWithinProject } from '../core/path-utils';

// File I/O: use cache
const content = fileCache.get(filepath);
fileCache.set(filepath, newContent);

// AST: use pool (auto-cleanup)
const count = withSourceFile(content, 'temp.ts', sf => sf.getFunctions().length);

// Context: check strings/comments
if (isInsideString(line, index)) return;

// Security: validate user paths
const { valid, resolved } = validatePathWithinProject(root, userPath);
```

## Creating a Fixer

### 1. Create `fixers/<name>/index.ts`

```typescript
import { registry } from "../../core/registry";
import type { Fixer, QualityIssue, FixOperation } from "../../core/types";

const metadata = {
  id: "my-fixer",
  name: "My Fixer",
  description: "Fixes something",
  category: "lint",           // lint | type-safety | complexity | hardcoded | srp
  difficulty: "trivial",      // trivial | safe | risky
  cliFlag: "--fix-my-fixer",
} as const;

const fixer: Fixer = {
  metadata,

  analyze(content: string, file: string): QualityIssue[] {
    // Return issues with fixerId: metadata.id
    return [];
  },

  fix(issue: QualityIssue, content: string): FixOperation | null {
    return { action: "delete-line", file: issue.file, line: issue.line };
  },

  shouldSkip(issue: QualityIssue): boolean {
    return issue.file.includes(".test.");
  },
};

registry.register(fixer);
export default fixer;
```

### 2. Register in `fixers/index.ts`

```typescript
import "./my-fixer";
```

### 3. Verify

```bash
pnpm build && ./dist/bin/cli.js fix --list-fixers
```

## Fix Operations

| Action | Use |
|--------|-----|
| `delete-line` | Remove line |
| `replace-line` | Replace line |
| `replace-range` | Replace text range |
| `insert-before/after` | Insert line |
| `extract-function` | Extract to function |
| `split-file` | Split file |

## Difficulty Levels

| Level | Auto-apply | Examples |
|-------|------------|----------|
| trivial | Yes | console, debugger, alert |
| safe | Review | any→unknown, @ts-ignore |
| risky | Manual | SRP split, refactor |

## Best Practices

```typescript
fileCache.get(path);                    // ✅ Cached (not fs.readFileSync)
withSourceFile(content, name, fn);      // ✅ Pooled (not new Project)
!isInsideString(line, idx) && check();  // ✅ Context-aware
validatePathWithinProject(root, path);  // ✅ Secure paths
```

## Checklist

**Fixer:**
- [ ] `analyze()` returns issues with `fixerId: metadata.id`
- [ ] `fix()` returns `FixOperation | null`
- [ ] Uses `fileCache.get()` not `fs.readFileSync()`
- [ ] Uses `withSourceFile()` not `new Project()`
- [ ] Checks `isInsideString/Comment()` before fixing
- [ ] Validates user paths with `validatePathWithinProject()`

**Registration:**
- [ ] Imported in `fixers/index.ts`
- [ ] Visible in `--list-fixers`

**Tests:**
- [ ] Tests in `tests/commands/fix/fixers/<name>.test.ts`
- [ ] Tests `analyze()` and `fix()`
