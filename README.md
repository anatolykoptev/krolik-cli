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

```bash
npm i -g @anatolykoptev/krolik-cli
```

---

## Commands

### Global Option: `--project`

All commands support `--project` for multi-project workspaces:

```bash
krolik status --project my-app           # Run on specific project
krolik audit --project piternow-wt-fix   # Audit specific project
krolik context --project api-service     # Context for specific project
```

This is useful when you have multiple projects in a workspace and want to target a specific one.

---

### `krolik context` — Stop Searching, Start Coding

One command replaces 10+ manual searches. AI gets complete project context instantly.

```bash
krolik context --feature auth      # Everything about auth feature
krolik context --issue 42          # Context from GitHub issue
krolik context --search "tRPC"     # Find code matching pattern
krolik context --changed-only      # Only git-changed files
krolik context --minimal           # Ultra-compact (~1500 tokens)
krolik context --quick             # Compact with repo-map (~3500 tokens)
krolik context --deep              # Full analysis (~5s)
```

**What it collects**: git state, database schema, API routes, project structure, types, past decisions, library docs, lib modules with signatures.

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
krolik audit                       # All issues
krolik audit --mode release        # Security + type-safety
krolik audit --mode queries        # Duplicate Prisma/tRPC queries
krolik audit --mode pre-commit     # Quick check before commit
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

### `krolik refactor` — Find Duplicates & Improve Structure

Analyzes module structure, finds duplicate functions/types, suggests migrations.

```bash
krolik refactor                  # Default: function duplicates + structure (~3s)
krolik refactor --quick          # Fast: structure only (~1.5s)
krolik refactor --deep           # Full: + type duplicates (~10s)
krolik refactor --apply          # Apply migrations (with backup)
krolik refactor --fix-types      # Auto-fix identical type duplicates
```

**Output**: XML report with duplicates, structure score, domain analysis, migration plan. Saved to `.krolik/REFACTOR.xml`.

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

### `krolik docs` — Library Documentation Cache

Search and cache library documentation from Context7.

```bash
krolik docs search "app router"    # Search cached docs
krolik docs fetch next.js          # Fetch docs for a library
krolik docs detect                 # Auto-detect from package.json
krolik docs list                   # List cached libraries
```

---

### `krolik modules` — Query Lib Modules

Discover reusable utilities in your codebase before writing new code.

```bash
krolik modules                     # List all lib modules
krolik modules --search parse      # Search exports by name
krolik modules --get fs            # Details of specific module
krolik modules --paths             # Show where modules are found
```

**What it shows**: functions with signatures, types, constants — everything exported from `lib/@*` directories.

---

### Other Commands

| Command | What it does |
|---------|--------------|
| `krolik status` | Quick health check: git, types, lint, TODOs |
| `krolik schema` | Database schema as structured docs |
| `krolik routes` | API routes as structured docs |
| `krolik review` | Code review for current changes |
| `krolik issue 42` | Parse GitHub issue for context |
| `krolik codegen` | Generate hooks, schemas, tests, barrels |
| `krolik sync` | Sync CLAUDE.md with project state |
| `krolik security` | Audit dependencies for vulnerabilities |
| `krolik init` | Initialize krolik config in project |
| `krolik setup` | Install Claude Code plugins (memory) |

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

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup and release process.

**Important**: Releases are published **only via GitHub Actions** using npm Trusted Publisher. Manual `npm publish` is not allowed.

## License

[FSL-1.1-Apache-2.0](LICENSE) © Anatoly Koptev

Free for internal use, education, and research. Converts to Apache 2.0 on December 26, 2027.
