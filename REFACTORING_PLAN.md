# Refactoring Plan: Fix + Quality Commands

> Цель: Объединить quality в fix, устранить дублирование, улучшить структуру
> Уровень качества: Выше Airbnb

## Обнаруженные проблемы

### 1. Дублирование кода (CRITICAL)

| Паттерн | Quality | Fix | Решение |
|---------|---------|-----|---------|
| Hardcoded patterns | `analyzers/hardcoded.ts` | `strategies/hardcoded/constants.ts` | → `src/lib/patterns/hardcoded.ts` |
| Lint keywords | `analyzers/lint-rules.ts` | `strategies/lint/constants.ts` | → `src/lib/patterns/lint.ts` |
| Complexity logic | `analyzers/complexity.ts` | `strategies/complexity/patterns.ts` | → `src/lib/analysis/complexity.ts` |
| CLI detection | `analyzers/lint-rules.ts` | `fix/context.ts` | → `src/lib/context/file-context.ts` |

### 2. Нарушение размера файлов (> 200 строк)

| Файл | Строки | Проблема |
|------|--------|----------|
| `complexity.ts` | 515 | SRP: AST + split suggestions + thresholds |
| `lint-rules.ts` | 308 | SRP: detection + CLI context + skip logic |
| `biome.ts` | 487 | SRP: config + runner + parser |
| `typescript.ts` | 367 | SRP: runner + parser + formatter |
| `hardcoded.ts` | 236 | Граничный случай |

### 3. Несогласованность подходов

- Quality: inline issues objects
- Fix: factory pattern (createDeleteLine, etc.)
- Нужно: единый подход через factories

---

## План рефакторинга

### Phase 1: Создание общих паттернов в lib/

**Новые файлы:**

```
src/lib/patterns/
├── index.ts           # Re-exports
├── lint.ts            # CONSOLE_PATTERNS, DEBUGGER_PATTERNS, ALERT_PATTERNS
├── hardcoded.ts       # MAGIC_NUMBER_PATTERNS, URL_PATTERNS, COLOR_PATTERNS
├── complexity.ts      # COMPLEXITY_SYNTAX_KINDS, COMPLEXITY_OPERATORS
└── types.ts           # Pattern interfaces
```

**Содержание lint.ts:**
```typescript
/** Lint patterns - single source of truth */
export const LINT_PATTERNS = {
  console: /\bconsole\s*\.\s*(log|warn|error|info|debug|trace|table|dir|group|groupEnd|time|timeEnd)\s*\(/g,
  debugger: /\bdebugger\b/g,
  alert: /\b(alert|confirm|prompt)\s*\(/g,
} as const;

export const LINT_SKIP_FILES = [
  /\.config\.(js|ts|mjs|cjs)$/,
  /webpack\..*\.js$/,
  /vite\.config/,
  // etc.
];
```

### Phase 2: Создание общего контекста в lib/

**Новые файлы:**

```
src/lib/context/
├── index.ts           # Re-exports
├── file-context.ts    # FileContext interface + builders
├── project-context.ts # ProjectContext for monorepo
└── detectors.ts       # isCliFile, isTestFile, isConfigFile
```

**FileContext interface:**
```typescript
export interface FileContext {
  /** Absolute path */
  path: string;
  /** Relative to project root */
  relativePath: string;
  /** File type */
  type: 'component' | 'hook' | 'util' | 'api' | 'config' | 'test' | 'cli' | 'unknown';
  /** Should skip lint checks */
  skipLint: boolean;
  /** Should skip console checks */
  skipConsole: boolean;
  /** Is test file */
  isTest: boolean;
  /** Is CLI file */
  isCli: boolean;
}
```

### Phase 3: Рефакторинг качественных анализаторов

**Цель:** Вынести общую логику, оставить чистые анализаторы

#### 3.1 Complexity analyzer split

```
src/commands/quality/analyzers/complexity/
├── index.ts           # Main analyzer export
├── calculator.ts      # calculateComplexity() - use lib/patterns/complexity
├── suggestions.ts     # Split suggestions logic
└── types.ts           # ComplexityResult, etc.
```

#### 3.2 Lint analyzer split

```
src/commands/quality/analyzers/lint/
├── index.ts           # Main analyzer
├── checkers.ts        # Check functions - use lib/patterns/lint
└── skip-logic.ts      # Use lib/context/detectors
```

#### 3.3 Hardcoded analyzer split

```
src/commands/quality/analyzers/hardcoded/
├── index.ts           # Main analyzer
├── detection.ts       # Use lib/patterns/hardcoded
└── skip-logic.ts      # Skip rules for numbers/URLs
```

### Phase 4: Рефакторинг fix стратегий

**Цель:** Использовать общие паттерны из lib/

