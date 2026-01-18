# Krolik CLI Roadmap

> AI-Native Development Toolkit

**Last updated:** 2025-12-23 | **MVP:** 2026-02-15

---

## Implementation Progress

| Phase | Name | Status | Completion |
|-------|------|--------|------------|
| 1 | Core Commands | ✅ Done | 100% |
| 2 | Audit & Fix Pipeline | ✅ Done | 100% |
| 3 | Auto-Fix System | 🟡 Partial | 80% |
| 4 | AI Report Generator | ✅ Done | 100% |
| 5 | Modern Integrations | ⬜ Not started | 0% |
| 6 | AI Agent Execution | ✅ Done | 100% |
| 7 | IDE & GitHub | ⬜ Not started | 0% |
| 8 | Observability | ⬜ Not started | 0% |
| 9 | **Agent Integration** | 🟡 In Progress | 70% |
| 10 | **Developer Experience** | ⬜ Not started | 0% |

**Overall: ~55%**

---

## Improvement Backlog

| # | Improvement | Priority | Status |
|---|-------------|----------|--------|
| 1 | `--from-audit` flag | P0 | ✅ Done |
| 2 | Preset flags (`--quick/--deep/--full`) | P1 | ✅ Done |
| 3 | Watch mode | P2 | ⬜ |
| 4 | Context + Audit integration (`--with-audit`) | P1 | ✅ Done |
| 5 | Smart defaults by project type | P2 | ⬜ |
| 6 | Diff preview in audit | P1 | ✅ Done |

---

## Phase 3: Auto-Fix System (Current)

**Done (11 fixers):** console, debugger, alert, ts-ignore, any-type, magic-numbers, hardcoded-urls, complexity, long-functions, srp, refine

**TODO:**
- [ ] Pattern Library (wrap-in-try, add-null-check, early-return)
- [ ] Async fix operations
- [ ] LLM-powered micro-fixes (`krolik fix --ai-assist`)

**Full catalog:** [FIXER-CATALOG.md](./FIXER-CATALOG.md)

---

## Phase 5: Modern Integrations (Next)

| Tool | Purpose | Priority |
|------|---------|----------|
| oxc | 10x faster linting | High |
| knip | Unused exports | High |
| depcheck | Unused deps | Medium |
| madge | Circular deps | Medium |

---

## Phase 9: Agent Integration (NEW)

> Интеграция с [wshobson/agents](https://github.com/wshobson/agents) — 158 агентов в 67 плагинах

### Commands

| Command | Description | Priority |
|---------|-------------|----------|
| `krolik agent <name>` | Запуск агента с контекстом проекта | P0 |
| `krolik agent --list` | Список доступных агентов | P0 |
| `krolik review --with-agents` | Review с security + perf + arch агентами | P1 |
| `krolik fix --ai-assist` | AI-powered fixes через агентов | P1 |

### Agent Categories

| Category | Agents | Use Case |
|----------|--------|----------|
| **Security** | security-auditor, backend-security-coder | `krolik agent security` |
| **Performance** | performance-engineer, database-optimizer | `krolik agent perf` |
| **Architecture** | c4-*, backend-architect | `krolik agent arch` |
| **Code Quality** | code-reviewer, codebase-cleanup | `krolik agent quality` |
| **Debugging** | error-detective, debugger, incident-responder | `krolik agent debug` |
| **Docs** | docs-architect, api-documenter, mermaid-expert | `krolik agent docs` |

### Implementation Plan

1. **Agent Loader** — загрузка .md промптов из wshobson/agents
2. **Context Injection** — передача schema/routes/git в агента
3. **Output Parser** — структурированный вывод (issues, fixes, diagrams)
4. **CLI Integration** — `krolik agent` command
5. **Review Integration** — `--with-agents` flag

### Tech Stack

- Agent prompts: Markdown files from `wshobson/agents`
- Execution: Claude API via existing MCP infrastructure
- Context: Reuse `krolik context`, `krolik schema`, `krolik routes`

---

## Phase 10: Developer Experience (NEW)

> Интеграция с [awesome-claude-skills](https://github.com/anthropics/skills) — лучшие практики Claude Skills

### Commands

| Command | Description | Source | Priority |
|---------|-------------|--------|----------|
| `krolik changelog` | Git commits → User-friendly changelog | changelog-generator | P2 |
| `krolik insights` | Анализ quality issues за период | developer-growth-analysis | P3 |
| `krolik skill init` | Scaffold для Claude Skills | skill-creator | P3 |

### Patterns to Adopt

| Pattern | Source | Application |
|---------|--------|-------------|
| **Progressive Disclosure** | skill-creator | Загрузка доков по уровням |
| **Scripts as Black Boxes** | webapp-testing | Выполнять без чтения в контекст |
| **Subagent Dispatch** | subagent-driven-development | `fix --ai-assist` workflow |
| **TDD Workflow** | test-driven-development | TDD agent для quality |

### Integration with Phase 9

| Phase 9 Feature | awesome-claude-skills Source |
|-----------------|------------------------------|
| `fix --ai-assist` | subagent-driven-development |
| Agent Categories: TDD | test-driven-development |
| Agent Categories: E2E | webapp-testing |

---

## Phase 7-8: Future

**IDE:** VSCode extension (inline diagnostics, quick fixes)
**GitHub:** Action for CI/CD, PR comments
**Enterprise:** Metrics dashboard, RBAC, custom rules

---

## Success Metrics

| Metric | Target | Current |
|--------|--------|---------|
| Commands | 18 | 13 |
| Fixers | 50 | 11 |
| Fix Coverage | 95% | 70% |
| Pipeline Speed | <2min | 4min |
| **Agent Categories** | 8 | 11 ✅ |
| **Integrated Agents** | 20+ | 158 ✅ |
| **DX Commands** | 3 | 0 |

---

## Priority Queue

### Now (Sprint 1)
1. ~~**Phase 9:** `krolik agent` command + agent loader~~ ✅ Done
2. ~~**Phase 9:** `krolik review --with-agents`~~ ✅ Done
3. **Phase 3:** Pattern Library (wrap-in-try, null-check)

### Next (Sprint 2)
4. **Phase 9:** `krolik fix --ai-assist` via agents
5. **Phase 5:** oxc integration (10x faster linting)
6. **Phase 3:** Security fixers (eval, sql-injection) — use security-auditor agent

### Later
7. **Phase 5:** knip, depcheck, madge integrations
8. **Phase 10:** `krolik changelog` (DX)
9. **Phase 7:** VSCode extension
10. **Phase 7:** GitHub Action
11. **Phase 8:** Metrics dashboard
12. **Phase 10:** `krolik insights` + `krolik skill init`

---

## Links

- [CLAUDE.md](../CLAUDE.md) — Development rules
- [FIXER-CATALOG.md](./FIXER-CATALOG.md) — All fixers
- [Fix CLAUDE.md](../src/commands/fix/CLAUDE.md) — Autofixer internals
- [wshobson/agents](https://github.com/wshobson/agents) — AI Agent marketplace (158 agents, 67 plugins)
- [awesome-claude-skills](https://github.com/anthropics/skills) — Claude Skills patterns & best practices

---

*Last updated: 2025-12-23 (Phase 10 DX added)*
