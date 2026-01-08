# Roadmap: Fix/Refactor to Google-Level Quality

> **Goal:** Bring krolik-cli fix/refactor commands to production-grade quality comparable with Google Error Prone, Biome, ESLint.

## Current State

| Command | Score | Status |
|---------|-------|--------|
| fix | 6.6/10 | Usable, but risky |
| refactor | 7.0/10 | Good for single-package |
| audit | 8.2/10 | Production-ready |

## Critical Gaps

| Gap | Current | Google-Level | Priority |
|-----|---------|--------------|----------|
| Test coverage | 0 tests for fix | 90%+ per rule | P0 |
| AST vs Regex | 13/18 regex-based | 100% AST | P0 |
| Safe/Unsafe separation | None | Explicit flags | P1 |
| Typecheck timeout | No timeout | 30s default | P1 |
| Syntax validation | None | Re-parse after fix | P1 |
| SARIF output | XML only | SARIF standard | P2 |
| LSP server | CLI only | Real-time diagnostics | P2 |
| Incremental cache | Full rescan | Hash-based cache | P2 |

---

## Phase 1: Foundation (2-3 days)

### 1.1 Add test infrastructure for fix command
- [ ] Create `tests/unit/commands/fix/` directory structure
- [ ] Add test utilities for fixer testing
- [ ] Write snapshot tests for each fixer output

### 1.2 Add timeout for typecheck
- [ ] Wrap typecheck spawn with Promise.race timeout
- [ ] Add `--typecheck-timeout` CLI option (default 30s)
- [ ] Handle timeout gracefully with clear error message

### 1.3 Implement Safe/Unsafe fix separation
- [ ] Add `--unsafe` flag to fix command
- [ ] Default behavior: only apply `difficulty: 'trivial'` fixes
- [ ] With `--unsafe`: apply all fixes including `'risky'`
- [ ] Update help text and documentation

### 1.4 Add syntax validation after fix
- [ ] Parse result with SWC after applying fixes
- [ ] Rollback file if syntax is invalid
- [ ] Report validation errors clearly

---

## Phase 2: AST Migration (1 week)

### 2.1 Migrate any-type fixer to AST
- [ ] Replace regex `/:\s*any\b/` with ts-morph traversal
- [ ] Handle edge cases: strings, comments, JSX
- [ ] Add 10+ unit tests for edge cases
- [ ] Benchmark performance vs regex

### 2.2 Migrate equality fixer to AST
- [ ] Replace `line.replace(/==/g, '===')` with AST
- [ ] Preserve intentional `== null` patterns
- [ ] Add tests for template literals, JSX

### 2.3 Migrate eval fixer to AST
- [ ] Use AST to find `eval()` calls
- [ ] Distinguish `eval` identifier vs property
- [ ] Add tests

### 2.4 Migrate remaining regex fixers
- [ ] console fixer (partially done)
- [ ] debugger fixer
- [ ] alert fixer
- [ ] ts-ignore fixer

### 2.5 Add integration tests
- [ ] End-to-end tests for fix command
- [ ] Test dry-run mode
- [ ] Test backup/rollback functionality
- [ ] Test parallel execution

---

## Phase 3: Enterprise Features (2 weeks)

### 3.1 SARIF output format
- [ ] Add `sarif` npm dependency
- [ ] Implement SARIF formatter for audit output
- [ ] Add `--format sarif` CLI option
- [ ] Test with GitHub Code Scanning

### 3.2 Incremental caching
- [ ] Implement file hash-based cache
- [ ] Store cache in `.krolik/cache/`
- [ ] Invalidate on config/version change
- [ ] Add `--cache` and `--no-cache` flags

### 3.3 LSP server (basic)
- [ ] Create `krolik lsp` command
- [ ] Implement `textDocument/diagnostic`
- [ ] Implement `textDocument/codeAction` for fixes
- [ ] Test with VS Code

### 3.4 Per-rule configuration
- [ ] Add `rules` section to `.krolik.json`
- [ ] Support enable/disable per rule
- [ ] Support severity override
- [ ] Support rule-specific options

### 3.5 Suppression comments
- [ ] Implement `// krolik-ignore` comment
- [ ] Implement `// krolik-ignore-next-line`
- [ ] Implement `// krolik-ignore-file`
- [ ] Require reason: `// krolik-ignore: intentional`

---

## Phase 4: Polish (1 week)

### 4.1 Documentation
- [ ] Generate rule documentation from metadata
- [ ] Add examples for each rule
- [ ] Create migration guide from ESLint
- [ ] Add troubleshooting section

### 4.2 Performance profiling
- [ ] Add `--timing` flag
- [ ] Report per-rule execution time
- [ ] Report per-file analysis time
- [ ] Identify slow rules

### 4.3 Baseline mode
- [ ] Implement `krolik baseline` command
- [ ] Store current issues as baseline
- [ ] Report only new issues vs baseline
- [ ] Support gradual adoption

