# KROLIK CLI

[![CI](https://github.com/anatolykoptev/krolik-cli/actions/workflows/ci.yml/badge.svg)](https://github.com/anatolykoptev/krolik-cli/actions/workflows/ci.yml)
[![npm version](https://badge.fury.io/js/%40anatolykoptev%2Fkrolik-cli.svg)](https://badge.fury.io/js/%40anatolykoptev%2Fkrolik-cli)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

```
   (\(\
   (-.-)
   o_(")(")
```

Fast AI-assisted development toolkit for TypeScript projects.

## Features

| Category | Tools |
|----------|-------|
| **Analysis** | Project status, code audit, schema/routes analysis |
| **Auto-fix** | Code quality issues, Biome + TypeScript + custom fixers |
| **Refactoring** | Duplicate detection, module restructuring, import updates |
| **Context** | AI-friendly context generation for features/issues |
| **Memory** | Persistent SQLite memory with FTS5 search |
| **Docs** | Library documentation cache via Context7 |
| **Agents** | Multi-agent orchestration for complex tasks |
| **MCP** | Full Claude Code integration |

## Installation

Published on [npm](https://www.npmjs.com/package/@anatolykoptev/krolik-cli) and [GitHub Packages](https://github.com/anatolykoptev/krolik-cli/packages).

```bash
# Global
npm i -g @anatolykoptev/krolik-cli

# Dev dependency
pnpm add -D @anatolykoptev/krolik-cli

# Or via npx (no install)
npx @anatolykoptev/krolik-cli status
```

## Quick Start

```bash
# Project diagnostics
krolik status --fast

# Code quality audit
krolik audit

# Auto-fix issues
krolik fix --dry-run       # Preview
krolik fix                  # Apply

# AI context for task
krolik context --feature booking

# Code review
krolik review --staged

# Prisma schema → docs
krolik schema --save

# tRPC routes → docs
krolik routes --save

# Start MCP server
krolik mcp
```

## Commands

### `krolik status`

Project diagnostics: git, typecheck, lint, TODOs.

```bash
krolik status              # Full
krolik status --fast       # Skip slow checks
```

### `krolik audit`

Code quality audit → AI-friendly report.

```bash
krolik audit               # Full audit
krolik audit --path src/   # Specific path
```

### `krolik fix`

Auto-fix code quality issues.

```bash
# Analysis
krolik fix --dry-run              # Preview changes
krolik fix --dry-run --diff       # Show unified diff

# Execution
krolik fix                        # Apply safe fixes
krolik fix --yes                  # Auto-confirm
krolik fix --path <path>          # Specific directory

# Scope
krolik fix --trivial              # console, debugger only
krolik fix --safe                 # Trivial + safe
krolik fix --all                  # Include risky

# Tools
krolik fix --biome-only           # Only Biome
krolik fix --no-biome             # Skip Biome

# Categories
krolik fix --category lint
krolik fix --category type-safety
krolik fix --category complexity
```

### `krolik context`

AI-friendly context for tasks.

```bash
krolik context --feature <name>   # Feature context
krolik context --issue <number>   # From GitHub issue
krolik context --full             # All enrichment
```

### `krolik refactor`

Find duplicates, analyze structure, apply migrations.

```bash
krolik refactor                    # Analyze duplicates
krolik refactor --types-only       # Only duplicate types
krolik refactor --structure-only   # Module structure
krolik refactor --apply            # Apply migrations
krolik refactor --dry-run          # Preview
```

### `krolik review`

Code review with AI hints.

```bash
krolik review                 # Current branch vs main
krolik review --staged        # Staged changes only
krolik review --pr <number>   # Specific PR
```

### `krolik memory`

Persistent memory across sessions.

```bash
krolik mem save --type decision --title "Use tRPC" --description "..."
krolik mem search --query "tRPC"
krolik mem recent --limit 10
krolik mem recent --type bugfix
```

### `krolik docs`

Library documentation cache.

```bash
krolik docs detect               # Auto-detect from package.json
krolik docs fetch next.js        # Fetch docs for library
krolik docs search "app router"  # Full-text search
krolik docs list                 # Show cached libs
```

### `krolik agent`

Run specialized AI agents.

```bash
krolik agent --list               # Available agents
krolik agent --name security-auditor
krolik agent --category quality
krolik agent --orchestrate --task "analyze security and performance"
```

### `krolik schema`

Prisma schema analysis.

```bash
krolik schema                # AI-friendly XML
krolik schema --save         # Save to SCHEMA.md
krolik schema --json         # JSON output
```

### `krolik routes`

tRPC routes analysis.

```bash
krolik routes                # AI-friendly XML
krolik routes --save         # Save to ROUTES.md
krolik routes --json         # JSON output
```

### `krolik sync`

Sync CLAUDE.md with krolik block.

```bash
krolik sync                  # Update CLAUDE.md
```

### Other Commands

```bash
krolik init                  # Initialize config
krolik issue 123             # Parse GitHub issue
krolik codegen hooks         # Generate code
krolik security              # Dependency audit
krolik setup                 # Install plugins
```

## MCP Server

Claude Code integration via Model Context Protocol.

### Setup

```bash
claude mcp add krolik -- npx @anatolykoptev/krolik-cli mcp
```

Or in `.claude/settings.json`:

```json
{
  "mcpServers": {
    "krolik": {
      "command": "npx",
      "args": ["@anatolykoptev/krolik-cli", "mcp"],
      "cwd": "/path/to/project"
    }
  }
}
```

### Available Tools

| Tool | Description |
|------|-------------|
| `krolik_status` | Project diagnostics |
| `krolik_audit` | Code quality audit |
| `krolik_context` | AI context generation |
| `krolik_fix` | Auto-fix issues |
| `krolik_refactor` | Duplicate/structure analysis |
| `krolik_review` | Code review |
| `krolik_schema` | Prisma schema |
| `krolik_routes` | tRPC routes |
| `krolik_issue` | GitHub issue parsing |
| `krolik_docs` | Library docs cache |
| `krolik_mem_save` | Save memory entry |
| `krolik_mem_search` | Search memory |
| `krolik_mem_recent` | Recent memories |
| `krolik_agent` | Run AI agents |

## Configuration

`krolik.config.ts`:

```typescript
import { defineConfig } from '@anatolykoptev/krolik-cli';

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
});
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `CONTEXT7_API_KEY` | Context7 API key for docs |
| `KROLIK_PROJECT_ROOT` | Project root override |
| `KROLIK_LOG_LEVEL` | Log level (debug/info/warn/error) |

## Requirements

- Node.js >= 20.0.0
- pnpm (recommended)

## License

MIT
