# KROLIK CLI — MVP Migration Plan

> Версия: 1.0.0 | Статус: Planning | Дата: 2025-12-21

---

## Цель MVP

Выпустить **krolik-cli** на NPM с полным функционалом базовых команд:
- `krolik status` — диагностика проекта
- `krolik schema` — анализ Prisma схемы
- `krolik routes` — анализ tRPC роутеров
- `krolik context` — генерация контекста для AI
- `krolik review` — code review

---

## Архитектура миграции

### Принципы

1. **SRP** — каждый файл ≤ 200 строк
2. **No hardcode** — всё через `KrolikConfig`
3. **DI** — `CommandContext` вместо глобалов
4. **Testable** — чистые функции, моки для shell

### Структура после миграции

```
src/
├── commands/
│   ├── status/
│   │   ├── index.ts        # Entry (30 lines)
│   │   ├── checks.ts       # Git, typecheck, lint (100 lines)
│   │   ├── todos.ts        # TODO counter (50 lines)
│   │   └── output.ts       # Formatting (60 lines)
│   ├── schema/
│   │   ├── index.ts        # Entry (30 lines)
│   │   ├── parser.ts       # Prisma parsing (120 lines)
│   │   ├── domains.ts      # Domain grouping (40 lines)
│   │   └── output.ts       # Markdown gen (80 lines)
│   ├── routes/
│   │   ├── index.ts        # Entry (30 lines)
│   │   ├── parser.ts       # tRPC parsing (100 lines)
│   │   └── output.ts       # Markdown gen (60 lines)
│   ├── context/
│   │   ├── index.ts        # Entry (30 lines)
│   │   ├── domains.ts      # Domain detection (80 lines)
│   │   ├── files.ts        # Related files (60 lines)
│   │   ├── approach.ts     # Suggested steps (50 lines)
│   │   └── output.ts       # Formatting (50 lines)
│   ├── review/
│   │   ├── index.ts        # Entry (30 lines)
│   │   ├── diff.ts         # Git diff analysis (80 lines)
│   │   ├── patterns.ts     # Security/perf patterns (100 lines)
│   │   ├── risk.ts         # Risk assessment (60 lines)
│   │   └── output.ts       # Formatters (80 lines)
│   ├── issue/
│   │   ├── index.ts        # Entry (30 lines)
│   │   ├── fetcher.ts      # GitHub API (60 lines)
│   │   ├── parser.ts       # Checklist parsing (100 lines)
│   │   └── output.ts       # Formatters (60 lines)
│   ├── security/
│   │   ├── index.ts        # Entry (30 lines)
│   │   ├── patterns.ts     # Security patterns (80 lines)
│   │   └── audit.ts        # npm audit (50 lines)
│   ├── codegen/
│   │   ├── index.ts        # Entry (30 lines)
│   │   ├── hooks.ts        # Hook generator (80 lines)
│   │   ├── schemas.ts      # Zod generator (80 lines)
│   │   ├── tests.ts        # Test generator (80 lines)
│   │   └── barrels.ts      # Barrel exports (50 lines)
│   └── init/
│       └── index.ts        # (уже готов)
├── lib/
│   ├── logger.ts           # (уже готов)
│   ├── shell.ts            # (уже готов)
│   ├── fs.ts               # (уже готов)
│   ├── git.ts              # (уже готов) + добавить diff
│   └── github.ts           # NEW: gh CLI wrapper (80 lines)
├── mcp/
│   ├── server.ts           # MCP server (100 lines)
│   ├── tools.ts            # Tool definitions (80 lines)
│   └── resources.ts        # Resource definitions (60 lines)
└── config/
    └── domains.ts          # NEW: Domain mappings (100 lines)
```

---

## Фазы миграции

### Phase 0: Подготовка (0.5 дня)
- [ ] Добавить `src/lib/github.ts` — обёртка над `gh` CLI
- [ ] Добавить `src/config/domains.ts` — маппинги доменов
- [ ] Расширить `src/lib/git.ts` — добавить `getDiff()`, `getStagedFiles()`
- [ ] Добавить типы в `src/types/commands.ts` для новых команд

### Phase 1: Status (0.5 дня) ✅ MVP
- [ ] Рефакторинг `status/index.ts` — разбить на модули
- [ ] `status/checks.ts` — git, typecheck, lint проверки
- [ ] `status/todos.ts` — подсчёт TODO/FIXME
- [ ] `status/output.ts` — форматирование вывода
- [ ] Тесты: `tests/commands/status.test.ts`

### Phase 2: Schema (0.5 дня) ✅ MVP
- [ ] `schema/parser.ts` — парсинг Prisma файлов
- [ ] `schema/domains.ts` — группировка по доменам
- [ ] `schema/output.ts` — генерация Markdown
- [ ] Тесты: `tests/commands/schema.test.ts`

### Phase 3: Routes (0.5 дня) ✅ MVP
- [ ] `routes/parser.ts` — парсинг tRPC файлов
- [ ] `routes/output.ts` — генерация Markdown
- [ ] Тесты: `tests/commands/routes.test.ts`

