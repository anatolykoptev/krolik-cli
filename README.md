# KROLIK CLI

[![CI](https://github.com/anatolykoptev/krolik-cli/actions/workflows/ci.yml/badge.svg)](https://github.com/anatolykoptev/krolik-cli/actions/workflows/ci.yml)
[![codecov](https://codecov.io/gh/anatolykoptev/krolik-cli/branch/main/graph/badge.svg)](https://codecov.io/gh/anatolykoptev/krolik-cli)
[![npm version](https://badge.fury.io/js/%40anatolykoptev%2Fkrolik-cli.svg)](https://badge.fury.io/js/%40anatolykoptev%2Fkrolik-cli)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

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
- **Plugin Setup** — Install Claude Code plugins (claude-mem, etc.)

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

# Install Claude Code plugins (claude-mem, etc.)
krolik setup
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

## Commands Reference

### Global Options

```bash
krolik [command] [options]
  -V, --version            Output version number
  -c, --config <path>      Path to config file
  --project-root <path>    Project root directory
  --cwd <path>             Alias for --project-root
  -t, --text               Human-readable text output (default: AI-friendly XML)
  --json                   Output as JSON
  -v, --verbose            Verbose output
  --no-color               Disable colored output
```

---

### `krolik status`

Quick project diagnostics: git, typecheck, lint, TODOs.

```bash
krolik status              # Full diagnostics
krolik status --fast       # Skip slow checks (typecheck, lint)
krolik status --report     # Generate AI-REPORT.md with code quality analysis
```

---

### `krolik fix`

Auto-fix code quality issues. **Replaces deprecated `quality` command.**

```bash
# Analysis modes
krolik fix --analyze-only              # Analyze only (no fixes)
krolik fix --dry-run                   # Show what would be fixed
krolik fix --dry-run --diff            # Show unified diff preview

# Execution
krolik fix                             # Apply all safe fixes
krolik fix --yes                       # Auto-confirm all fixes
krolik fix --path <path>               # Fix specific directory
krolik fix --limit <n>                 # Max fixes to apply
krolik fix --backup                    # Create backup before fixing

# Fix scope
krolik fix --trivial                   # Only trivial (console, debugger)
krolik fix --safe                      # Trivial + safe (excludes risky)
krolik fix --all                       # Include risky fixers (requires confirmation)

# Tool selection
krolik fix --biome                     # Run Biome auto-fix (default)
krolik fix --biome-only                # Only Biome, skip custom
krolik fix --no-biome                  # Skip Biome
krolik fix --typecheck                 # Run TypeScript check (default)
krolik fix --typecheck-only            # Only TypeScript check
krolik fix --no-typecheck              # Skip TypeScript check

# Category filtering
krolik fix --category lint             # Only lint issues
krolik fix --category type-safety      # Only type-safety issues
krolik fix --category complexity       # Only complexity issues

# Individual fixers
krolik fix --fix-console               # Fix console.log
krolik fix --fix-debugger              # Fix debugger statements
krolik fix --fix-alert                 # Fix alert() calls
krolik fix --fix-ts-ignore             # Fix @ts-ignore
krolik fix --fix-any                   # Fix `any` types
krolik fix --fix-complexity            # Fix high complexity
krolik fix --fix-long-functions        # Fix long functions
krolik fix --fix-magic-numbers         # Fix magic numbers
krolik fix --fix-urls                  # Fix hardcoded URLs
krolik fix --fix-srp                   # Fix SRP violations

# Disable fixers
krolik fix --no-console                # Skip console fixes
krolik fix --no-debugger               # Skip debugger fixes
krolik fix --no-any                    # Skip any type fixes

# Reports
krolik fix --list-fixers               # List all available fixers
# For AI reports use: krolik status --report
```

**Fix Categories:**
- `lint` — console, debugger, alert statements
- `type-safety` — any, @ts-ignore, eval, loose equality
- `complexity` — high cyclomatic complexity, long functions
- `hardcoded` — magic numbers, hardcoded URLs
- `srp` — single responsibility violations

---

### `krolik context`

Generate AI-friendly context for tasks.

```bash
krolik context --feature <name>     # Context for feature (e.g., "booking", "crm")
krolik context --issue <number>     # Context from GitHub issue
krolik context --file <path>        # Context for specific file
krolik context --include-code       # Include Zod schemas and code snippets
krolik context --domain-history     # Include git history for domain files
krolik context --show-deps          # Show domain dependencies
krolik context --full               # Enable all enrichment options
```

---

### `krolik review`

AI-assisted code review.

```bash
krolik review                       # Review current branch vs main
krolik review --staged              # Review staged changes only
krolik review --pr <number>         # Review specific PR
```

---

### `krolik schema`

Analyze Prisma schema.

```bash
krolik schema                       # Print to stdout (AI-friendly XML)
krolik schema --save                # Save to SCHEMA.md
krolik schema --json                # JSON output
```

---

### `krolik routes`

Analyze tRPC routes.

```bash
krolik routes                       # Print to stdout (AI-friendly XML)
krolik routes --save                # Save to ROUTES.md
krolik routes --json                # JSON output
```

---

### `krolik issue [number]`

Parse GitHub issue for AI context.

```bash
krolik issue 123                    # Parse issue by number
krolik issue --url <url>            # Parse issue by URL
```

---

### `krolik codegen <target>`

Generate code artifacts.

```bash
krolik codegen hooks                # Generate React hooks
krolik codegen schemas              # Generate Zod schemas
krolik codegen tests                # Generate test files
krolik codegen barrels              # Generate index.ts exports
krolik codegen docs                 # Generate documentation

# Options
krolik codegen <target> --path <path>   # Target path
krolik codegen <target> --dry-run       # Preview without changes
krolik codegen <target> --force         # Overwrite existing files
```

---

### `krolik refine`

Analyze and reorganize lib/ structure to @namespace pattern.

```bash
krolik refine                       # Analyze lib/ structure
krolik refine --lib-path <path>     # Custom lib directory
krolik refine --dry-run             # Preview changes
krolik refine --apply               # Apply migration (move dirs, update imports)
krolik refine --generate-config     # Generate ai-config.ts
```

---

### `krolik security`

Run security audit.

```bash
krolik security                     # Audit dependencies
krolik security --fix               # Attempt to fix vulnerabilities
```

---

### `krolik mcp`

Start MCP server for Claude Code integration (stdio transport).

```bash
krolik mcp                          # Start MCP server
```

**Setup in Claude Code:**

```bash
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
| `krolik_status` | Project diagnostics (git, typecheck, lint, TODOs) |
| `krolik_context` | AI context generation for features/issues |
| `krolik_schema` | Prisma schema analysis |
| `krolik_routes` | tRPC routes analysis |
| `krolik_review` | Code review for changes |
| `krolik_issue` | GitHub issue parsing |

---

### `krolik setup`

Install recommended Claude Code plugins.

```bash
krolik setup                        # Install all recommended plugins
krolik setup --list                 # List available plugins
krolik setup --mem                  # Install only claude-mem
krolik setup --dry-run              # Preview without installing
krolik setup --force                # Reinstall even if already installed
```

**Available Plugins:**

| Plugin | Description |
|--------|-------------|
| `claude-mem` | Persistent memory for Claude Code sessions — saves context across sessions, semantic search over history |

**What `krolik setup` does:**

1. Clones plugin from GitHub
2. Installs dependencies (`npm install`)
3. Builds the plugin (`npm run build`)
4. Registers in Claude Code (`~/.claude/plugins/`)
5. Creates data directories

**After installation:**

- Restart Claude Code to activate plugins
- Web UI available at http://localhost:37777 (for claude-mem)
- Context automatically injected at session start
- Search with natural language: "What did we do yesterday?"

---

### `krolik init`

Initialize krolik.config.ts in project root.

```bash
krolik init                         # Interactive config setup
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
