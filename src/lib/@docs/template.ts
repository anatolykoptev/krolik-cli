/**
 * @module lib/@docs/template
 * @description Krolik documentation template for CLAUDE.md injection
 *
 * This template is injected into project's CLAUDE.md file to provide
 * AI assistants with up-to-date krolik CLI documentation.
 */

/** Version of the documentation template */
export const DOCS_VERSION = '1.2.0';

/** Start/end markers for krolik section in CLAUDE.md */
export const KROLIK_SECTION_START = '<!-- krolik:start -->';
export const KROLIK_SECTION_END = '<!-- krolik:end -->';

/**
 * Generate compact krolik documentation for CLAUDE.md
 * Optimized for minimal token usage while preserving essential info
 */
export function generateKrolikDocs(): string {
  return `${KROLIK_SECTION_START}
<!-- version: ${DOCS_VERSION} | auto-updated by krolik CLI -->

## 🐰 Krolik CLI

> AI-toolkit for development. Auto-updated — do not edit manually.

### Core Commands (use these!)

| Command | Use | Key Flags |
|---------|-----|-----------|
| **context** | Get task context | \`--feature <name>\`, \`--issue <n>\`, \`--full\` |
| **refactor** | AST analysis, duplicates | \`--dry-run\`, \`--apply\`, \`--types-only\` |
| **audit** | Code quality → AI-REPORT.md | \`--path <dir>\` |
| **fix** | Auto-fix issues | \`--dry-run\`, \`--quick\`, \`--deep\`, \`--full\` |

### Workflow

\`\`\`bash
krolik context --feature booking  # 1. Understand task
krolik refactor --dry-run         # 2. Find duplicates, structure issues
krolik audit                      # 3. Quality analysis → .krolik/AI-REPORT.md
krolik fix --dry-run              # 4. Preview fixes
krolik fix --yes                  # 5. Apply fixes
\`\`\`

### MCP Tools

| Tool | Use |
|------|-----|
| \`krolik_context\` | Before task — feature/issue context |
| \`krolik_audit\` | Code quality analysis |
| \`krolik_fix\` | Auto-fix issues |
| \`krolik_status\` | Project state — git, typecheck, TODOs |
| \`krolik_schema\` | DB work — Prisma models |
| \`krolik_routes\` | API work — tRPC routers |
| \`krolik_review\` | Code review changes |

### Fix Presets

\`\`\`bash
krolik fix --quick  # trivial (console, debugger) + biome
krolik fix --deep   # safe fixes + biome + typecheck
krolik fix --full   # all fixes + backup
\`\`\`

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