### Phase 4: Context (1 день) ✅ MVP
- [ ] `context/domains.ts` — определение домена по ключевым словам
- [ ] `context/files.ts` — поиск связанных файлов
- [ ] `context/approach.ts` — генерация шагов
- [ ] `context/output.ts` — форматирование
- [ ] Тесты: `tests/commands/context.test.ts`

### Phase 5: Review (1 день) ✅ MVP
- [ ] `review/diff.ts` — анализ git diff
- [ ] `review/patterns.ts` — паттерны безопасности/производительности
- [ ] `review/risk.ts` — оценка риска
- [ ] `review/output.ts` — форматтеры (text/json/md)
- [ ] Тесты: `tests/commands/review.test.ts`

### Phase 6: Issue Parser (0.5 дня)
- [ ] `issue/fetcher.ts` — получение issue через `gh` CLI
- [ ] `issue/parser.ts` — парсинг чеклистов
- [ ] `issue/output.ts` — форматтеры
- [ ] Тесты: `tests/commands/issue.test.ts`

### Phase 7: Security (0.5 дня)
- [ ] `security/patterns.ts` — паттерны безопасности
- [ ] `security/audit.ts` — интеграция с npm audit
- [ ] Тесты: `tests/commands/security.test.ts`

### Phase 8: Codegen (1 день)
- [ ] `codegen/hooks.ts` — генерация React hooks
- [ ] `codegen/schemas.ts` — генерация Zod схем
- [ ] `codegen/tests.ts` — генерация тестов
- [ ] `codegen/barrels.ts` — генерация barrel exports
- [ ] Шаблоны: `templates/hooks/*.hbs`, `templates/schemas/*.hbs`
- [ ] Тесты: `tests/commands/codegen.test.ts`

### Phase 9: MCP Server (0.5 дня)
- [ ] `mcp/server.ts` — основной сервер
- [ ] `mcp/tools.ts` — определения tools
- [ ] `mcp/resources.ts` — определения resources
- [ ] Интеграционные тесты

### Phase 10: Polish & Release (1 день)
- [ ] Полный README с примерами
- [ ] CHANGELOG.md
- [ ] GitHub Actions для CI
- [ ] Публикация на NPM

---

## Детальный план Phase 1-5 (MVP)

### Phase 1: Status Command

**Исходник:** `piternow-wt-fix/scripts/ai/status.ts` (333 lines)

**Рефакторинг:**

```typescript
// src/commands/status/checks.ts
export interface GitCheck {
  branch: string;
  hasChanges: boolean;
  ahead: number;
  behind: number;
}

export function checkGit(cwd: string): GitCheck { }
export function checkTypecheck(cwd: string): { errors: number; cached: boolean } { }
export function checkLint(cwd: string): { warnings: number; errors: number } { }
```

```typescript
// src/commands/status/todos.ts
export interface TodoCount {
  todo: number;
  fixme: number;
  hack: number;
}

export function countTodos(cwd: string, exclude: string[]): TodoCount { }
```

**Изменения от оригинала:**
- Убрать hardcoded пути → использовать `config.paths`
- Убрать глобальные imports → принимать `logger` через context
- Добавить `--json` output

---

### Phase 2: Schema Command

**Исходник:** `piternow-wt-fix/scripts/ai/schema.ts` (340 lines)

**Рефакторинг:**

```typescript
// src/commands/schema/parser.ts
export interface PrismaField {
  name: string;
  type: string;
  isOptional: boolean;
  isArray: boolean;
  default?: string;
  relation?: string;
}

export interface PrismaModel {
  name: string;
  fields: PrismaField[];
  domain?: string;
}

export function parseSchemaFile(content: string): PrismaModel[] { }
export function parseEnumFile(content: string): PrismaEnum[] { }
```

**Изменения от оригинала:**
- Путь к схеме из `config.prisma.schemaDir`
- Поддержка single-file и multi-file схем
- Чистые функции парсинга (без side effects)

---

### Phase 3: Routes Command

**Исходник:** `piternow-wt-fix/scripts/ai/routes.ts` (301 lines)

**Рефакторинг:**

```typescript
// src/commands/routes/parser.ts
export interface TrpcProcedure {
  name: string;
  type: 'query' | 'mutation' | 'subscription';
  isProtected: boolean;
  hasInput: boolean;
}

export interface TrpcRouter {
  name: string;
  file: string;
  procedures: TrpcProcedure[];
}

export function parseRouterFile(content: string, filename: string): TrpcRouter { }
```

**Изменения от оригинала:**
- Путь к роутерам из `config.trpc.routersDir`
- Regex-based parsing (без AST для простоты)

---

### Phase 4: Context Command

**Исходник:** `piternow-wt-fix/scripts/ai/context.ts` (363 lines)

**Рефакторинг:**

