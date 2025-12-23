# KROLIK CLI

```
   (\(\
   (-.-)
   o_(")(")
```

Fast AI-assisted development toolkit for TypeScript projects.

## Features

- **Project Status** — Quick diagnostics (git, types, lint, TODOs)
- **Code Quality** — Analyze code for SRP, complexity, type-safety, lint issues
- **Auto-Fix** — Automatically fix code issues (Biome + TypeScript + custom)
- **Code Review** — AI-assisted review of changes
- **Schema Analysis** — Prisma schema documentation
- **Routes Analysis** — tRPC routes documentation
- **Issue Parser** — GitHub issue parsing for AI context
- **Context Generator** — Generate AI context for tasks
- **Code Generation** — Hooks, schemas, tests, barrels, docs
- **Security Audit** — Check for vulnerabilities
- **MCP Server** — Claude Code integration

## Installation

```bash
# Global install
npm install -g krolik-cli

# Or as a dev dependency
pnpm add -D krolik-cli
```

## Quick Start

```bash
# Initialize config
krolik init

# Quick project status
krolik status

# Status without slow checks
krolik status --fast

# Review current branch changes
krolik review

# Analyze Prisma schema
krolik schema --save

# Analyze tRPC routes
krolik routes --save

# Parse GitHub issue
krolik issue 123

# Generate code
krolik codegen hooks
krolik codegen schemas
krolik codegen tests

# Code quality analysis
krolik quality
krolik quality --ai         # AI-friendly XML output

# Auto-fix issues
krolik fix                  # Full pipeline
krolik fix --dry-run        # Preview changes

# Security audit
krolik security

# Start MCP server
krolik mcp
```

## Configuration

Create `krolik.config.ts` or `krolik.yaml` in your project root.

### TypeScript Config

```typescript
import { defineConfig } from 'krolik-cli';

export default defineConfig({
  name: 'my-project',
  paths: {
    web: 'apps/web',
    api: 'packages/api',
    db: 'packages/db',
  },
  features: {
    prisma: true,
    trpc: true,
    nextjs: true,
  },
  prisma: {
    schemaDir: 'packages/db/prisma/schema',
  },
  trpc: {
    routersDir: 'packages/api/src/routers',
  },
  // Custom domains for context generation
  domains: {
    crm: {
      keywords: ['customer', 'lead', 'contact'],
      approach: ['Check CRM module', 'Review customer schema'],
    },
  },
});
```

### YAML Config

```yaml
# krolik.yaml
name: my-project

paths:
  web: apps/web
  api: packages/api
  db: packages/db

features:
  prisma: true
  trpc: true
  nextjs: true

prisma:
  schemaDir: packages/db/prisma/schema

trpc:
  routersDir: packages/api/src/routers

# Custom domains for context generation
domains:
  crm:
    keywords:
      - customer
      - lead
      - contact
    approach:
      - Check CRM module
      - Review customer schema
```

## Auto-Detection

Krolik automatically detects:

- **Monorepo** — pnpm-workspace.yaml, npm/yarn workspaces
- **Prisma** — @prisma/client dependency, schema location
- **tRPC** — @trpc/server dependency, routers location
- **Next.js** — next dependency
- **TypeScript** — typescript dependency, tsconfig.json

## Commands

### `krolik status`

Quick project diagnostics:
- Git status (branch, uncommitted changes)
- TypeScript errors
- Lint warnings
- TODO count

```bash
krolik status           # Full check
krolik status --fast    # Skip typecheck and lint
krolik status --json    # JSON output
```

### `krolik review`

AI-assisted code review:

```bash
krolik review               # Current branch vs main
krolik review --staged      # Staged changes only
krolik review --pr 123      # Specific PR
krolik review -o markdown   # Markdown output
```

### `krolik schema`

Prisma schema analysis:

```bash
krolik schema           # Print to stdout
krolik schema --save    # Save to SCHEMA.md
krolik schema --json    # JSON output
```

### `krolik routes`

tRPC routes analysis:

```bash
krolik routes           # Print to stdout
krolik routes --save    # Save to ROUTES.md
krolik routes --json    # JSON output
```

### `krolik codegen <target>`

Code generation:

```bash
krolik codegen hooks     # Generate React hooks
krolik codegen schemas   # Generate Zod schemas
krolik codegen tests     # Generate test files
krolik codegen barrels   # Generate index.ts exports
krolik codegen docs      # Generate documentation
```

### `krolik quality`

Code quality analysis with AI-optimized output:

```bash
krolik quality                    # Analyze entire project
krolik quality --path=src/        # Analyze specific path
krolik quality --ai               # AI-friendly XML output
krolik quality --category=lint    # Filter by category
krolik quality --json             # JSON output
```

**Categories:**
- `srp` — Single Responsibility violations
- `complexity` — High cyclomatic complexity, long functions
- `type-safety` — `any`, `@ts-ignore`, type assertions
- `lint` — `console`, `debugger`, `alert` statements
- `hardcoded` — Magic numbers, hardcoded strings
- `size` — Files exceeding line limits

### `krolik fix`

Auto-fix code issues:

```bash
krolik fix                        # Full pipeline (tsc + biome + custom)
krolik fix --dry-run              # Preview changes
krolik fix --typecheck-only       # Only TypeScript check
krolik fix --biome-only           # Only Biome fixes
krolik fix --no-biome             # Skip Biome
krolik fix --path=src/commands    # Fix specific path
krolik fix --trivial              # Only trivial fixes
```

**Fix pipeline:**
1. TypeScript type check (`tsc --noEmit`)
2. Biome auto-fix (if available)
3. Custom strategies (lint, type-safety, complexity)

### `krolik mcp`

Start MCP server for Claude Code integration (stdio transport):

```bash
krolik mcp    # Start MCP server (for Claude Code)
```

**Setup in Claude Code:**

```bash
# Add krolik as MCP server
claude mcp add krolik -- npx krolik mcp
```

Or add to `.claude/settings.json`:

```json
{
  "mcpServers": {
    "krolik": {
      "command": "npx",
      "args": ["krolik", "mcp"],
      "cwd": "/path/to/your/project"
    }
  }
}
```

**Available MCP Tools:**

| Tool | Description |
|------|-------------|
| `krolik_status` | Project diagnostics |
| `krolik_context` | AI context generation |
| `krolik_quality` | Code quality analysis |
| `krolik_schema` | Prisma schema analysis |
| `krolik_routes` | tRPC routes analysis |
| `krolik_review` | Code review |
| `krolik_issue` | GitHub issue parsing |

### `krolik context`

Generate AI-friendly context for development tasks:

```bash
krolik context --feature="booking"   # Context for booking feature
krolik context --issue=123           # Context from GitHub issue
krolik context --ai                  # Structured XML output for AI
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `KROLIK_CONFIG` | Config file path | Auto-detected |
| `KROLIK_PROJECT_ROOT` | Project root | Current directory |
| `KROLIK_LOG_LEVEL` | Log level (debug/info/warn/error) | info |

## Programmatic Usage

```typescript
import { loadConfig, createLogger, runStatus } from 'krolik-cli';

async function main() {
  const config = await loadConfig();
  const logger = createLogger();

  await runStatus({ config, logger, options: { fast: true } });
}
```

## License

MIT
