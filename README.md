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

[Get Started](#installation) · [Commands](#commands) · [MCP Server](#mcp-server)

</div>

---

## Why Krolik?

AI assistants spend most of their time gathering context. Every session starts with "let me search the codebase..." followed by dozens of file reads.

**Krolik gives AI everything it needs in 1-2 seconds.**

```bash
npm i -g @anatolykoptev/krolik-cli
```

---

## Commands

### `krolik context` — Stop Searching, Start Coding

One command replaces 10+ manual searches. AI gets complete project context instantly.

```bash
krolik context --feature auth      # Everything about auth feature
krolik context --issue 42          # Context from GitHub issue
krolik context --quick             # Fast mode for simple tasks
```

**What it collects**: git state, database schema, API routes, project structure, types, past decisions, library docs.

---

### `krolik mem` — Remember Across Sessions

AI forgets everything between sessions. Krolik remembers.

```bash
krolik mem save --type decision --title "Use tRPC" --description "Type-safe API"
krolik mem search --query "authentication"
krolik mem recent --limit 5
```

**Memory types**: decisions, patterns, bugfixes, observations, features.

Memories are automatically included in context — AI sees what was decided before.

---

### `krolik audit` — Find All Quality Issues

Analyzes entire codebase and creates a prioritized report.

```bash
krolik audit
```

**Output**: `.krolik/AI-REPORT.md` with issues ranked by severity, files with most problems, and quick wins that can be auto-fixed.

---

### `krolik fix` — Auto-Fix Quality Issues

Fixes what can be fixed automatically. Shows what needs manual attention.

```bash
krolik fix --dry-run        # Preview changes
krolik fix                  # Apply safe fixes
krolik fix --all            # Include risky fixes
```

**What it fixes**: console.log, debugger, any types, @ts-ignore, magic numbers, complexity issues, and more.

---

### `krolik refactor` — Find Duplicates

Finds duplicate functions and types across the codebase.

```bash
krolik refactor                  # Find duplicates
krolik refactor --apply          # Apply suggested migrations
```

**Output**: List of duplicates with locations, suggested consolidation points, migration plan.

---

### `krolik agent` — Run Specialized AI Agents

Run expert agents for specific tasks: security audit, performance review, architecture analysis.

```bash
krolik agent --list                           # Available agents
krolik agent security-auditor                 # Run specific agent
krolik agent --orchestrate --task "review"    # Multi-agent mode
```

**12 categories**: security, performance, architecture, quality, debugging, docs, frontend, backend, database, devops, testing, other.

---

### Other Commands

| Command | What it does |
|---------|--------------|
| `krolik status` | Quick health check: git, types, lint, TODOs |
| `krolik schema` | Database schema as structured docs |
| `krolik routes` | API routes as structured docs |
| `krolik review` | Code review for current changes |
| `krolik docs` | Search library documentation |

---

## MCP Server

Native integration with Claude Code via [Model Context Protocol](https://modelcontextprotocol.io).

```bash
claude mcp add krolik -- npx @anatolykoptev/krolik-cli mcp
```

All commands available as tools. Claude can use them directly during conversation.

---

## Configuration

Works out of the box for most projects. Customize if needed:

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

- Node.js >= 20.0.0
- TypeScript >= 5.0.0

## License

[MIT](LICENSE) © Anatoly Koptev