```typescript
// src/config/domains.ts
export const DOMAIN_KEYWORDS: Record<string, string[]> = {
  booking: ['booking', 'slot', 'availability', 'schedule', 'appointment'],
  events: ['event', 'ticket', 'venue', 'concert', 'festival'],
  places: ['place', 'business', 'location', 'venue', 'restaurant'],
  // ...
};

export const DOMAIN_FILES: Record<string, string[]> = {
  booking: [
    'packages/api/src/routers/booking.ts',
    'apps/web/components/Business/Booking/**',
    'packages/db/prisma/models/booking.prisma',
  ],
  // ...
};
```

```typescript
// src/commands/context/domains.ts
export function detectDomain(text: string): string[] { }
export function getRelatedFiles(domains: string[], projectRoot: string): string[] { }
```

**Изменения от оригинала:**
- Domain mappings вынесены в отдельный конфиг
- Файлы проверяются на существование
- Интеграция с GitHub issue через `--issue` флаг

---

### Phase 5: Review Command

**Исходник:** `piternow-wt-fix/scripts/ai/review.ts` (686 lines)

**Рефакторинг:**

```typescript
// src/commands/review/patterns.ts
export interface ReviewPattern {
  id: string;
  category: 'security' | 'performance' | 'style';
  severity: 'error' | 'warning' | 'info';
  pattern: RegExp;
  message: string;
}

export const SECURITY_PATTERNS: ReviewPattern[] = [
  { id: 'eval', category: 'security', severity: 'error', pattern: /\beval\s*\(/, message: 'Avoid eval()' },
  { id: 'innerHTML', category: 'security', severity: 'warning', pattern: /\.innerHTML\s*=/, message: 'Use textContent instead' },
  // ...
];

export function checkPatterns(content: string, patterns: ReviewPattern[]): ReviewIssue[] { }
```

```typescript
// src/commands/review/risk.ts
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export function assessRisk(changes: FileChange[], issues: ReviewIssue[]): RiskLevel { }
```

**Изменения от оригинала:**
- Паттерны вынесены в отдельный файл
- Risk assessment отдельная функция
- Поддержка `--staged`, `--pr`, `--base` флагов

---

## Тестирование

### Unit Tests

```typescript
// tests/commands/status.test.ts
import { describe, it, expect, vi } from 'vitest';
import { checkGit, checkTypecheck } from '../src/commands/status/checks';

describe('status checks', () => {
  it('parses git branch correctly', () => {
    vi.mock('../src/lib/shell', () => ({
      tryExec: () => ({ success: true, output: 'main' })
    }));

    const result = checkGit('/test');
    expect(result.branch).toBe('main');
  });
});
```

### Coverage Target

| Module | Target |
|--------|--------|
| lib/* | 90% |
| commands/status | 80% |
| commands/schema | 80% |
| commands/routes | 80% |
| commands/context | 70% |
| commands/review | 70% |

---

## CI/CD

### GitHub Actions

```yaml
# .github/workflows/ci.yml
name: CI
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'pnpm'
      - run: pnpm install
      - run: pnpm typecheck
      - run: pnpm lint
      - run: pnpm test:coverage
      - run: pnpm build
```

### Release Workflow

```yaml
# .github/workflows/release.yml
name: Release
on:
  push:
    tags:
      - 'v*'
jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          registry-url: 'https://registry.npmjs.org'
      - run: pnpm install
      - run: pnpm build
      - run: pnpm publish --access public
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

---

## Timeline

| Phase | Задача | Время |
|-------|--------|-------|
| 0 | Подготовка (lib, types) | 0.5 дня |
| 1 | Status command | 0.5 дня |
| 2 | Schema command | 0.5 дня |
| 3 | Routes command | 0.5 дня |
| 4 | Context command | 1 день |
| 5 | Review command | 1 день |
| **MVP** | **Релиз MVP** | **4 дня** |
| 6 | Issue parser | 0.5 дня |
| 7 | Security | 0.5 дня |
| 8 | Codegen | 1 день |
| 9 | MCP server | 0.5 дня |
| 10 | Polish & NPM | 1 день |
| **Full** | **Полный релиз** | **7.5 дней** |

---

## Метрики успеха MVP

| Метрика | Цель |
|---------|------|
| `krolik status --fast` | < 500ms |
| `krolik schema` | < 1s |
| `krolik routes` | < 1s |
| `krolik context` | < 2s |
| `krolik review` | < 3s |
| Test coverage | > 70% |
| Bundle size | < 100KB |
| TypeScript strict | 100% |

---

## Риски и митигации

| Риск | Вероятность | Митигация |
|------|-------------|-----------|
| Regex parsing fails | Medium | Добавить fallback, тесты на edge cases |
| gh CLI not installed | Low | Проверять наличие, показывать инструкцию |
| Monorepo paths разные | Medium | Гибкая конфигурация через `krolik.config.ts` |
| Большие файлы тормозят | Low | Streaming, лимиты |

---

## Команда

- **Maintainer:** @anatolykoptev
- **AI Assistant:** Claude (Opus 4.5)

---

*Последнее обновление: 2025-12-21*
