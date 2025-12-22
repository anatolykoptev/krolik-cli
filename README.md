# AI Rabbit Toolkit

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
npm install -g ai-rabbit-toolkit

# Or as a dev dependency
pnpm add -D ai-rabbit-toolkit
```

## Quick Start

```bash
# Initialize config
rabbit init

# Quick project status
rabbit status

# Status without slow checks
rabbit status --fast

# Review current branch changes
rabbit review

# Analyze Prisma schema
rabbit schema --save

# Analyze tRPC routes
rabbit routes --save

# Parse GitHub issue
rabbit issue 123

# Generate code
rabbit codegen hooks
rabbit codegen schemas
rabbit codegen tests

# Security audit
rabbit security

# Start MCP server
rabbit mcp
```

## Configuration

Create `rabbit.config.ts` in your project root:

```typescript
import { defineConfig } from 'ai-rabbit-toolkit';

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

Rabbit automatically detects:

- **Monorepo** — pnpm-workspace.yaml, npm/yarn workspaces
- **Prisma** — @prisma/client dependency, schema location
- **tRPC** — @trpc/server dependency, routers location
- **Next.js** — next dependency
- **TypeScript** — typescript dependency, tsconfig.json

## Commands

### `rabbit status`

Quick project diagnostics:
- Git status (branch, uncommitted changes)
- TypeScript errors
- Lint warnings
- TODO count

```bash
rabbit status           # Full check
rabbit status --fast    # Skip typecheck and lint
rabbit status --json    # JSON output
```

### `rabbit review`

AI-assisted code review:

```bash
rabbit review               # Current branch vs main
rabbit review --staged      # Staged changes only
rabbit review --pr 123      # Specific PR
rabbit review -o markdown   # Markdown output
```

### `rabbit schema`

Prisma schema analysis:

```bash
rabbit schema           # Print to stdout
rabbit schema --save    # Save to SCHEMA.md
rabbit schema --json    # JSON output
```

### `rabbit routes`

tRPC routes analysis:

```bash
rabbit routes           # Print to stdout
rabbit routes --save    # Save to ROUTES.md
rabbit routes --json    # JSON output
```

### `rabbit codegen <target>`

Code generation:

```bash
rabbit codegen hooks     # Generate React hooks
rabbit codegen schemas   # Generate Zod schemas
rabbit codegen tests     # Generate test files
rabbit codegen barrels   # Generate index.ts exports
rabbit codegen docs      # Generate documentation
```

### `rabbit mcp`

Start MCP server for Claude Code integration:

```bash
rabbit mcp              # Start on port 3100
rabbit mcp -p 3200      # Custom port
```

Add to Claude Code:
```bash
claude mcp add rabbit -- npx rabbit mcp
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `RABBIT_CONFIG` | Config file path | Auto-detected |
| `RABBIT_PROJECT_ROOT` | Project root | Current directory |
| `RABBIT_LOG_LEVEL` | Log level (debug/info/warn/error) | info |

## Programmatic Usage

```typescript
import { loadConfig, createLogger, runStatus } from 'ai-rabbit-toolkit';

async function main() {
  const config = await loadConfig();
  const logger = createLogger();

  await runStatus({ config, logger, options: { fast: true } });
}
```

## License

MIT