### 4.4 CI/CD integration
- [ ] Add GitHub Action
- [ ] Add GitLab CI template
- [ ] Add pre-commit hook config
- [ ] Document exit codes

---

## GitHub Issues

### Phase 1 Issues

```
Title: [fix] Add test infrastructure for fix command
Labels: enhancement, testing, priority:p0
Milestone: Phase 1 - Foundation

## Description
The fix command currently has 0 tests, making it risky to modify.

## Tasks
- [ ] Create `tests/unit/commands/fix/` directory
- [ ] Add test utilities (mock file system, snapshot helpers)
- [ ] Write basic tests for console, debugger, alert fixers
- [ ] Add CI check for test coverage

## Acceptance Criteria
- [ ] 50+ tests for fix command
- [ ] All fixers have at least 3 tests
- [ ] Edge cases covered (strings, comments, JSX)
```

```
Title: [fix] Add timeout for typecheck integration
Labels: bug, priority:p1
Milestone: Phase 1 - Foundation

## Description
`runTypecheck()` can hang indefinitely on large projects.

## Tasks
- [ ] Add Promise.race with 30s timeout
- [ ] Add `--typecheck-timeout` CLI option
- [ ] Handle timeout with clear error message

## Acceptance Criteria
- [ ] Typecheck never hangs more than timeout
- [ ] Timeout is configurable
- [ ] Error message suggests increasing timeout
```

```
Title: [fix] Implement Safe/Unsafe fix separation
Labels: enhancement, breaking-change, priority:p1
Milestone: Phase 1 - Foundation

## Description
Currently all fixes apply the same way. Google-level tools (Biome) separate safe vs unsafe fixes.

## Tasks
- [ ] Add `--unsafe` flag
- [ ] Default: only `trivial` difficulty fixes
- [ ] With `--unsafe`: include `safe` and `risky`
- [ ] Update documentation

## Acceptance Criteria
- [ ] `krolik fix` applies only trivial fixes
- [ ] `krolik fix --unsafe` applies all fixes
- [ ] Clear messaging about what was skipped
```

```
Title: [fix] Add syntax validation after applying fixes
Labels: enhancement, priority:p1
Milestone: Phase 1 - Foundation

## Description
Fixes can produce invalid syntax. Should validate and rollback if broken.

## Tasks
- [ ] Parse result with SWC after fix
- [ ] Rollback if syntax invalid
- [ ] Report clear error with before/after diff

## Acceptance Criteria
- [ ] Invalid syntax never written to disk
- [ ] User sees what went wrong
- [ ] Original file preserved
```

### Phase 2 Issues

```
Title: [fix] Migrate any-type fixer from regex to AST
Labels: enhancement, refactor, priority:p0
Milestone: Phase 2 - AST Migration

## Description
Current implementation uses regex `/:\s*any\b/` which can match inside strings.

## Current (broken)
const msg = "Type: any value"; // False positive!

## Tasks
- [ ] Use ts-morph to traverse type annotations
- [ ] Only match actual `any` type references
- [ ] Add 10+ tests for edge cases
- [ ] Benchmark performance

## Acceptance Criteria
- [ ] No false positives in strings/comments
- [ ] Performance within 2x of regex
- [ ] All edge cases tested
```

```
Title: [fix] Migrate equality fixer to AST
Labels: enhancement, refactor, priority:p1
Milestone: Phase 2 - AST Migration

## Description
Regex replacement `== → ===` can break intentional `== null` checks.

## Tasks
- [ ] Use AST to find BinaryExpression with == operator
- [ ] Preserve `== null` and `== undefined` patterns
- [ ] Handle template literals correctly

## Acceptance Criteria
- [ ] `x == null` not changed (intentional)
- [ ] `x == y` changed to `x === y`
- [ ] No changes in strings
```

```
Title: [fix] Add integration tests for fix command
Labels: testing, priority:p1
Milestone: Phase 2 - AST Migration

## Description
Need end-to-end tests for full fix workflow.

## Tasks
- [ ] Test `krolik fix --dry-run`
- [ ] Test `krolik fix` with actual file changes
- [ ] Test backup creation and rollback
- [ ] Test parallel execution with multiple files

## Acceptance Criteria
- [ ] Full workflow tested
- [ ] Backup/rollback verified
- [ ] Parallel execution safe
```

### Phase 3 Issues

```
Title: [audit] Add SARIF output format
Labels: enhancement, priority:p2
Milestone: Phase 3 - Enterprise Features

## Description
SARIF is the standard format for static analysis results, supported by GitHub Code Scanning.

## Tasks
- [ ] Add `sarif` npm dependency
- [ ] Implement SARIF formatter
- [ ] Add `--format sarif` option
- [ ] Test with GitHub Code Scanning upload

## Acceptance Criteria
- [ ] Valid SARIF 2.1.0 output
- [ ] Works with `gh code-scanning upload-sarif`
- [ ] All issue metadata preserved
```

