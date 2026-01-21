# Конкретные улучшения для `krolik refactor`

## Текущая архитектура (что уже есть)

```
refactor/
├── analyzers/
│   ├── core/duplicates/          # Обнаружение дубликатов функций
│   │   ├── analyzer.ts            # Оркестратор (4 стратегии)
│   │   ├── strategies/            # Name, Body, Structural, Semantic
│   │   └── similarity.ts          # Подсчет схожести
│   ├── modules/                   # Registry-based analyzers
│   │   ├── duplicates.analyzer.ts # Wrapper для core
│   │   ├── recommendations.analyzer.ts
│   │   ├── architecture.analyzer.ts
│   │   └── ... (11 анализаторов)
│   └── metrics/
│       └── recommendations.ts     # Генерация рекомендаций
└── runner/
    └── analysis.ts                # Оркестратор выполнения
```

## Что мультиагенты нашли, а krolik пропустил

| # | Категория | Проблема | Почему пропущено |
|---|-----------|----------|------------------|
| 1 | Data bugs | Duplicate array item | Анализирует код, не данные |
| 2 | Dead code | Unused imports | Фокус на дубликатах |
| 3 | File system | .bak files | Игнорирует не-.ts файлы |
| 4 | Type safety | `any` types | Нет TS type analysis |
| 5 | Magic numbers | Hardcoded 2000ms | Нет семантического понимания |
| 6 | Accessibility | Empty alt text | Не анализирует JSX атрибуты |
| 7 | React perf | Missing memo | Нет React-специфичной логики |

---

## Предлагаемые улучшения (БЕЗ флагов)

### **Принцип:** Встроить новые проверки в существующие анализаторы или добавить новые анализаторы в registry

---

## Улучшение 1: Data Validation Analyzer (P0)

**Файл:** `src/commands/refactor/analyzers/modules/data-validation.analyzer.ts` (новый)

**Что проверяет:**
- Дубликаты в const массивах (по id/title/name)
- Противоречивые данные (разные emails, URLs)
- Пропущенные обязательные поля

**Интеграция:**
```typescript
// analyzers/modules/data-validation.analyzer.ts
import type { Analyzer } from '../registry';

interface DataIssue {
  file: string;
  line: number;
  type: 'duplicate-item' | 'inconsistent-data' | 'missing-field';
  message: string;
  severity: 'error' | 'warning';
}

export const dataValidationAnalyzer: Analyzer<DataIssue[]> = {
  metadata: {
    id: 'data-validation',
    name: 'Data Validation',
    description: 'Validates data consistency in const arrays',
    defaultEnabled: true,
  },

  shouldRun(ctx) {
    return true; // Always run
  },

  async analyze(ctx) {
    const { sourcePaths } = ctx;
    const issues: DataIssue[] = [];

    for (const sourcePath of sourcePaths) {
      const files = await findFiles(sourcePath, {
        extensions: ['.ts', '.tsx'],
        skipDirs: ['node_modules', 'dist'],
      });

      for (const file of files) {
        const content = readFile(file);
        if (!content) continue;

        // Parse with SWC to get AST
        const ast = parseWithSwc(content, file);

        // Find const array declarations
        const arrays = findConstArrays(ast);

        for (const arr of arrays) {
          // Check for duplicate items (by id, title, name, etc.)
          const duplicates = findDuplicateArrayItems(arr);
          for (const dup of duplicates) {
            issues.push({
              file,
              line: dup.line,
              type: 'duplicate-item',
              message: `Duplicate item with ${dup.field}="${dup.value}"`,
              severity: 'error',
            });
          }

          // Check for inconsistencies (e.g., different emails)
          const inconsistencies = findInconsistentData(arr);
          for (const inc of inconsistencies) {
            issues.push({
              file,
              line: inc.line,
              type: 'inconsistent-data',
              message: inc.message,
              severity: 'warning',
            });
          }
        }
      }
    }

    return {
      status: 'success',
      data: issues,
    };
  },
};

// Helper: Find duplicate array items
function findDuplicateArrayItems(arrayNode: ArrayNode): DuplicateItem[] {
  const seen = new Map<string, { line: number; field: string; value: any }>();
  const duplicates: DuplicateItem[] = [];

  for (const item of arrayNode.elements) {
    if (!item || item.type !== 'ObjectExpression') continue;

    // Extract key fields (id, title, name)
    const keyFields = ['id', 'title', 'name', 'email'];

    for (const field of keyFields) {
      const value = getObjectProperty(item, field);
      if (!value) continue;

      const key = `${field}:${JSON.stringify(value)}`;
      const existing = seen.get(key);

      if (existing) {
        duplicates.push({
          line: item.loc.start.line,
          field,
          value,
          originalLine: existing.line,
        });
      } else {
        seen.set(key, { line: item.loc.start.line, field, value });
      }
    }
  }

  return duplicates;
}

// Helper: Find inconsistent data patterns
function findInconsistentData(arrayNode: ArrayNode): Inconsistency[] {
  const issues: Inconsistency[] = [];
  const emailPattern = /email|mail|contact/i;

  // Track all email-like fields
  const emails = new Set<string>();

  for (const item of arrayNode.elements) {
    if (!item || item.type !== 'ObjectExpression') continue;

    for (const prop of item.properties) {
      if (prop.key.type === 'Identifier' && emailPattern.test(prop.key.name)) {
        const value = extractLiteralValue(prop.value);
        if (value && typeof value === 'string' && value.includes('@')) {
          emails.add(value);
        }
      }
    }
  }

  // Warn if multiple different emails/domains
  if (emails.size > 1) {
    issues.push({
      line: arrayNode.loc.start.line,
      message: `Inconsistent emails found: ${[...emails].join(', ')}`,
    });
  }

  return issues;
}
```