#### 4.1 Update imports

Все стратегии должны импортировать из `@patterns/`:
```typescript
// Before
import { CONSOLE_KEYWORDS } from './constants';

// After
import { LINT_PATTERNS } from '@patterns/lint';
```

#### 4.2 Удалить дубликаты

- `strategies/lint/constants.ts` → удалить, использовать `@patterns/lint`
- `strategies/hardcoded/constants.ts` → частично удалить, использовать `@patterns/hardcoded`
- `strategies/complexity/patterns.ts` → удалить, использовать `@patterns/complexity`

### Phase 5: Объединение quality в fix

**Цель:** `fix --analyze-only` полностью заменяет `quality`

#### 5.1 Структура нового fix/

```
src/commands/fix/
├── index.ts           # Main orchestrator
├── cli.ts             # CLI options (уже в bin/cli.ts)
├── types.ts           # All types
├── context.ts         # Build fix context - use lib/context
├── analyze.ts         # Analysis step (from quality) - NEW
├── plan.ts            # Fix planning step - NEW
├── apply.ts           # Apply fixes step
├── output.ts          # Format output - use quality formatters
├── strategies/        # Fix strategies (keep)
└── refactorings/      # Refactoring operations (keep)
```

#### 5.2 Переместить из quality в fix

```
quality/analyzers/*.ts → используются через analyze.ts
quality/formatters/*   → fix/output.ts (или оставить в quality как shared)
quality/recommendations/* → fix/recommendations/ (или lib/)
```

### Phase 6: Split biome.ts и typescript.ts

#### 6.1 biome.ts → biome/

```
src/commands/fix/strategies/shared/biome/
├── index.ts           # Re-exports
├── config.ts          # Biome config detection
├── runner.ts          # Run biome command
├── parser.ts          # Parse biome output
└── types.ts           # BiomeResult, etc.
```

#### 6.2 typescript.ts → typescript/

```
src/commands/fix/strategies/shared/typescript/
├── index.ts           # Re-exports
├── runner.ts          # Run tsc --noEmit
├── parser.ts          # Parse TypeScript errors
├── formatter.ts       # Format errors for output
└── types.ts           # TypeCheckResult, etc.
```

---

## Приоритет выполнения

| # | Фаза | Файлы | Приоритет | Риск |
|---|------|-------|-----------|------|
| 1 | lib/patterns/ | 5 новых | HIGH | LOW |
| 2 | lib/context/ | 4 новых | HIGH | LOW |
| 3.1 | complexity/ split | 4 файла | MEDIUM | MEDIUM |
| 3.2 | lint/ split | 3 файла | MEDIUM | MEDIUM |
| 3.3 | hardcoded/ split | 3 файла | MEDIUM | LOW |
| 4 | Update imports | ~15 файлов | MEDIUM | MEDIUM |
| 5 | fix/analyze.ts | 2 файла | HIGH | LOW |
| 6.1 | biome/ split | 5 файлов | LOW | LOW |
| 6.2 | typescript/ split | 5 файлов | LOW | LOW |

---

## Критерии успеха

1. **Нет дублирования**: Все паттерны в одном месте
2. **Размер файлов**: Ни один файл > 200 строк
3. **Тесты проходят**: Существующий функционал работает
4. **Build успешен**: `pnpm build` без ошибок
5. **CLI работает**: `krolik fix --analyze-only` и `krolik fix --dry-run`

---

## Estimated Impact

- **Lines removed**: ~500 (дубликаты)
- **Lines added**: ~300 (новые модули)
- **Net**: -200 строк
- **Файлов создано**: ~20
- **Файлов удалено/merged**: ~5

---

## Порядок выполнения (детальный)

### Step 1: Create lib/patterns/
```bash
mkdir -p src/lib/patterns
# Create: index.ts, lint.ts, hardcoded.ts, complexity.ts, types.ts
```

### Step 2: Create lib/context/
```bash
mkdir -p src/lib/context
# Create: index.ts, file-context.ts, project-context.ts, detectors.ts
```

### Step 3: Migrate quality analyzers
```bash
# Split complexity.ts → complexity/
# Split lint-rules.ts → lint/
# Split hardcoded.ts → hardcoded/
# Update imports to use lib/patterns and lib/context
```

### Step 4: Update fix strategies
```bash
# Update imports in all strategies
# Remove duplicate constants files
```

### Step 5: Create fix/analyze.ts
```bash
# Move quality analysis logic into fix command
# Ensure fix --analyze-only works correctly
```

### Step 6: Split large shared utilities
```bash
# biome.ts → biome/
# typescript.ts → typescript/
```

### Step 7: Final verification
```bash
pnpm build
krolik fix --analyze-only --path src/commands
krolik fix --dry-run --path src/commands
```