```
Title: [core] Implement incremental caching
Labels: enhancement, performance, priority:p2
Milestone: Phase 3 - Enterprise Features

## Description
Currently every run re-analyzes all files. Should cache by file hash.

## Tasks
- [ ] Implement file content hashing
- [ ] Store results in `.krolik/cache/`
- [ ] Invalidate on config/version change
- [ ] Add `--cache` / `--no-cache` flags

## Acceptance Criteria
- [ ] Second run 10x faster with cache
- [ ] Cache invalidates correctly
- [ ] `--no-cache` forces full analysis
```

```
Title: [core] Basic LSP server
Labels: enhancement, priority:p2
Milestone: Phase 3 - Enterprise Features

## Description
Enable real-time diagnostics in editors via LSP.

## Tasks
- [ ] Create `krolik lsp` command
- [ ] Implement `textDocument/diagnostic`
- [ ] Implement `textDocument/codeAction`
- [ ] Create VS Code extension config

## Acceptance Criteria
- [ ] Diagnostics show in VS Code
- [ ] Quick fixes work
- [ ] No performance degradation
```

```
Title: [core] Per-rule configuration in .krolik.json
Labels: enhancement, priority:p2
Milestone: Phase 3 - Enterprise Features

## Description
Allow enabling/disabling rules and changing severity per-project.

## Example config
```json
{
  "rules": {
    "any-type": "off",
    "console-log": "warn",
    "complexity": { "severity": "error", "maxComplexity": 15 }
  }
}
```

## Tasks
- [ ] Add `rules` section schema
- [ ] Implement rule filtering by config
- [ ] Support severity override
- [ ] Support rule-specific options

## Acceptance Criteria
- [ ] Rules can be disabled
- [ ] Severity can be overridden
- [ ] Options passed to rules
```

```
Title: [core] Suppression comments
Labels: enhancement, priority:p2
Milestone: Phase 3 - Enterprise Features

## Description
Allow suppressing specific issues with comments.

## Syntax
```typescript
// krolik-ignore: intentional any for legacy code
const x: any = legacyFunction();

// krolik-ignore-next-line
console.log(debug);

// krolik-ignore-file
```

## Tasks
- [ ] Parse suppression comments
- [ ] Filter issues by suppression
- [ ] Require reason in strict mode
- [ ] Report suppressed count in summary

## Acceptance Criteria
- [ ] All suppression types work
- [ ] Reason captured in reports
- [ ] `--strict` requires reasons
```

### Phase 4 Issues

```
Title: [docs] Generate rule documentation
Labels: documentation, priority:p2
Milestone: Phase 4 - Polish

## Description
Auto-generate documentation for all rules from metadata.

## Tasks
- [ ] Extract metadata from all fixers
- [ ] Generate markdown per rule
- [ ] Include examples and rationale
- [ ] Add to docs/ folder

## Acceptance Criteria
- [ ] All rules documented
- [ ] Examples for each rule
- [ ] Linked from main README
```

```
Title: [core] Performance profiling with --timing
Labels: enhancement, priority:p2
Milestone: Phase 4 - Polish

## Description
Help identify slow rules and files.

## Tasks
- [ ] Add `--timing` flag
- [ ] Measure per-rule execution time
- [ ] Measure per-file analysis time
- [ ] Output timing report

## Acceptance Criteria
- [ ] Shows top 10 slowest rules
- [ ] Shows top 10 slowest files
- [ ] Helps identify bottlenecks
```

```
Title: [core] Baseline mode for gradual adoption
Labels: enhancement, priority:p2
Milestone: Phase 4 - Polish

## Description
Allow teams to adopt krolik gradually by only reporting new issues.

## Tasks
- [ ] Add `krolik baseline` command
- [ ] Store baseline in `.krolik/baseline.json`
- [ ] Compare current issues vs baseline
- [ ] Report only new issues

## Acceptance Criteria
- [ ] Baseline captures current state
- [ ] Only new issues reported
- [ ] Easy to update baseline
```

---

## Success Metrics

| Metric | Current | Target |
|--------|---------|--------|
| Test coverage (fix) | 0% | 80%+ |
| AST-based fixers | 28% | 100% |
| False positive rate | ~10% | <2% |
| Average fix time | N/A | <5s for 1000 files |
| SARIF compliance | No | Yes |
| LSP support | No | Basic |

## Timeline

| Phase | Duration | Completion |
|-------|----------|------------|
| Phase 1 | 2-3 days | Week 1 |
| Phase 2 | 1 week | Week 2 |
| Phase 3 | 2 weeks | Week 4 |
| Phase 4 | 1 week | Week 5 |

**Total: ~5 weeks to Google-level quality**
