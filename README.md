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

## Installation

Published on [npm](https://www.npmjs.com/package/@anatolykoptev/krolik-cli) and [GitHub Packages](https://github.com/anatolykoptev/krolik-cli/packages).

```bash
npm i -g @anatolykoptev/krolik-cli    # Global
pnpm add -D @anatolykoptev/krolik-cli # Dev dependency
npx @anatolykoptev/krolik-cli status  # No install
```

## Commands

| Command | Description |
|---------|-------------|
| `status [--fast]` | Project diagnostics (git, typecheck, lint, TODOs) |
| `audit [--path]` | Code quality audit → AI report |
| `fix [--dry-run] [--category]` | Auto-fix issues (Biome + TS + custom) |
| `context --feature/--issue` | AI context for tasks |
| `refactor [--apply]` | Find duplicates, restructure modules |
| `review [--staged] [--pr]` | Code review with AI hints |
| `schema/routes [--save]` | Prisma/tRPC analysis |
| `mem save/search/recent` | Persistent memory (SQLite + FTS5) |
| `docs detect/fetch/search` | Library docs cache (Context7) |
| `agent [--orchestrate]` | Run specialized AI agents |
| `sync` | Update CLAUDE.md krolik block |
| `init/issue/codegen/security/setup` | Other utilities |

### Fix Categories

```bash
krolik fix --dry-run              # Preview
krolik fix --category lint        # console, debugger
krolik fix --category type-safety # any, @ts-ignore
krolik fix --category complexity  # High complexity
krolik fix --all                  # Include risky fixes
```

## MCP Server (Claude Code)

```bash
claude mcp add krolik -- npx @anatolykoptev/krolik-cli mcp
```

**Tools:** `krolik_status`, `krolik_audit`, `krolik_context`, `krolik_fix`, `krolik_refactor`, `krolik_review`, `krolik_schema`, `krolik_routes`, `krolik_issue`, `krolik_docs`, `krolik_mem_*`, `krolik_agent`

## Configuration

```typescript
// krolik.config.ts
import { defineConfig } from '@anatolykoptev/krolik-cli';

export default defineConfig({
  name: 'my-project',
  paths: { web: 'apps/web', api: 'packages/api', db: 'packages/db' },
  features: { prisma: true, trpc: true, nextjs: true },
});
```

## Requirements

Node.js >= 20 | [MIT License](LICENSE)