**Регистрация:**
```typescript
// analyzers/modules/index.ts
import { dataValidationAnalyzer } from './data-validation.analyzer';

// Phase 2: Independent analyzers
analyzerRegistry.register(dataValidationAnalyzer);
```

**Вывод:**
```typescript
// output/sections/data-validation.section.ts
export const dataValidationSection: Section = {
  metadata: {
    id: 'data-validation',
    order: 67, // After i18n, before API
    requires: ['data-validation'],
  },

  shouldRender(ctx) {
    const result = ctx.results.get('data-validation');
    return result?.status === 'success' && result.data.length > 0;
  },

  render(lines, ctx) {
    const result = ctx.results.get('data-validation');
    if (!result || result.status !== 'success') return;

    const issues = result.data as DataIssue[];
    const errors = issues.filter(i => i.severity === 'error');
    const warnings = issues.filter(i => i.severity === 'warning');

    lines.push(`<data-validation errors="${errors.length}" warnings="${warnings.length}">`);

    for (const issue of errors) {
      lines.push(`  <error file="${escapeXml(issue.file)}" line="${issue.line}">`);
      lines.push(`    <type>${issue.type}</type>`);
      lines.push(`    <message>${escapeXml(issue.message)}</message>`);
      lines.push(`  </error>`);
    }

    for (const issue of warnings) {
      lines.push(`  <warning file="${escapeXml(issue.file)}" line="${issue.line}">`);
      lines.push(`    <message>${escapeXml(issue.message)}</message>`);
      lines.push(`  </warning>`);
    }

    lines.push(`</data-validation>`);
  },
};
```

---

## Улучшение 2: Dead Code Analyzer (P0)

**Файл:** `src/commands/refactor/analyzers/modules/dead-code.analyzer.ts` (новый)

**Что проверяет:**
- Unused imports
- Unused variables
- Unreachable code

**Подход:** Использовать TypeScript Compiler API

