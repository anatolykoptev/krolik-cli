# KROLIK CLI

```
   (\(\
   (-.-)
   o_(")(")
```

Fast AI-assisted development toolkit for TypeScript projects.

## Features

- **Project Status** — Quick diagnostics (git, types, lint, TODOs)
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

# Security audit
krolik security

# Start MCP server
krolik mcp
```

## Configuration

Create `krolik.config.ts` in your project root:

```typescript
import { defineConfig } from 'krolik-cli';

export default defineConfig({
  // Project name (auto-detected from package.json)
  name: 'my-project',

  // Custom paths (auto-detected for monorepos)
  paths: {
    web: 'apps/web',
    api: 'packages/api',
    db: 'packages/db',
    components: 'apps/web/components',
  },

  // Override auto-detection
  features: {
    prisma: true,
    trpc: true,
    nextjs: true,
    monorepo: true,
  },

  // Prisma configuration
  prisma: {
    schemaDir: 'packages/db/prisma/schema',
  },

  // tRPC configuration
  trpc: {
    routersDir: 'packages/api/src/routers',
    appRouter: 'packages/api/src/routers/index.ts',
  },

  // Files to exclude from analysis
  exclude: ['node_modules', 'dist', '.next', '.git'],
});
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

### `krolik mcp`

Start MCP server for Claude Code integration:

```bash
krolik mcp              # Start on port 3100
krolik mcp -p 3200      # Custom port
```

Add to Claude Code:
```bash
claude mcp add krolik -- npx krolik mcp
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
