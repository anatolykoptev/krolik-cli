# Fix Command — AI Development Guide

> `krolik fix` — автофикс качества кода

---

## Структура

```
src/commands/fix/
├── core/                    # Инфраструктура
│   ├── types.ts            # Fixer, QualityIssue, FixOperation
│   ├── registry.ts         # FixerRegistry
│   ├── runner.ts           # runFixerAnalysis()
│   ├── file-cache.ts       # Кэш файлов (75% I/O reduction)
│   ├── ast-pool.ts         # Пул AST (no memory leaks)
│   ├── string-utils.ts     # isInsideString, isInsideComment
│   └── path-utils.ts       # validatePathWithinProject (security)
│
├── fixers/                  # ⭐ Фиксеры (ADD NEW HERE)
│   ├── console/            # --fix-console
│   ├── debugger/           # --fix-debugger
│   └── ...
│
├── strategies/              # Legacy (deprecated)
└── analyzers/               # Анализаторы
```

---

## Core Modules — Quick Reference

| Module | Import | Когда использовать |
|--------|--------|-------------------|
| `file-cache` | `fileCache.get(path)` | Вместо `fs.readFileSync()` |
| `ast-pool` | `withSourceFile(content, name, fn)` | Вместо `new Project()` |
| `string-utils` | `isInsideString(line, idx)` | Проверка контекста |
| `path-utils` | `validatePathWithinProject(root, path)` | User-provided paths |

### Примеры

```typescript
// File cache
import { fileCache } from '../core/file-cache';
const content = fileCache.get(filepath);  // Cached read
fileCache.set(filepath, newContent);       // Update cache

// AST pool (auto-cleanup)
import { withSourceFile } from '../core/ast-pool';
const count = withSourceFile(content, 'temp.ts', (sf) => sf.getFunctions().length);

// String context
import { isInsideString } from '../core/string-utils';
if (isInsideString(line, index)) return;  // Skip strings

// Path security
import { validatePathWithinProject } from '../core/path-utils';
const { valid, resolved, error } = validatePathWithinProject(root, userPath);
```

---

## Создание Fixer

### 1. Создай `fixers/<name>/index.ts`

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
    // Detect issues, return array
    // IMPORTANT: set fixerId: metadata.id
    return [];
  },

  fix(issue: QualityIssue, content: string): FixOperation | null {
    // Generate fix operation
    return { action: "delete-line", file: issue.file, line: issue.line };
  },

  shouldSkip(issue: QualityIssue): boolean {
    return issue.file.includes(".test.");
  },
};

registry.register(fixer);
export default fixer;
```

### 2. Добавь в `fixers/index.ts`

```typescript
import "./my-fixer";
```

### 3. Проверь

```bash
pnpm build && ./dist/bin/cli.js fix --list-fixers
```

---

## FixOperation Actions

| Action | Описание |
|--------|----------|
| `delete-line` | Удалить строку |
| `replace-line` | Заменить строку |
| `replace-range` | Заменить диапазон |
| `insert-before` | Вставить перед |
| `insert-after` | Вставить после |
| `extract-function` | Извлечь в функцию |
| `split-file` | Разбить файл |

---

## Difficulty Levels

| Level | Auto-apply | Примеры |
|-------|------------|---------|
| `trivial` | Yes | console, debugger, alert |
| `safe` | Review | any→unknown, @ts-ignore |
| `risky` | Manual | SRP split, refactor |

---

## Best Practices

```typescript
// ❌ BAD
fs.readFileSync(path);           // Direct I/O
new Project();                    // Memory leak
/debugger/.test(line);           // No context check
fs.readFileSync(userPath);       // Path traversal risk

// ✅ GOOD
fileCache.get(path);                              // Cached
withSourceFile(content, name, fn);                // Pooled + cleanup
!isInsideString(line, idx) && hasDebugger(line); // Context-aware
validatePathWithinProject(root, userPath);        // Secure
```

---

## Testing

```
tests/commands/fix/
├── helpers.ts              # createTestIssue, withTempFile, etc.
├── core/                   # file-cache.test.ts, registry.test.ts, ...
└── fixers/                 # console.test.ts, debugger.test.ts, ...
```

```typescript
import { createTestIssue, withTempFile } from '../helpers';

describe('myFixer', () => {
  it('detects issue', () => {
    const issues = fixer.analyze('code', 'test.ts');
    expect(issues).toHaveLength(1);
  });

  it('fixes issue', async () => {
    await withTempFile('content', (path) => {
      const op = fixer.fix(createTestIssue({ file: path }), 'content');
      expect(op?.action).toBe('delete-line');
    });
  });
});
```

---

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
- [ ] Correct difficulty level

**Tests:**
- [ ] Unit tests in `tests/commands/fix/fixers/<name>.test.ts`
- [ ] Tests analyze() and fix()
- [ ] Tests edge cases (strings, comments)

---

## Docs

| Topic | Location |
|-------|----------|
| File Cache | [core/FILE-CACHE.md](core/FILE-CACHE.md) |
| Types | [core/types.ts](core/types.ts) |
| Registry | [core/registry.ts](core/registry.ts) |

---

*Last updated: 2025-12-23*