```typescript
// analyzers/modules/dead-code.analyzer.ts
import ts from 'typescript';

interface DeadCodeIssue {
  file: string;
  line: number;
  type: 'unused-import' | 'unused-variable' | 'unreachable-code';
  identifier: string;
}

export const deadCodeAnalyzer: Analyzer<DeadCodeIssue[]> = {
  metadata: {
    id: 'dead-code',
    name: 'Dead Code Detection',
    description: 'Detects unused imports, variables, and unreachable code',
    defaultEnabled: true,
  },

  shouldRun(ctx) {
    return true;
  },

  async analyze(ctx) {
    const { sourcePaths, projectRoot } = ctx;
    const issues: DeadCodeIssue[] = [];

    // Use TypeScript Compiler API for accurate detection
    const configPath = ts.findConfigFile(projectRoot, ts.sys.fileExists, 'tsconfig.json');
    if (!configPath) {
      return { status: 'skipped', error: 'No tsconfig.json found' };
    }

    const { config } = ts.readConfigFile(configPath, ts.sys.readFile);
    const { options, fileNames } = ts.parseJsonConfigFileContent(
      config,
      ts.sys,
      projectRoot,
    );

    // Create program
    const program = ts.createProgram(fileNames, options);
    const checker = program.getTypeChecker();

    for (const sourceFile of program.getSourceFiles()) {
      if (sourceFile.isDeclarationFile) continue;
      if (!fileNames.includes(sourceFile.fileName)) continue;

      // Visit each node
      ts.forEachChild(sourceFile, function visit(node) {
        // Check for unused imports
        if (ts.isImportDeclaration(node)) {
          const importClause = node.importClause;
          if (!importClause) return;

          // Named imports
          if (importClause.namedBindings && ts.isNamedImports(importClause.namedBindings)) {
            for (const element of importClause.namedBindings.elements) {
              const symbol = checker.getSymbolAtLocation(element.name);
              if (symbol) {
                const usages = findSymbolUsages(sourceFile, symbol, checker);
                if (usages.length === 0) {
                  issues.push({
                    file: sourceFile.fileName,
                    line: ts.getLineAndCharacterOfPosition(sourceFile, element.pos).line + 1,
                    type: 'unused-import',
                    identifier: element.name.text,
                  });
                }
              }
            }
          }
        }

        // Check for unused variables
        if (ts.isVariableDeclaration(node)) {
          const symbol = checker.getSymbolAtLocation(node.name);
          if (symbol) {
            const usages = findSymbolUsages(sourceFile, symbol, checker);
            if (usages.length === 0) {
              issues.push({
                file: sourceFile.fileName,
                line: ts.getLineAndCharacterOfPosition(sourceFile, node.pos).line + 1,
                type: 'unused-variable',
                identifier: node.name.getText(),
              });
            }
          }
        }

        ts.forEachChild(node, visit);
      });
    }

    return {
      status: 'success',
      data: issues,
    };
  },
};

// Helper: Find all usages of a symbol
function findSymbolUsages(
  sourceFile: ts.SourceFile,
  symbol: ts.Symbol,
  checker: ts.TypeChecker,
): ts.Node[] {
  const usages: ts.Node[] = [];

  function visit(node: ts.Node) {
    if (ts.isIdentifier(node)) {
      const nodeSymbol = checker.getSymbolAtLocation(node);
      if (nodeSymbol === symbol) {
        usages.push(node);
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return usages;
}
```

**АЛЬТЕРНАТИВА (быстрая):** Интеграция с Biome

```typescript
// Вызвать biome check и парсить вывод
import { execSync } from 'child_process';

export const deadCodeAnalyzer: Analyzer<DeadCodeIssue[]> = {
  // ...

  async analyze(ctx) {
    try {
      // Run biome check (if available)
      const result = execSync('npx @biomejs/biome check --reporter=json .', {
        cwd: ctx.projectRoot,
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      const biomeResult = JSON.parse(result);
      const issues: DeadCodeIssue[] = [];

      // Parse Biome's unused imports/variables
      for (const diagnostic of biomeResult.diagnostics || []) {
        if (diagnostic.code === 'lint/correctness/noUnusedVariables') {
          issues.push({
            file: diagnostic.file_path,
            line: diagnostic.location.start.line,
            type: 'unused-variable',
            identifier: diagnostic.message,
          });
        }
      }

      return { status: 'success', data: issues };
    } catch (error) {
      // Fallback to manual detection
      return { status: 'skipped', error: 'Biome not available' };
    }
  },
};
```

---

## Улучшение 3: File System Health Analyzer (P0)

**Файл:** `src/commands/refactor/analyzers/modules/file-system.analyzer.ts` (новый)

**Что проверяет:**
- Backup files (.bak, .tmp, .swp)
- Temp files
- .gitignore suggestions

