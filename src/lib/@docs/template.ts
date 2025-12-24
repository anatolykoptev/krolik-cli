/**
 * @module lib/@docs/template
 * @description Krolik documentation template for CLAUDE.md injection
 *
 * This template is injected into project's CLAUDE.md file to provide
 * AI assistants with up-to-date krolik CLI documentation.
 */

/**
 * Version of the documentation template
 * Increment when making breaking changes to the template
 */
export const DOCS_VERSION = '1.1.0';

/**
 * Start marker for krolik section in CLAUDE.md
 */
export const KROLIK_SECTION_START = '<!-- krolik:start -->';

/**
 * End marker for krolik section in CLAUDE.md
 */
export const KROLIK_SECTION_END = '<!-- krolik:end -->';

/**
 * Generate the krolik documentation section for CLAUDE.md
 *
 * This is an AI-optimized prompt that teaches the AI assistant
 * how to effectively use krolik CLI tools.
 */
export function generateKrolikDocs(): string {
  return `${KROLIK_SECTION_START}
<!-- version: ${DOCS_VERSION} | auto-updated by krolik CLI -->

## 🐰 Krolik AI Development Toolkit

> **ВАЖНО**: Эта секция автоматически обновляется krolik CLI. Не редактируй вручную.

### Что такое Krolik?

Krolik — это AI-ориентированный набор инструментов для разработки. Он предоставляет:
- MCP Tools для Claude Code (рекомендуется)
- CLI команды для терминала
- Автоматический анализ и фиксы кода

### 🎯 Workflow (ОБЯЗАТЕЛЬНЫЙ)

\`\`\`
1. START    → krolik_status (fast: true)      # Понять состояние проекта
2. TASK     → krolik_context (feature/issue)  # Получить контекст задачи
3. CODE     → написать код
4. REFACTOR → krolik refactor --dry-run       # Анализ структуры, дубликаты
5. AUDIT    → krolik audit                    # Полный аудит → AI-REPORT.md
6. FIX      → krolik fix --from-audit --yes   # Фиксы на основе аудита
7. REVIEW   → krolik_review --staged          # Code review перед коммитом
\`\`\`

**Важно:** Команды 4-6 — это цепочка анализа. \`refactor\` находит структурные проблемы, \`audit\` создаёт полный отчёт, \`fix --from-audit\` использует этот отчёт для умных фиксов.

### MCP Tools (ПРЕДПОЧТИТЕЛЬНО)

| Tool | Когда использовать |
|------|-------------------|
| \`mcp__krolik__krolik_status\` | **В начале каждой сессии** — git, typecheck, lint, TODOs |
| \`mcp__krolik__krolik_context\` | Перед работой над задачей — контекст для feature/issue |
| \`mcp__krolik__krolik_schema\` | При работе с БД — все Prisma модели |
| \`mcp__krolik__krolik_routes\` | При работе с API — все tRPC роутеры |
| \`mcp__krolik__krolik_review\` | После написания кода — code review |
| \`mcp__krolik__krolik_issue\` | При работе по GitHub issue |
| \`mcp__krolik__krolik_audit\` | Аудит качества кода |
| \`mcp__krolik__krolik_fix\` | Автофикс проблем |

### CLI команды

#### Диагностика
\`\`\`bash
krolik status              # Полная диагностика
krolik status --fast       # Быстрая (без typecheck/lint)
\`\`\`

#### Аудит и фиксы
\`\`\`bash
krolik audit               # Аудит → .krolik/AI-REPORT.md
krolik fix --dry-run       # Превью фиксов
krolik fix --yes           # Применить фиксы
krolik fix --safe          # Только безопасные фиксы
krolik fix --trivial       # Только trivial (console, debugger)
\`\`\`

#### Контекст
\`\`\`bash
krolik context --feature booking   # Контекст для фичи
krolik context --issue 42          # Контекст для issue
krolik context --full              # Полный контекст
\`\`\`

#### Рефакторинг (ВАЖНО!)
\`\`\`bash
krolik refactor                    # Анализ структуры модулей
krolik refactor --duplicates-only  # Только дубликаты функций
krolik refactor --types-only       # Только дубликаты типов
krolik refactor --dry-run          # Превью без изменений
krolik refactor --apply            # Применить миграции
\`\`\`

#### Анализ
\`\`\`bash
krolik schema              # Prisma модели
krolik routes              # tRPC роутеры
krolik review              # Code review
krolik review --staged     # Только staged
\`\`\`

### Категории фиксов

| Категория | Фиксеры | Уровень |
|-----------|---------|---------|
| \`lint\` | console, debugger, alert | trivial |
| \`type-safety\` | any, @ts-ignore, eval, equality | safe |
| \`complexity\` | cyclomatic complexity, long functions | safe |
| \`hardcoded\` | magic numbers, URLs | safe |
| \`srp\` | Single Responsibility нарушения | risky |

### Пресеты

\`\`\`bash
krolik fix --quick   # = --trivial --biome --typecheck
krolik fix --deep    # = --safe --biome --typecheck
krolik fix --full    # = --all --biome --typecheck --backup
\`\`\`

### Правила для AI

1. **Всегда начинай с \`krolik_status\`** — понять состояние проекта
2. **Используй \`krolik_context\`** перед работой над задачей
3. **После написания кода** — цепочка: \`refactor\` → \`audit\` → \`fix --from-audit\`
4. **Перед коммитом** — \`krolik review --staged\`
5. **Вывод по умолчанию** — AI-friendly XML, для текста: \`--text\`
6. **Для быстрых фиксов** — \`krolik fix --quick\` (без полного аудита)

${KROLIK_SECTION_END}`;
}

/**
 * Minimal CLAUDE.md template for projects without one
 */
export function generateMinimalClaudeMd(projectName: string): string {
  return `# CLAUDE.md — ${projectName}

> AI instructions for this project.

---

${generateKrolikDocs()}

---

## Project Notes

Add your project-specific instructions here.
`;
}
