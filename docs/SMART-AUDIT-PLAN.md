# Smart Audit: Implementation Guide

> Intent-based prioritization + impact analysis for actionable code quality reports

## Executive Summary

Transform `krolik audit` from "here's all problems" to "here's what matters for YOUR task with exact fixes".

| Aspect | Before | After |
|--------|--------|-------|
| Output | 100 flat issues | Grouped by pattern + batch ops |
| Suggestions | Generic: "Use proper types" | Exact code replacement |
| Prioritization | By category (static) | By impact on current work |
| Actionability | List of problems | Next steps with commands |
| Noise | Duplicates, truncated | Deduplicated, progressive |

---

## Status: PLANNING

### Phase 1: Smart Grouping
- ⏳ Pattern-based issue grouping
- ⏳ Batch operations for same-type issues
- ⏳ Deduplication of identical issues

### Phase 2: Progressive Disclosure
- ⏳ Executive summary (50 tokens)
- ⏳ Top issues with context (500 tokens)
- ⏳ Full report on demand

### Phase 3: Impact Analysis
- ⏳ Downstream dependency count
- ⏳ Bug correlation from git history
- ⏳ Change frequency (hot files)

### Phase 4: Context-Aware Suggestions
- ⏳ AST-based code generation
- ⏳ Before/after diff preview
- ⏳ Confidence scoring

### Phase 5: Intent-Based Prioritization
- ✅ Feature-scoped filtering (`--feature <name>`)
- ✅ Release-prep mode (`--mode release`)
- ✅ Refactoring mode (`--mode refactor`)

---

## Existing Infrastructure (Reusable Modules)

### From `context` command

| Module | Location | Reuse for Audit |
|--------|----------|-----------------|
| **@ranking** | `lib/@ranking/` | Impact scoring via PageRank |
| **matchesDomain()** | `collectors/entrypoints.ts` | Feature-scoped filtering |
| **@vcs/git** | `lib/@vcs/git/` | Bug correlation, change frequency |
| **fitToBudget()** | `lib/@tokens/` | Progressive disclosure |
| **formatQuickRef()** | `sections/quick-ref.ts` | Executive summary pattern |

### From `refactor` command

| Module | Location | Reuse for Audit |
|--------|----------|-----------------|
| **ranking.analyzer** | `commands/refactor/analyzers/` | Hotspot detection |
| **duplicates.analyzer** | `commands/refactor/analyzers/` | Pattern grouping |
| **architecture.analyzer** | `commands/refactor/analyzers/` | Dependency analysis |
| **@discovery/architecture** | `lib/@discovery/` | detectHotspots() |

### Current Audit Infrastructure

| Module | Location | Keep/Extend |
|--------|----------|-------------|
| **analyzeQuality()** | `commands/audit/` | Keep - core detection |
| **groupByPriority()** | `fix/reporter/grouping.ts` | Extend - add pattern grouping |
| **estimateEffort()** | `fix/reporter/effort.ts` | Keep - effort calculation |
| **formatAsXml()** | `fix/reporter/formatter.ts` | Extend - progressive output |
| **noise-filter** | `lib/@detectors/noise-filter/` | Keep - 5-stage pipeline |

---

## Phase 1: Smart Grouping

### Problem
100 issues displayed as flat list. Same issue type repeated 23 times without batch operation option.

```xml
<!-- CURRENT: 23 separate issues -->
<issue>Using any in file1.ts:10</issue>
<issue>Using any in file1.ts:15</issue>
<issue>Using any in file2.ts:20</issue>
...
```

### Solution
Group by pattern + offer batch operations:

```xml
<!-- TARGET: grouped with batch-fix -->
<issue-group category="type-safety" pattern="any-usage" count="23">
  <batch-fix available="true">
    <command>krolik fix --pattern any-to-unknown</command>
    <files-affected>8</files-affected>
    <auto-fixable>15</auto-fixable>
    <manual-required>8</manual-required>
  </batch-fix>

  <by-file>
    <file path="utils.ts" count="6" auto="4"/>
    <file path="api.ts" count="5" auto="3"/>
  </by-file>
</issue-group>
```

