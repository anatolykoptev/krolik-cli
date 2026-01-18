<div align="center">

```
     (\(\
     (-.-)
     o_(")(")
```

### Multi-Tier AI Orchestration for Cost-Optimized Development

[![CI](https://github.com/anatolykoptev/krolik-cli/actions/workflows/ci.yml/badge.svg)](https://github.com/anatolykoptev/krolik-cli/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/@anatolykoptev/krolik-cli.svg?style=flat&colorA=18181B&colorB=28CF8D)](https://www.npmjs.com/package/@anatolykoptev/krolik-cli)
[![License: FSL-1.1-Apache-2.0](https://img.shields.io/badge/License-FSL--1.1-blue.svg?style=flat&colorA=18181B&colorB=28CF8D)](./LICENSE)

[Get Started](#installation) · [Felix](#krolik-felix--multi-tier-ai-routing) · [Commands](#other-commands) · [MCP Server](#mcp-server)

</div>

---

## 🚀 Cut AI Costs by 90%

Stop overpaying for AI. **Krolik Felix** automatically routes tasks to the optimal AI model tier based on complexity:

- **Simple tasks** → Free/Cheap models (formatting, refactoring, simple fixes)
- **Medium tasks** → Mid-tier models (feature implementation, debugging)
- **Complex tasks** → Premium models (architecture design, complex algorithms)

**Result**: 90% cost reduction compared to always using premium models.

---

## Installation

```bash
npm i -g @anatolykoptev/krolik-cli
```

---

## `krolik felix` — Multi-Tier AI Routing

Intelligent model orchestration that saves money without sacrificing quality.

### Core Features

#### 🎯 **Automatic Tier Selection**
Analyzes task complexity and routes to optimal tier:
- **Free tier** (Llama, DeepSeek) — 60% of tasks
- **Cheap tier** (Haiku, Flash) — 25% of tasks
- **Mid tier** (Sonnet, Pro) — 10% of tasks
- **Premium tier** (Opus, O1) — 5% of critical tasks

#### ⚡ **Cascade Fallback**
If a cheaper model fails, automatically escalates to next tier:
```
Free → Cheap → Mid → Premium
```
Ensures reliability while maintaining cost efficiency.

#### 📊 **History Learning**
SQLite database tracks success/failure patterns:
- Routes similar tasks to models that performed well historically
- Improves accuracy over time
- Learns project-specific patterns

#### 💰 **Cost Estimation**
```bash
krolik felix estimate --prd PRD.json
# Optimistic: $2.50
# Expected: $4.80
# Pessimistic: $8.20
```

### Usage

```bash
# Start autonomous execution from PRD
krolik felix start --prd PRD.json

# Get routing plan (dry-run)
krolik felix plan --prd PRD.json

# Check status
krolik felix status

# View routing statistics
krolik felix stats
```

### Example PRD

```json
{
  "name": "Add user authentication",
  "tasks": [
    {
      "id": "create-user-model",
      "description": "Create Prisma User model with email/password",
      "complexity": "low",
      "files_affected": ["prisma/schema.prisma"]
    },
    {
      "id": "implement-jwt-auth",
      "description": "Implement JWT-based authentication with refresh tokens",
      "complexity": "high",
      "files_affected": ["lib/auth.ts", "lib/jwt.ts"]
    }
  ]
}
```

**Felix analyzes each task and routes**:
- `create-user-model` → **Cheap tier** (simple schema addition)
- `implement-jwt-auth` → **Premium tier** (security-critical, complex logic)

---

## Other Commands

Krolik also provides developer productivity tools:

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

### Other Utilities

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

## Why "Felix"?

Felix (Latin for "lucky" or "successful") represents the tool's mission: making AI development cost-effective and successful for everyone. The rabbit mascot embodies speed and agility in navigating complex AI model choices.

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup.

---

## License

[FSL-1.1-Apache-2.0](LICENSE) © Anatoly Koptev

Free for internal use, education, and research. Converts to Apache 2.0 on December 26, 2027.

---

## Changelog

### v0.18.0 (2026-01-18)
- **Felix multi-tier routing** — primary feature repositioning
  - Intelligent model selection across 4 tiers (Free, Cheap, Mid, Premium)
  - Cascade fallback for reliability
  - SQLite-based history learning
  - Cost estimation and routing statistics
  - 90% cost reduction compared to always using premium models
- **Updated positioning** — Multi-tier AI orchestration as primary value proposition
- **Website launch** — krolik.tools with product documentation

### v0.17.0 (2026-01-14)
- **Toma semantic clone detection** — fast token-based duplicate detection
  - 65x faster than ML-based approach (84ms for 1600+ functions)
  - Phase 1 (O(n), hash-based) enabled by default
  - Phase 2 (O(n²), fuzzy) in deep mode only
  - 6 similarity metrics: Jaccard, Dice, Jaro-Winkler, Cosine, LCS

### v0.16.0
- Context-aware console detection (skip debug files)
- Smart magic number naming based on context

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
