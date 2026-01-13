<div align="center">

```
     (\(\
     (-.-)
     o_(")(")
```

### AI-First Development Toolkit for TypeScript

[![CI](https://github.com/anatolykoptev/krolik-cli/actions/workflows/ci.yml/badge.svg)](https://github.com/anatolykoptev/krolik-cli/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/@anatolykoptev/krolik-cli.svg?style=flat&colorA=18181B&colorB=28CF8D)](https://www.npmjs.com/package/@anatolykoptev/krolik-cli)
[![License: FSL-1.1-Apache-2.0](https://img.shields.io/badge/License-FSL--1.1-blue.svg?style=flat&colorA=18181B&colorB=28CF8D)](./LICENSE)

[Get Started](#installation) · [Commands](#commands) · [MCP Server](#mcp-server)

</div>

---

## Why Krolik?

AI assistants spend most of their time gathering context. Every session starts with "let me search the codebase..." followed by dozens of file reads.

**Krolik gives AI everything it needs in 1-2 seconds.**

---

## Installation

```bash
npm i -g @anatolykoptev/krolik-cli
```

---

## Commands

### `krolik context` — Project Context in Seconds

One command replaces 10+ manual searches.

```bash
krolik context --feature auth      # Everything about auth feature
krolik context --issue 42          # Context from GitHub issue
krolik context --quick             # Compact mode (~3500 tokens)
```

**What it collects**: git state, database schema, API routes, project structure, types, past decisions.

---

### `krolik mem` — Persistent Memory

AI forgets everything between sessions. Krolik remembers.

```bash
krolik mem save --type decision --title "Use tRPC" --description "Type-safe API"
krolik mem search --query "authentication"
krolik mem recent --limit 5
```

**Memory types**: decisions, patterns, bugfixes, observations, features.

---

### `krolik audit` — Find Quality Issues

Analyzes codebase and creates a prioritized report.

```bash
krolik audit                       # All issues
krolik audit --mode release        # Security + type-safety
krolik audit --mode pre-commit     # Quick check before commit
```

---

### `krolik fix` — Auto-Fix Issues

```bash
krolik fix --dry-run        # Preview changes
krolik fix                  # Apply safe fixes
```

**What it fixes**: console.log, debugger, any types, magic numbers, and more.

---

### `krolik refactor` — Find Duplicates

```bash
krolik refactor              # Find duplicate functions
krolik refactor --deep       # + type duplicates
krolik refactor --apply      # Apply migrations
```

---

### `krolik agent` — Specialized AI Agents

```bash
krolik agent --list                           # Available agents
krolik agent security-auditor                 # Run specific agent
krolik agent --orchestrate --task "review"    # Multi-agent mode
```

---

### Other Commands

| Command | What it does |
|---------|--------------|
| `krolik status` | Quick health check: git, types, lint |
| `krolik schema` | Database schema as structured docs |
| `krolik routes` | API routes as structured docs |
| `krolik review` | Code review for current changes |
| `krolik docs` | Library documentation cache |
| `krolik modules` | Query lib modules in your codebase |

---

## MCP Server

Native integration with Claude Code via [Model Context Protocol](https://modelcontextprotocol.io).

```bash
claude mcp add krolik -- npx @anatolykoptev/krolik-cli mcp
```

---

## Configuration

Works out of the box. Customize if needed:

```typescript
// krolik.config.ts
import { defineConfig } from '@anatolykoptev/krolik-cli';

export default defineConfig({
  name: 'my-project',
  paths: {
    web: 'apps/web',
    api: 'packages/api',
  },
});
```

---

## Requirements

- **Node.js >= 20.0.0**
- **TypeScript >= 5.0.0** (peer dependency)

Native modules require build tools:
- **macOS**: `xcode-select --install`
- **Linux**: `apt install build-essential python3`
- **Windows**: `npm install -g windows-build-tools`

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup.

---

## License

[FSL-1.1-Apache-2.0](LICENSE) © Anatoly Koptev

Free for internal use, education, and research. Converts to Apache 2.0 on December 26, 2027.

---

## Changelog

### v0.15.1 (2026-01-13)
- Cleaned up README, added changelog
- Major cleanup of refactor component
- Optimized MCP tools with direct imports
- Consolidated duplicate utility functions

### v0.15.0
- Memory graph: link decisions with `caused`, `supersedes`, `implements`
- Semantic search with local AI model
- Added `krolik docs` for library documentation caching
- Added `krolik modules` for querying lib exports

### v0.14.0
- Added `krolik agent` with specialized agent categories
- Added `krolik refactor` for duplicate detection
- Multi-agent orchestration mode