### Implementation

**Reuse:** `duplicates.analyzer` pattern from refactor

```typescript
// NEW: src/commands/audit/grouping/pattern-grouper.ts

interface IssuePattern {
  category: QualityCategory;
  pattern: string;           // 'any-usage', 'console-log', 'missing-return-type'
  issues: QualityIssue[];
  batchFixAvailable: boolean;
  batchCommand?: string;
}

function groupIssuesByPattern(issues: QualityIssue[]): IssuePattern[] {
  // 1. Group by category + message pattern
  const patterns = new Map<string, QualityIssue[]>();

  for (const issue of issues) {
    const patternKey = extractPattern(issue);  // 'type-safety:any-usage'
    if (!patterns.has(patternKey)) {
      patterns.set(patternKey, []);
    }
    patterns.get(patternKey)!.push(issue);
  }

  // 2. Determine batch-fix availability
  return Array.from(patterns.entries()).map(([key, issues]) => ({
    category: issues[0].category,
    pattern: key.split(':')[1],
    issues,
    batchFixAvailable: BATCH_FIXABLE_PATTERNS.includes(key),
    batchCommand: getBatchCommand(key),
  }));
}

function extractPattern(issue: QualityIssue): string {
  // Normalize message to pattern
  const msg = issue.message.toLowerCase();

  if (msg.includes('any')) return `${issue.category}:any-usage`;
  if (msg.includes('console')) return `${issue.category}:console-log`;
  if (msg.includes('complexity')) return `${issue.category}:high-complexity`;
  if (msg.includes('return type')) return `${issue.category}:missing-return-type`;
  // ... more patterns

  return `${issue.category}:other`;
}

const BATCH_FIXABLE_PATTERNS = [
  'lint:console-log',
  'lint:debugger',
  'type-safety:any-to-unknown',
  'type-safety:missing-return-type',
];
```

**Deduplication:** Remove exact duplicates (same file:line:message)