```typescript
// analyzers/modules/file-system.analyzer.ts
interface FileSystemIssue {
  type: 'backup-file' | 'temp-file';
  file: string;
  suggestion: string;
}

const BAD_FILE_PATTERNS = [
  { pattern: /\.bak$/i, type: 'backup-file' as const, gitignore: '*.bak' },
  { pattern: /\.tmp$/i, type: 'temp-file' as const, gitignore: '*.tmp' },
  { pattern: /\.swp$/i, type: 'backup-file' as const, gitignore: '*.swp' },
  { pattern: /~$/i, type: 'backup-file' as const, gitignore: '*~' },
  { pattern: /\.orig$/i, type: 'backup-file' as const, gitignore: '*.orig' },
];

export const fileSystemAnalyzer: Analyzer<FileSystemIssue[]> = {
  metadata: {
    id: 'file-system',
    name: 'File System Health',
    description: 'Detects backup files, temp files, and suggests .gitignore updates',
    defaultEnabled: true,
  },

  shouldRun(ctx) {
    return true;
  },

  async analyze(ctx) {
    const { projectRoot } = ctx;
    const issues: FileSystemIssue[] = [];

    // Find all files (including non-.ts)
    const allFiles = await findFiles(projectRoot, {
      skipDirs: ['node_modules', 'dist', '.next', '.git'],
      // No extension filter - check ALL files
    });

    for (const file of allFiles) {
      const relativePath = path.relative(projectRoot, file);

      for (const { pattern, type, gitignore } of BAD_FILE_PATTERNS) {
        if (pattern.test(relativePath)) {
          issues.push({
            type,
            file: relativePath,
            suggestion: `Delete file and add "${gitignore}" to .gitignore`,
          });
        }
      }
    }

    return {
      status: 'success',
      data: issues,
    };
  },
};
```

---

## Улучшение 4: Расширить recommendations.ts (P1)

**Файл:** `src/commands/refactor/analyzers/metrics/recommendations.ts` (модификация)

**Добавить генераторы рекомендаций для новых анализаторов:**

```typescript
// Добавить в generateRecommendations()

export function generateRecommendations(
  analysis: RefactorAnalysis,
  archHealth: ArchHealth,
  domains: DomainInfo[],
  dataIssues?: DataIssue[],        // NEW
  deadCode?: DeadCodeIssue[],     // NEW
  fileSystem?: FileSystemIssue[], // NEW
): Recommendation[] {
  const recommendations: Recommendation[] = [];
  const priority = { value: 1 };

  // 1. Architecture violations (highest priority)
  recommendations.push(...generateArchRecommendations(archHealth, priority));

  // 2. DATA VALIDATION (NEW - Critical bugs)
  if (dataIssues) {
    recommendations.push(...generateDataValidationRecommendations(dataIssues, priority));
  }

  // 3. FILE SYSTEM HEALTH (NEW - Easy fixes)
  if (fileSystem) {
    recommendations.push(...generateFileSystemRecommendations(fileSystem, priority));
  }

  // 4. DEAD CODE (NEW - Maintainability)
  if (deadCode) {
    recommendations.push(...generateDeadCodeRecommendations(deadCode, priority));
  }

  // 5. Duplicate functions (existing)
  recommendations.push(...generateDuplicateRecommendations(analysis, priority));

  // 6. Structure issues (existing)
  recommendations.push(...generateStructureRecommendations(analysis, priority));

  // 7. Domain coherence (existing)
  recommendations.push(...generateDomainRecommendations(domains, priority));

  return recommendations;
}

// NEW: Data validation recommendations
function generateDataValidationRecommendations(
  issues: DataIssue[],
  priority: { value: number },
): Recommendation[] {
  const recommendations: Recommendation[] = [];
  const errors = issues.filter(i => i.severity === 'error');

  // Group by file
  const byFile = groupBy(errors, i => i.file);

  for (const [file, fileIssues] of byFile) {
    recommendations.push({
      id: `data-${priority.value}`,
      priority: priority.value++,
      category: 'data-integrity', // NEW category
      title: `Fix data integrity issues in ${path.basename(file)}`,
      description: `${fileIssues.length} data integrity issue(s): ${fileIssues[0].message}`,
      expectedImprovement: 10,
      effort: 'low',
      affectedFiles: [file],
      autoFixable: false, // Manual review needed
    });
  }

  return recommendations;
}

// NEW: File system recommendations
function generateFileSystemRecommendations(
  issues: FileSystemIssue[],
  priority: { value: number },
): Recommendation[] {
  const recommendations: Recommendation[] = [];

  if (issues.length === 0) return recommendations;

  // Single recommendation for all backup files
  const backupFiles = issues.filter(i => i.type === 'backup-file');
  if (backupFiles.length > 0) {
    recommendations.push({
      id: `fs-${priority.value}`,
      priority: priority.value++,
      category: 'cleanup',
      title: 'Remove backup files from repository',
      description: `${backupFiles.length} backup file(s) found`,
      expectedImprovement: 3,
      effort: 'trivial',
      affectedFiles: backupFiles.map(i => i.file),
      autoFixable: true, // Can auto-delete
    });
  }

  return recommendations;
}

// NEW: Dead code recommendations
function generateDeadCodeRecommendations(
  issues: DeadCodeIssue[],
  priority: { value: number },
): Recommendation[] {
  const recommendations: Recommendation[] = [];

  // Group by file
  const byFile = groupBy(issues, i => i.file);

  for (const [file, fileIssues] of byFile) {
    const unusedImports = fileIssues.filter(i => i.type === 'unused-import');

    if (unusedImports.length > 0) {
      recommendations.push({
        id: `dead-${priority.value}`,
        priority: priority.value++,
        category: 'cleanup',
        title: `Remove unused imports in ${path.basename(file)}`,
        description: `${unusedImports.length} unused import(s)`,
        expectedImprovement: 2,
        effort: 'trivial',
        affectedFiles: [file],
        autoFixable: true, // Can auto-remove
      });
    }
  }

  return recommendations;
}
```

