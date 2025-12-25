<div align="center">

```
     (\(\
     (-.-)    KROLIK
     o_(")(")
```

### Fast AI-Assisted Development Toolkit for TypeScript

[![CI](https://github.com/anatolykoptev/krolik-cli/actions/workflows/ci.yml/badge.svg)](https://github.com/anatolykoptev/krolik-cli/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/@anatolykoptev/krolik-cli.svg?style=flat&colorA=18181B&colorB=28CF8D)](https://www.npmjs.com/package/@anatolykoptev/krolik-cli)
[![npm downloads](https://img.shields.io/npm/dm/@anatolykoptev/krolik-cli.svg?style=flat&colorA=18181B&colorB=28CF8D)](https://www.npmjs.com/package/@anatolykoptev/krolik-cli)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat&colorA=18181B&colorB=28CF8D)](https://opensource.org/licenses/MIT)

[Installation](#installation) · [Quick Start](#quick-start) · [Documentation](#commands) · [MCP Integration](#mcp-server)

</div>

---

**Krolik** is a CLI toolkit that supercharges AI-assisted development. It provides instant project context, automated code quality fixes, and seamless Claude Code integration — all optimized for speed.

### Why Krolik?

- **🚀 10x Faster Context** — Get complete project context in seconds, not minutes of manual exploration
- **🔧 Auto-Fix Pipeline** — Biome + TypeScript + custom fixers in one command
- **🧠 Persistent Memory** — SQLite-backed memory with FTS5 search across sessions
- **📚 Docs at Your Fingertips** — Cached library documentation via Context7
- **🤖 Multi-Agent Orchestration** — Run specialized AI agents for complex analysis
- **🔌 Native MCP Support** — First-class Claude Code integration with 14 tools

---

## Installation

Available on [npm](https://www.npmjs.com/package/@anatolykoptev/krolik-cli) and [GitHub Packages](https://github.com/anatolykoptev/krolik-cli/packages).

```bash
# Global installation
npm i -g @anatolykoptev/krolik-cli

# Or run directly with npx
npx @anatolykoptev/krolik-cli status
```

## Quick Start

```bash
# Get instant project diagnostics
krolik status --fast

# Generate AI context for a feature
krolik context --feature auth

# Find and fix code quality issues
krolik fix --dry-run    # Preview
krolik fix              # Apply

# Review your changes before commit
krolik review --staged
```

## Commands

### Analysis & Diagnostics

| Command | Description |
|---------|-------------|
| `krolik status` | Project health: git, typecheck, lint, TODOs |
| `krolik audit` | Deep code quality analysis → AI report |
| `krolik schema` | Prisma schema documentation |
| `krolik routes` | tRPC routes documentation |

### Code Quality

| Command | Description |
|---------|-------------|
| `krolik fix` | Auto-fix issues (Biome + TS + 15 custom fixers) |
| `krolik fix --category lint` | Fix console.log, debugger, alert |
| `krolik fix --category type-safety` | Fix `any`, `@ts-ignore`, loose equality |
| `krolik refactor` | Find duplicates, restructure modules |

### AI Context

| Command | Description |
|---------|-------------|
| `krolik context --feature <name>` | Full context for a feature |
| `krolik context --issue <number>` | Context from GitHub issue |
| `krolik mem save/search/recent` | Persistent memory across sessions |
| `krolik docs fetch/search` | Library docs cache (Context7) |

### Code Review & Agents

| Command | Description |
|---------|-------------|
| `krolik review` | AI-assisted code review |
| `krolik review --staged` | Review only staged changes |
| `krolik agent --orchestrate` | Multi-agent task analysis |

## MCP Server

Krolik provides native [Model Context Protocol](https://modelcontextprotocol.io) support for Claude Code.

### Setup

```bash
claude mcp add krolik -- npx @anatolykoptev/krolik-cli mcp
```

### Available Tools

| Tool | What it does |
|------|--------------|
| `krolik_status` | Instant project diagnostics |
| `krolik_context` | AI-optimized context generation |
| `krolik_fix` | Analyze and fix code issues |
| `krolik_audit` | Deep quality analysis |
| `krolik_refactor` | Duplicate detection |
| `krolik_review` | Code review with suggestions |
| `krolik_schema` | Prisma schema as structured data |
| `krolik_routes` | tRPC routes as structured data |
| `krolik_docs` | Search cached library docs |
| `krolik_mem_*` | Persistent memory operations |
| `krolik_agent` | Run specialized AI agents |

## Configuration

Auto-detection works out of the box. For customization, create `krolik.config.ts`:

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
});
```

## Requirements

- Node.js >= 20.0.0
- TypeScript >= 5.0.0

## Contributing

Contributions are welcome! Please read the [Contributing Guide](CONTRIBUTING.md) before submitting a PR.

## License

[MIT](LICENSE) © Anatoly Koptev