```typescript
// NEW: src/commands/audit/grouping/deduplicator.ts

function deduplicateIssues(issues: QualityIssue[]): QualityIssue[] {
  const seen = new Set<string>();
  return issues.filter(issue => {
    const key = `${issue.file}:${issue.line}:${issue.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
```

### Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| NEW: `commands/audit/grouping/pattern-grouper.ts` | Create | Pattern extraction + grouping |
| NEW: `commands/audit/grouping/deduplicator.ts` | Create | Remove exact duplicates |
| NEW: `commands/audit/grouping/batch-commands.ts` | Create | Batch fix command mapping |
| `fix/reporter/formatter.ts` | Modify | Add `<issue-group>` XML format |
| `fix/reporter/types.ts` | Modify | Add `IssuePattern` type |

---

## Phase 2: Progressive Disclosure

### Problem
Full report dumped at once. Agent sees 100 issues, doesn't know where to start.

### Solution
3-level output with token budgets:

```xml
<audit>
  <!-- Level 1: Executive Summary (~50 tokens) - ALWAYS shown -->
  <executive-summary>
    <health score="C" trend="improving"/>
    <critical count="3"/>
    <quick-win command="krolik fix --safe" result="7 issues in 2 min"/>
    <focus file="slots.ts" reason="hottest: 4 critical, 50 deps"/>
  </executive-summary>

  <!-- Level 2: Top Issues (~500 tokens) - DEFAULT -->
  <top-issues count="10">
    <issue-group pattern="any-usage" count="23" batch="true"/>
    <issue-group pattern="high-complexity" count="5" batch="false"/>
    ...
  </top-issues>

  <!-- Level 3: Full Report - ON DEMAND -->
  <full-report file=".krolik/AUDIT.xml">
    Run: krolik audit --full
  </full-report>
</audit>
```

### Implementation

**Reuse:** `formatQuickRefSection()` pattern from context

```typescript
// NEW: src/commands/audit/output/progressive.ts

interface AuditOutputLevel {
  level: 1 | 2 | 3;
  tokenBudget: number;
  sections: string[];
}

const OUTPUT_LEVELS: Record<string, AuditOutputLevel> = {
  summary: { level: 1, tokenBudget: 50, sections: ['executive-summary'] },
  default: { level: 2, tokenBudget: 500, sections: ['executive-summary', 'top-issues'] },
  full: { level: 3, tokenBudget: 5000, sections: ['all'] },
};

function formatProgressiveOutput(
  report: AuditReport,
  level: AuditOutputLevel
): string {
  const sections: string[] = [];

  // Always include executive summary
  sections.push(formatExecutiveSummary(report));

  if (level.level >= 2) {
    sections.push(formatTopIssues(report, 10));
  }

  if (level.level >= 3) {
    sections.push(formatFullReport(report));
  }

  return fitToBudget(sections.join('\n'), level.tokenBudget);
}

function formatExecutiveSummary(report: AuditReport): string {
  const health = calculateHealthScore(report);
  const criticalCount = report.issues.filter(i => i.priority === 'critical').length;
  const quickWin = findBestQuickWin(report);
  const hottest = findHottestFile(report);

  return `
<executive-summary>
  <health score="${health.grade}" trend="${health.trend}"/>
  <critical count="${criticalCount}"/>
  <quick-win command="${quickWin.command}" result="${quickWin.result}"/>
  <focus file="${hottest.file}" reason="${hottest.reason}"/>
</executive-summary>`.trim();
}
```

### Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| NEW: `commands/audit/output/progressive.ts` | Create | Level-based output |
| NEW: `commands/audit/output/executive-summary.ts` | Create | Summary generation |
| NEW: `commands/audit/output/health-score.ts` | Create | Health calculation |
| `fix/reporter/formatter.ts` | Modify | Use progressive output |
| `cli/commands/audit.ts` | Modify | Add `--full` flag |

---

## Phase 3: Impact Analysis

### Problem
All issues treated equally. `any` in unused file same priority as `any` in core util with 50 dependents.

### Solution
Score by downstream impact:

```xml
<issue file="slots.ts:154" priority="P0">
  <description>Function complexity 36</description>
  <impact>
    <dependents count="50"/>
    <bug-history count="4" period="30d"/>
    <change-frequency rank="top-5%"/>
  </impact>
  <risk>critical</risk>
</issue>
```

### Implementation

**Reuse:** `@ranking` (PageRank), `ranking.analyzer` (hotspots), `@vcs/git` (history)

```typescript
// NEW: src/commands/audit/impact/analyzer.ts

import { pageRank } from '@/lib/@ranking';
import { getRecentCommits, getBlameInfo } from '@/lib/@vcs/git';

interface ImpactScore {
  dependents: number;      // Files that import this
  bugHistory: number;      // Bug-fix commits in last 30 days
  changeFrequency: number; // Commits in last 30 days
  pageRank: number;        // Importance in dependency graph
  riskLevel: 'critical' | 'high' | 'medium' | 'low';
}

async function analyzeImpact(
  file: string,
  projectRoot: string,
  graph: SymbolGraph
): Promise<ImpactScore> {
  // 1. Dependents from PageRank (reuse from context)
  const ranks = pageRank(graph, { damping: 0.85 });
  const pageRankScore = ranks.get(file) || 0;

  // 2. Count direct dependents
  const dependents = graph.edges.filter(e => e.to === file).length;

  // 3. Bug history from git (reuse @vcs/git)
  const commits = await getRecentCommits(projectRoot, { file, days: 30 });
  const bugCommits = commits.filter(c =>
    c.message.toLowerCase().includes('fix') ||
    c.message.toLowerCase().includes('bug')
  );

  // 4. Change frequency
  const changeFrequency = commits.length;

  // 5. Calculate risk level
  const riskLevel = calculateRiskLevel({
    dependents,
    bugHistory: bugCommits.length,
    changeFrequency,
    pageRank: pageRankScore,
  });

  return {
    dependents,
    bugHistory: bugCommits.length,
    changeFrequency,
    pageRank: pageRankScore,
    riskLevel,
  };
}

function calculateRiskLevel(scores: Omit<ImpactScore, 'riskLevel'>): ImpactScore['riskLevel'] {
  const total =
    (scores.dependents > 20 ? 3 : scores.dependents > 5 ? 2 : 1) +
    (scores.bugHistory > 3 ? 3 : scores.bugHistory > 0 ? 2 : 0) +
    (scores.changeFrequency > 10 ? 2 : scores.changeFrequency > 3 ? 1 : 0) +
    (scores.pageRank > 0.05 ? 2 : scores.pageRank > 0.01 ? 1 : 0);

  if (total >= 8) return 'critical';
  if (total >= 5) return 'high';
  if (total >= 3) return 'medium';
  return 'low';
}
```

### Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| NEW: `commands/audit/impact/analyzer.ts` | Create | Impact scoring |
| NEW: `commands/audit/impact/git-history.ts` | Create | Bug correlation |
| NEW: `commands/audit/impact/types.ts` | Create | ImpactScore type |
| `fix/reporter/grouping.ts` | Modify | Use impact in priority |
| `fix/reporter/formatter.ts` | Modify | Add `<impact>` to XML |

---

## Phase 4: Context-Aware Suggestions

### Problem
Suggestions are generic: "Use proper TypeScript types". Agent doesn't know exact fix.

### Solution
AST-based code generation with before/after:

```xml
<issue file="api.ts:7">
  <description>Using `any` type</description>
  <suggestion confidence="87%">
    <before><![CDATA[const handler: any = (req) => ...]]></before>
    <after><![CDATA[const handler: RequestHandler<BookingParams> = (req) => ...]]></after>
    <reasoning>
      Inferred from usage: req.params.id used as string,
      req.body matches BookingInput schema from line 45
    </reasoning>
  </suggestion>
</issue>
```

### Implementation

**Reuse:** `@ast/swc` for parsing, `@ast/ts-morph` for type inference

```typescript
// NEW: src/commands/audit/suggestions/generator.ts

import { parseFile, visitNodeWithCallbacks } from '@/lib/@ast/swc';

interface Suggestion {
  before: string;
  after: string;
  reasoning: string;
  confidence: number;  // 0-100
}

function generateSuggestion(issue: QualityIssue): Suggestion | null {
  const content = readFileSync(issue.file, 'utf-8');
  const { ast } = parseFile(issue.file, content);

  switch (issue.category) {
    case 'type-safety':
      return generateTypeSafetySuggestion(issue, ast, content);
    case 'complexity':
      return generateComplexitySuggestion(issue, ast, content);
    case 'lint':
      return generateLintSuggestion(issue, ast, content);
    default:
      return null;
  }
}

function generateTypeSafetySuggestion(
  issue: QualityIssue,
  ast: AST,
  content: string
): Suggestion | null {
  if (issue.message.includes('any')) {
    // Find the `any` usage
    const line = content.split('\n')[issue.line - 1];

    // Try to infer type from usage
    const inferredType = inferTypeFromUsage(ast, issue.line);

    if (inferredType) {
      return {
        before: line.trim(),
        after: line.replace(/:\s*any/, `: ${inferredType}`).trim(),
        reasoning: `Inferred ${inferredType} from usage patterns`,
        confidence: inferredType === 'unknown' ? 100 : 75,
      };
    }

    // Fallback to `unknown`
    return {
      before: line.trim(),
      after: line.replace(/:\s*any/, ': unknown').trim(),
      reasoning: 'Safe replacement: unknown requires type guards',
      confidence: 100,
    };
  }

  return null;
}
```

### Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| NEW: `commands/audit/suggestions/generator.ts` | Create | Main suggestion logic |
| NEW: `commands/audit/suggestions/type-inference.ts` | Create | Type inference from usage |
| NEW: `commands/audit/suggestions/complexity.ts` | Create | Refactoring suggestions |
| NEW: `commands/audit/suggestions/lint.ts` | Create | Lint fix suggestions |
| `fix/reporter/formatter.ts` | Modify | Add `<suggestion>` with before/after |

---

## Phase 5: Intent-Based Prioritization

### Problem
All 100 issues shown regardless of current task. Working on booking feature but seeing events issues.

### Solution
Filter by intent/mode:

```bash
# Feature mode - only issues in booking files
krolik audit --feature booking

# Release mode - security + type-safety only
krolik audit --mode release

# Refactor mode - complexity + SRP only
krolik audit --mode refactor
```

### Implementation

**Reuse:** `matchesDomain()` from context/collectors/entrypoints.ts

```typescript
// NEW: src/commands/audit/filters/intent.ts

import { matchesDomain } from '@/commands/context/collectors/entrypoints';

type AuditMode = 'all' | 'feature' | 'release' | 'refactor';

interface AuditIntent {
  mode: AuditMode;
  feature?: string;
  categories?: QualityCategory[];
}

const MODE_CATEGORIES: Record<AuditMode, QualityCategory[]> = {
  all: [], // all categories
  release: ['security', 'type-safety', 'circular-dep'],
  refactor: ['complexity', 'srp', 'mixed-concerns', 'size'],
  feature: [], // determined by feature filter
};

function filterByIntent(
  issues: QualityIssue[],
  intent: AuditIntent
): QualityIssue[] {
  let filtered = issues;

  // 1. Filter by feature (domain matching)
  if (intent.feature) {
    filtered = filtered.filter(issue =>
      matchesDomain(issue.file, [intent.feature!])
    );
  }

  // 2. Filter by mode categories
  const categories = intent.categories || MODE_CATEGORIES[intent.mode];
  if (categories.length > 0) {
    filtered = filtered.filter(issue =>
      categories.includes(issue.category)
    );
  }

  return filtered;
}
```

### Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| NEW: `commands/audit/filters/intent.ts` | Create | Intent-based filtering |
| `cli/commands/audit.ts` | Modify | Add `--feature`, `--mode` flags |
| `commands/audit/index.ts` | Modify | Apply intent filter |

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                      krolik audit --smart                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. Issue Collection (existing)                                 │
│     └── analyzeQuality() → 16 categories, noise filter          │
│                                                                  │
│  2. Intent Filtering (NEW - Phase 5)                            │
│     ├── REUSE: matchesDomain() from context                     │
│     └── NEW: mode-based category filtering                      │
│                                                                  │
│  3. Impact Analysis (NEW - Phase 3)                             │
│     ├── REUSE: pageRank() from @ranking                         │
│     ├── REUSE: getRecentCommits() from @vcs/git                 │
│     └── NEW: calculateRiskLevel()                               │
│                                                                  │
│  4. Smart Grouping (NEW - Phase 1)                              │
│     ├── NEW: groupIssuesByPattern()                             │
│     ├── NEW: deduplicateIssues()                                │
│     └── NEW: getBatchCommand()                                  │
│                                                                  │
│  5. Suggestion Generation (NEW - Phase 4)                       │
│     ├── REUSE: parseFile() from @ast/swc                        │
│     └── NEW: generateSuggestion() with before/after             │
│                                                                  │
│  6. Progressive Output (NEW - Phase 2)                          │
│     ├── REUSE: fitToBudget() from @tokens                       │
│     ├── NEW: formatExecutiveSummary()                           │
│     └── NEW: formatTopIssues()                                  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Module Structure

```
src/commands/audit/
├── index.ts                    # Main entry (existing)
├── grouping/                   # NEW - Phase 1
│   ├── pattern-grouper.ts      # Group by issue pattern
│   ├── deduplicator.ts         # Remove duplicates
│   └── batch-commands.ts       # Batch fix mapping
├── output/                     # NEW - Phase 2
│   ├── progressive.ts          # Level-based output
│   ├── executive-summary.ts    # Summary generation
│   └── health-score.ts         # Health calculation
├── impact/                     # NEW - Phase 3
│   ├── analyzer.ts             # Impact scoring
│   ├── git-history.ts          # Bug correlation
│   └── types.ts                # ImpactScore type
├── suggestions/                # NEW - Phase 4
│   ├── generator.ts            # Main suggestion logic
│   ├── type-inference.ts       # Type inference
│   ├── complexity.ts           # Refactoring suggestions
│   └── lint.ts                 # Lint fix suggestions
├── filters/                    # NEW - Phase 5
│   └── intent.ts               # Intent-based filtering
└── types.ts                    # Shared types
```

---

## CLI Flags

```bash
# Current
krolik audit                    # Full audit

# New flags
krolik audit --smart            # Enable all smart features
krolik audit --feature booking  # Filter to booking domain
krolik audit --mode release     # Security + type-safety only
krolik audit --mode refactor    # Complexity + SRP only
krolik audit --full             # Full report (Level 3)
krolik audit --summary          # Executive summary only (Level 1)
```

---

## Implementation Order

| Phase | Priority | Effort | Reuse % | New Code |
|-------|----------|--------|---------|----------|
| **1: Smart Grouping** | HIGH | Medium | 30% | pattern-grouper, deduplicator |
| **2: Progressive Disclosure** | HIGH | Low | 50% | executive-summary, health-score |
| **3: Impact Analysis** | MEDIUM | Medium | 60% | git-history integration |
| **4: Context-Aware Suggestions** | LOW | High | 40% | type-inference, AST analysis |
| **5: Intent-Based Prioritization** | MEDIUM | Low | 80% | intent filter only |

**Recommended order:** 1 → 2 → 5 → 3 → 4

---

## Files Summary

| File | Phase | Reuses |
|------|-------|--------|
| `grouping/pattern-grouper.ts` | 1 | duplicates.analyzer pattern |
| `grouping/deduplicator.ts` | 1 | - |
| `grouping/batch-commands.ts` | 1 | - |
| `output/progressive.ts` | 2 | fitToBudget() |
| `output/executive-summary.ts` | 2 | formatQuickRefSection() pattern |
| `output/health-score.ts` | 2 | - |
| `impact/analyzer.ts` | 3 | pageRank(), getRecentCommits() |
| `impact/git-history.ts` | 3 | @vcs/git |
| `suggestions/generator.ts` | 4 | @ast/swc |
| `suggestions/type-inference.ts` | 4 | @ast/ts-morph |
| `filters/intent.ts` | 5 | matchesDomain() |

---

## Validation Criteria

### Phase 1: Smart Grouping
- [ ] 23 `any` issues grouped into 1 `<issue-group>`
- [ ] Batch command shown: `krolik fix --pattern any-to-unknown`
- [ ] No duplicate issues (same file:line)
- [ ] Issues grouped by file within pattern

### Phase 2: Progressive Disclosure
- [ ] Default output < 500 tokens
- [ ] Executive summary < 50 tokens
- [ ] `--full` shows all issues
- [ ] `--summary` shows only Level 1

### Phase 3: Impact Analysis
- [ ] Hot files (>20 dependents) marked as critical
- [ ] Bug correlation shows last 30 days
- [ ] PageRank used for prioritization

### Phase 4: Context-Aware Suggestions
- [ ] `any` → `unknown` suggestion with 100% confidence
- [ ] Type inference from usage patterns
- [ ] Before/after code shown

### Phase 5: Intent-Based Prioritization
- [x] `--feature booking` shows only booking files
- [x] `--mode release` shows only security + type-safety
- [x] Filters combine correctly

---

## Success Metrics

| Metric | Before | Target |
|--------|--------|--------|
| Duplicate issues | Yes | None |
| Flat issue list | 100 items | 10-15 groups |
| Default output tokens | 2000+ | < 500 |
| Actionable suggestions | 0% | 80% |
| Batch operations | No | Yes |
| Feature filtering | No | Yes |
| Impact visibility | No | Yes |

---

## References

- [SMART-CONTEXT-PLAN.md](./SMART-CONTEXT-PLAN.md) - Similar implementation for context
- [Current audit implementation](../src/commands/audit/)
- [Noise filter pipeline](../src/lib/@detectors/noise-filter/)
- [PageRank ranking](../src/lib/@ranking/)