---

## Улучшение 5: Интеграция новых анализаторов в runner (P1)

**Файл:** `src/commands/refactor/runner/registry-runner.ts` (модификация)

**Передать результаты новых анализаторов в recommendations:**

```typescript
// В runRegistryAnalysis(), после получения результатов:

const dataValidationResult = analyzerResults.get('data-validation');
const deadCodeResult = analyzerResults.get('dead-code');
const fileSystemResult = analyzerResults.get('file-system');

// Pass to recommendations analyzer via context options
ctx.options.dataIssues = dataValidationResult?.status === 'success'
  ? dataValidationResult.data
  : undefined;

ctx.options.deadCode = deadCodeResult?.status === 'success'
  ? deadCodeResult.data
  : undefined;

ctx.options.fileSystem = fileSystemResult?.status === 'success'
  ? fileSystemResult.data
  : undefined;

// Run recommendations analyzer (will now include new categories)
const recommendationsResult = await recommendationsAnalyzer.analyze(ctx);
```

---

## Улучшение 6: Обновить типы (P1)

**Файл:** `src/commands/refactor/core/types-ai.ts` (модификация)

```typescript
// Добавить новые категории рекомендаций
export type RecommendationCategory =
  | 'architecture'
  | 'duplication'
  | 'structure'
  | 'naming'
  | 'documentation'
  | 'data-integrity'  // NEW
  | 'cleanup';        // NEW

// Добавить новые типы effort
export type RecommendationEffort =
  | 'trivial'   // NEW: < 5 min
  | 'low'       // 5-30 min
  | 'medium'    // 30-120 min
  | 'high';     // > 120 min
```

---

## Итоговая структура после улучшений

```
refactor/
├── analyzers/
│   ├── modules/
│   │   ├── duplicates.analyzer.ts         (existing)
│   │   ├── recommendations.analyzer.ts    (existing - updated)
│   │   ├── data-validation.analyzer.ts    ← NEW
│   │   ├── dead-code.analyzer.ts          ← NEW
│   │   ├── file-system.analyzer.ts        ← NEW
│   │   └── index.ts                       (updated registration)
│   └── metrics/
│       └── recommendations.ts             (updated generators)
└── output/
    └── sections/
        ├── data-validation.section.ts     ← NEW
        ├── dead-code.section.ts           ← NEW
        ├── file-system.section.ts         ← NEW
        └── modules.ts                     (updated registration)
```

---

## Приоритеты реализации

| Priority | Analyzer | Effort | Impact | LOC | Files |
|----------|----------|--------|--------|-----|-------|
| **P0** | Data Validation | Low | High | ~200 | 2 |
| **P0** | File System Health | Trivial | Medium | ~80 | 2 |
| **P0** | Dead Code (via Biome) | Trivial | High | ~50 | 2 |
| **P1** | Dead Code (via TS API) | Medium | High | ~150 | 2 |
| **P1** | Update recommendations | Low | - | ~100 | 1 |
| **P1** | Update types | Trivial | - | ~10 | 1 |

**Итого:** ~590 LOC, 8 файлов (2 новых, 6 модифицированных)

---

## Ожидаемый результат

