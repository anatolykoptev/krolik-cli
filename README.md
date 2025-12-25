<div align="center">

```
     (\(\
     (-.-) 
     o_(")(")
```

### AI-First Development Toolkit for TypeScript

[![CI](https://github.com/anatolykoptev/krolik-cli/actions/workflows/ci.yml/badge.svg)](https://github.com/anatolykoptev/krolik-cli/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/@anatolykoptev/krolik-cli.svg?style=flat&colorA=18181B&colorB=28CF8D)](https://www.npmjs.com/package/@anatolykoptev/krolik-cli)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat&colorA=18181B&colorB=28CF8D)](https://opensource.org/licenses/MIT)

[Get Started](#installation) · [Core Commands](#core-commands) · [MCP Server](#mcp-server-claude-code)

</div>

---

## The Problem

AI assistants spend 60% of their time gathering context: reading files, searching code, understanding project structure. Every session starts from scratch.

## The Solution

**Krolik** collects everything an AI needs in 1-2 seconds:

```bash
krolik context --feature auth
```

One command returns: git state, Prisma schema, tRPC routes, project tree, types, imports, env vars, relevant memories from past sessions, and library documentation. All structured as AI-optimized XML.

---

## Installation

Available on [npm](https://www.npmjs.com/package/@anatolykoptev/krolik-cli) and [GitHub Packages](https://github.com/anatolykoptev/krolik-cli/packages).

```bash
npm i -g @anatolykoptev/krolik-cli
```

---

## Core Commands

### `krolik context` — Instant Project Context

Replaces 10+ manual searches with a single command. Collects and structures:

- **Git**: branch, diff, staged files, recent commits
- **Schema**: Prisma models and relations
- **API**: tRPC routes with inputs/outputs
- **Architecture**: project tree, patterns, dependencies
- **Types**: interfaces, type aliases, import graph
- **Memory**: relevant decisions and patterns from past sessions
- **Docs**: cached library documentation (via Context7)

```bash
krolik context --feature booking     # Context for a feature
krolik context --issue 42            # Context from GitHub issue
krolik context --quick               # Fast mode (schema, routes, git only)
krolik context --full                # Everything including code analysis
```

Output is saved to `.krolik/CONTEXT.xml` — AI can reference it anytime.

---

### `krolik mem` — Persistent Memory

SQLite database with FTS5 full-text search. Preserves context across sessions.

```bash
# Save a decision
krolik mem save --type decision \
  --title "Use tRPC for API" \
  --description "Type-safe, works well with Prisma"

# Search memories
krolik mem search --query "authentication"

# Recent entries
krolik mem recent --type bugfix --limit 5
```

**Memory types**: `observation`, `decision`, `pattern`, `bugfix`, `feature`

Memories are automatically included in `krolik context` output.

---

### `krolik audit` — Code Quality Analysis

Deep analysis that generates a structured report for AI consumption.

```bash
krolik audit                    # Full analysis
krolik audit --show-fixes       # Include fix previews
```

Creates `.krolik/AI-REPORT.md` with:
- Prioritized issues (critical → low)
- Hotspot files (highest issue density)
- Quick wins (auto-fixable issues)
- Action plan

---

### `krolik fix` — Auto-Fix Pipeline

Three-stage pipeline: Biome → TypeScript → 14 custom fixers.

```bash
krolik fix --dry-run            # Preview all fixes
krolik fix                      # Apply safe fixes
krolik fix --from-audit         # Use cached audit data
krolik fix --all                # Include risky fixes
```

**Categories**:
- `lint`: console.log, debugger, alert
- `type-safety`: any, @ts-ignore, eval, loose equality
- `complexity`: high cyclomatic complexity, long functions
- `hardcoded`: magic numbers, URLs
- `srp`: single responsibility violations

Issues that can't be auto-fixed are formatted as tasks for AI.

---

### `krolik refactor` — Duplicate Detection & Migration

AST-based analysis using SWC (10-20x faster than ts-morph).

```bash
krolik refactor                      # Find function duplicates
krolik refactor --types-only         # Find type/interface duplicates
krolik refactor --structure-only     # Analyze module structure
krolik refactor --apply              # Apply migrations
```

Features:
- Duplicate functions by signature comparison
- Duplicate types by structure comparison
- Module structure scoring
- Migration plan with import updates
- Git backup before applying

---

### `krolik agent` — Multi-Agent Orchestration

Run specialized AI agents with project context. Uses [wshobson/agents](https://github.com/wshobson/agents) repository.

```bash
krolik agent --list                  # Available agents
krolik agent security-auditor        # Run specific agent
krolik agent --category quality      # Run category

# Orchestration mode - analyzes task, selects agents, creates execution plan
krolik agent --orchestrate --task "review security and performance"
```

**12 agent categories**: security, performance, architecture, quality, debugging, docs, frontend, backend, database, devops, testing, other

---

### Other Commands

| Command | Description |
|---------|-------------|
| `krolik status` | Project diagnostics (git, typecheck, lint, TODOs) |
| `krolik schema` | Prisma schema → structured docs |
| `krolik routes` | tRPC routes → structured docs |
| `krolik review` | Code review with AI hints |
| `krolik docs` | Library documentation cache |
| `krolik sync` | Update CLAUDE.md with krolik block |

---

## MCP Server (Claude Code)

Native [Model Context Protocol](https://modelcontextprotocol.io) integration.

```bash
claude mcp add krolik -- npx @anatolykoptev/krolik-cli mcp
```

**14 tools available**:

| Tool | Purpose |
|------|---------|
| `krolik_context` | Full project context in 1-2s |
| `krolik_status` | Quick diagnostics |
| `krolik_audit` | Deep quality analysis |
| `krolik_fix` | Auto-fix with preview |
| `krolik_refactor` | Duplicate detection |
| `krolik_review` | Code review |
| `krolik_schema` | Prisma schema |
| `krolik_routes` | tRPC routes |
| `krolik_docs` | Library docs search |
| `krolik_mem_save` | Save memory |
| `krolik_mem_search` | Search memories |
| `krolik_mem_recent` | Recent memories |
| `krolik_agent` | Run AI agents |
| `krolik_issue` | Parse GitHub issue |

---

## Configuration

Auto-detection works for most projects. For customization:

```typescript
// krolik.config.ts
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
  },
  prisma: {
    schemaDir: 'packages/db/prisma/schema',
  },
  trpc: {
    routersDir: 'packages/api/src/routers',
  },
});
```

---

## Requirements

- Node.js >= 20.0.0
- TypeScript >= 5.0.0

## License

[MIT](LICENSE) © Anatoly Koptev