**До улучшений:**
```xml
<refactor-analysis>
  <duplicates functions="5" types="0" />
  <recommendations count="5" auto-fixable="5" />
</refactor-analysis>
```

**После улучшений:**
```xml
<refactor-analysis>
  <duplicates functions="5" types="0" />

  <!-- NEW -->
  <data-validation errors="1" warnings="1">
    <error file="SolutionSection.tsx" line="14">
      <message>Duplicate item with title="Holds space"</message>
    </error>
  </data-validation>

  <!-- NEW -->
  <file-system issues="3">
    <backup-file>CTASection.tsx.bak</backup-file>
    <backup-file>FeatureGrid.tsx.bak</backup-file>
    <backup-file>HowItWorks.tsx.bak</backup-file>
  </file-system>

  <!-- NEW -->
  <dead-code unused-imports="6" unused-variables="0">
    <unused-import file="IndividualsContent.tsx" line="7">Check</unused-import>
    <unused-import file="FeatureGrid.tsx" line="5">Clock, Sparkles</unused-import>
  </dead-code>

  <!-- UPDATED with new categories -->
  <recommendations count="14" auto-fixable="11">
    <recommendation priority="1" category="data-integrity">
      <title>Fix data integrity issues in SolutionSection.tsx</title>
    </recommendation>
    <recommendation priority="2" category="cleanup" auto-fixable="true">
      <title>Remove backup files from repository</title>
    </recommendation>
    <recommendation priority="3" category="cleanup" auto-fixable="true">
      <title>Remove unused imports in IndividualsContent.tsx</title>
    </recommendation>
    <!-- ... existing duplication recommendations ... -->
  </recommendations>
</refactor-analysis>
```

---

## Метрики успеха

| Метрика | До | После | Улучшение |
|---------|----|----|-----------|
| Найдено категорий проблем | 4 | 7 | +75% |
| Рекомендаций | 5 | 14+ | +180% |
| Auto-fixable | 5 | 11+ | +120% |
| Coverage vs мультиагенты | 43% | 95%+ | +52% |
| Время выполнения | ~3s | ~4-5s | +1-2s |

---

## Следующие шаги

### Фаза 1: Quick Wins (1-2 дня)
1. Создать `file-system.analyzer.ts` + section
2. Создать `dead-code.analyzer.ts` (Biome integration) + section
3. Зарегистрировать в `modules/index.ts` и `sections/modules.ts`

### Фаза 2: Data Validation (2-3 дня)
4. Создать `data-validation.analyzer.ts` + helpers
5. Создать `data-validation.section.ts`
6. Добавить unit tests

### Фаза 3: Recommendations (1 день)
7. Обновить `metrics/recommendations.ts` с новыми генераторами
8. Обновить `types-ai.ts` с новыми категориями
9. Обновить `registry-runner.ts` для передачи данных

### Фаза 4: Testing & Docs (1 день)
10. Добавить интеграционные тесты
11. Обновить CLAUDE.md с примерами
12. Запустить на atherapist-landing для валидации

**Итого:** ~5-7 дней работы

---

## Альтернативные подходы (НЕ рекомендую)

### ❌ Подход 1: Добавить флаги
```bash
krolik refactor --with-data-validation --with-dead-code
```
**Минус:** Усложняет UX, пользователь должен знать о каждом флаге.

### ❌ Подход 2: Новая команда
```bash
krolik validate  # Вместо refactor
```
**Минус:** Дублирование функциональности, раздробленность.

### ✅ Подход 3: Встроить в refactor (РЕКОМЕНДУЕТСЯ)
```bash
krolik refactor  # Все проверки включены по умолчанию
```
**Плюс:** Простота, все работает из коробки.

---

## Вопросы для обсуждения

1. **Dead Code Detection:** Использовать Biome (быстро, но нужна зависимость) или TS Compiler API (медленно, но точно)?
   - **Рекомендация:** Попробовать Biome сначала, fallback на TS API.

2. **Data Validation:** Какие паттерны данных проверять помимо дубликатов?
   - ID sequences?
   - Required fields?
   - Data types consistency?

3. **Performance:** Допустимо ли увеличение времени с 3s до 5s?
   - **Рекомендация:** Да, для полного анализа приемлемо.

4. **Auto-fix:** Разрешить автоматическое удаление backup файлов и unused imports?
   - **Рекомендация:** Да, с --dry-run по умолчанию для preview.
