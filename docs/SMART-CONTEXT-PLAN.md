# Smart Context Implementation Plan

> Based on Aider's RepoMap architecture analysis + krolik existing infrastructure

## Executive Summary

Implement graph-based ranking for intelligent context selection, reducing token usage by 10x while improving relevance.

**Current state:** krolik context includes all files matching domain/feature
**Target state:** krolik context --smart includes only top-ranked files with signatures

---

## Existing Infrastructure (What We Already Have)

### ✅ Import Graph (2 implementations)

| Module | Location | Features |
|--------|----------|----------|
| **import-graph-swc** | `src/commands/context/parsers/import-graph-swc.ts` | SWC-based, circular detection, Mermaid output |
| **modules/signals/imports** | `src/lib/modules/signals/imports.ts` | Regex-based, importedBy map, cross-package detection |

**Key functions:**
```typescript
// From import-graph-swc.ts
buildImportGraphSwc(dir, patterns): ImportGraph
getGraphStats(graph): { mostImported, avgImportsPerFile, ... }
filterGraphByPatterns(graph, patterns): ImportGraph

// From modules/signals/imports.ts
buildImportGraph(projectRoot): Promise<ImportGraph>
findHighlyConnectedModules(graph, minImports): Array<{path, importCount}>
analyzeImportSignals(modulePath, graph): ImportSignals
```

### ✅ SWC Parsing Infrastructure

| Module | Location | Exports |
|--------|----------|---------|
| **parsing/swc** | `src/lib/parsing/swc/` | 46 exports |
| **@swc** | `src/lib/@swc/` | Re-exports + detectors |

**Key functions:**
```typescript
parseFile(filePath, content): { ast, lineOffsets }
visitNodeWithCallbacks(ast, callbacks): void
getNodeSpan(node): Span
offsetToLine(offset, lineOffsets): number
```

### ✅ Naming Analysis

| Module | Location | Features |
|--------|----------|----------|
| **modules/signals/naming** | `src/lib/modules/signals/naming.ts` | Pattern detection |

**Key functions:**
```typescript
detectNamingPattern(name): 'camelCase' | 'snake_case' | 'PascalCase' | ...
isHookName(name): boolean
isUtilityName(name): boolean
inferCategoryFromNaming(name): ModuleCategory
```

### ✅ Scoring System

| Module | Location | Features |
|--------|----------|----------|
| **modules/scorer** | `src/lib/modules/scorer.ts` | Reusability scoring |

**Key functions:**
```typescript
calculateReusabilityScore(signals): number
getScoreBreakdown(signals): ScoreBreakdown
```

---

## What Needs to Be Built

### 🔨 Phase 1: Tag Extraction

**Gap:** Current import graph only tracks file-level imports, not symbol-level definitions/references.

**Solution:** Extend `import-graph-swc.ts` with symbol extraction.

```typescript
interface Tag {
  relPath: string;      // Relative file path
  name: string;         // Symbol name
  kind: 'def' | 'ref';  // Definition or reference
  line: number;         // Line number
  type?: 'class' | 'function' | 'const' | 'type' | 'interface' | 'export';
}

interface SymbolGraph extends ImportGraph {
  tags: Tag[];
  definitions: Map<string, string[]>;  // symbol → files that define it
  references: Map<string, string[]>;   // symbol → files that reference it
}
```

**Implementation:** Add to existing `import-graph-swc.ts`:
```typescript
// New visitor callbacks
visitNodeWithCallbacks(ast, {
  onClassDeclaration: (node) => tags.push({ kind: 'def', type: 'class', ... }),
  onFunctionDeclaration: (node) => tags.push({ kind: 'def', type: 'function', ... }),
  onTsTypeAliasDeclaration: (node) => tags.push({ kind: 'def', type: 'type', ... }),
  onTsInterfaceDeclaration: (node) => tags.push({ kind: 'def', type: 'interface', ... }),
  onIdentifier: (node) => tags.push({ kind: 'ref', ... }),  // Filter for usages
});
```

---

### 🔨 Phase 2: PageRank Ranking

**Gap:** No ranking algorithm exists.

**Location:** `src/lib/smart-context/ranking.ts`

**Option A: Custom Implementation (recommended - no deps)**
```typescript
export function pageRank(
  graph: SymbolGraph,
  options: {
    damping?: number;      // 0.85 default
    iterations?: number;   // 100 default
    personalization?: Map<string, number>;  // Boost specific files
  }
): Map<string, number> {
  // Reuse existing graph structure from import-graph-swc
  // Add PageRank iteration logic
}
```

**Option B: graphology (if we need more graph algorithms later)**
```bash
pnpm add graphology graphology-pagerank
```

**Weight Multipliers (reuse existing naming analysis):**
```typescript
import { detectNamingPattern } from '@/lib/modules/signals';

function calculateSymbolWeight(symbol: string, context: WeightContext): number {
  let weight = 1.0;

  // Reuse existing naming detection
  const pattern = detectNamingPattern(symbol);
  if ((pattern === 'camelCase' || pattern === 'snake_case') && symbol.length >= 8) {
    weight *= 10;  // Meaningful names
  }

  // Private symbols
  if (symbol.startsWith('_')) weight *= 0.1;

  // Generic symbols (defined in many places)
  if (context.definitionCount > 5) weight *= 0.1;

  // Feature/domain boost
  if (context.matchesFeature) weight *= 10;

  return weight;
}
```

---

### 🔨 Phase 3: Signature Extraction

**Gap:** No signature-only extraction exists.

**Location:** `src/lib/smart-context/signatures.ts`

**Reuse:** Existing SWC visitor pattern.

```typescript
import { parseFile, visitNodeWithCallbacks, getNodeSpan } from '@/lib/parsing/swc';

interface Signature {
  file: string;
  line: number;
  text: string;  // "function parseFile(path: string): ParseResult"
  type: 'class' | 'function' | 'type' | 'interface';
}

export function extractSignatures(filePath: string, content: string): Signature[] {
  const { ast, lineOffsets } = parseFile(filePath, content);
  const signatures: Signature[] = [];

  visitNodeWithCallbacks(ast, {
    onFunctionDeclaration: (node) => {
      const span = getNodeSpan(node);
      const line = offsetToLine(span.start, lineOffsets);
      // Extract first line only (signature)
      signatures.push({
        file: filePath,
        line,
        text: extractSignatureLine(content, span),
        type: 'function',
      });
    },
    // Similar for class, type, interface
  });

  return signatures;
}
```

**Output Format (Aider-style):**
```typescript
export function formatRepoMap(
  rankedFiles: Array<{ path: string; rank: number }>,
  signatures: Map<string, Signature[]>
): string {
  let output = '';

  for (const { path } of rankedFiles) {
    const sigs = signatures.get(path) || [];
    if (sigs.length === 0) continue;

    output += `${path}:\n`;
    for (const sig of sigs) {
      output += `⋮...\n`;
      output += `│${sig.text}\n`;
    }
  }

  return output;
}
```

---

### 🔨 Phase 4: Token Budget Fitting

**Gap:** No token counting exists.

**Location:** `src/lib/smart-context/tokens.ts`

**Dependency:** `gpt-tokenizer` (lightweight, no native deps)

```bash
pnpm add gpt-tokenizer
```

```typescript
import { encode } from 'gpt-tokenizer';

export function countTokens(text: string): number {
  return encode(text).length;
}

export function fitToBudget(
  rankedFiles: string[],
  formatFn: (files: string[]) => string,
  maxTokens: number
): { output: string; filesIncluded: number; tokensUsed: number } {
  // Binary search for optimal file count
  let lower = 0;
  let upper = rankedFiles.length;
  let best = { output: '', filesIncluded: 0, tokensUsed: 0 };

  while (lower <= upper) {
    const mid = Math.floor((lower + upper) / 2);
    const output = formatFn(rankedFiles.slice(0, mid));
    const tokens = countTokens(output);

    if (tokens <= maxTokens) {
      if (tokens > best.tokensUsed) {
        best = { output, filesIncluded: mid, tokensUsed: tokens };
      }
      lower = mid + 1;
    } else {
      upper = mid - 1;
    }
  }

  return best;
}
```

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     krolik context --smart                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. Tag Extraction                                              │
│     ├── REUSE: parseFile() from @/lib/parsing/swc              │
│     ├── REUSE: visitNodeWithCallbacks() visitor pattern        │
│     └── NEW: Symbol-level def/ref extraction                   │
│                                                                  │
│  2. Graph Building                                               │
│     ├── REUSE: ImportGraph from import-graph-swc.ts            │
│     ├── REUSE: detectNamingPattern() for weight multipliers    │
│     └── NEW: Symbol → File mapping                              │
│                                                                  │
│  3. PageRank Ranking                                            │
│     ├── NEW: Custom PageRank implementation                     │
│     ├── REUSE: findHighlyConnectedModules() for validation     │
│     └── NEW: Personalization based on feature/domain           │
│                                                                  │
│  4. Signature Extraction                                        │
│     ├── REUSE: SWC parsing infrastructure                       │
│     └── NEW: Signature-only output format                       │
│                                                                  │
│  5. Token Budget Fitting                                        │
│     └── NEW: gpt-tokenizer + binary search                      │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Module Structure

RepoMap is part of the `context` command, not a separate lib module:

```
src/commands/context/
├── parsers/
│   ├── import-graph-swc.ts  # ← Existing! Extend for tags
│   ├── signatures.ts        # ← NEW: extractSignatures()
│   └── ...
├── helpers/
│   ├── ranking.ts           # ← NEW: pageRank()
│   ├── tokens.ts            # ← NEW: countTokens(), fitToBudget()
│   └── ...
├── repomap/                  # ← NEW: Smart Context module
│   ├── index.ts             # buildRepoMap() - main entry point
│   ├── types.ts             # Tag, SymbolGraph, Signature types
│   └── formatter.ts         # formatRepoMap() - Aider-style output
├── formatters/
├── index.ts                  # ← Add --smart flag integration
└── types.ts                  # ← Add SmartContextOptions
```

**Key principle:** Reuse existing infrastructure, don't duplicate:
- `parsers/import-graph-swc.ts` → extend for tag extraction
- `@/lib/parsing/swc` → use for AST parsing
- `@/lib/modules/signals` → use for naming analysis

---

## CLI Integration

### New Flags
```bash
krolik context --smart              # Enable smart ranking
krolik context --smart --budget=4000  # Token budget (default: 2000)
krolik context --signatures         # Show only signatures (no full code)
krolik context --map-only           # Output only the repo map
```

### Integration Point
```typescript
// In src/commands/context/index.ts

import { buildRepoMap } from './repomap';

if (options.smart) {
  const repoMap = await buildRepoMap(projectRoot, {
    budget: options.budget || 2000,
    feature: options.feature,
    domains: result.domains,
    signaturesOnly: options.signatures || options.mapOnly,
  });

  aiData.repoMap = repoMap.output;
  aiData.stats = repoMap.stats;  // { filesRanked, tokensUsed, topFiles }
}
```

---

## Implementation Roadmap

### Sprint 1: Tag Extraction (2-3 days)
- [ ] Create `src/lib/smart-context/` module structure
- [ ] Implement `extractTags()` using existing SWC infrastructure
- [ ] Add unit tests for class, function, type, interface extraction
- [ ] Handle edge cases: re-exports, default exports, namespace imports

### Sprint 2: PageRank (2 days)
- [ ] Implement custom PageRank algorithm in `ranking/pagerank.ts`
- [ ] Add weight multipliers using existing `detectNamingPattern()`
- [ ] Add personalization for feature/domain
- [ ] Validate against `findHighlyConnectedModules()` results

### Sprint 3: Signatures & Output (2 days)
- [ ] Implement `extractSignatures()` for function/class/type/interface
- [ ] Implement Aider-style `formatRepoMap()` output
- [ ] Add token counting with `gpt-tokenizer`
- [ ] Implement `fitToBudget()` binary search

### Sprint 4: Integration (1-2 days)
- [ ] Add `--smart`, `--budget`, `--signatures`, `--map-only` flags
- [ ] Integrate with `krolik context` command
- [ ] Add caching for repeated runs
- [ ] Benchmark on piternow-wt-fix codebase

---

## Dependencies

### New (Required)
```json
{
  "gpt-tokenizer": "^2.1.0"
}
```

### Already Available
- `@swc/core` - AST parsing (46 exports)
- `glob` - File discovery
- Existing import graph in `import-graph-swc.ts`
- Existing naming analysis in `modules/signals/naming.ts`

---

## Success Metrics

| Metric | Current | Target |
|--------|---------|--------|
| Context size (tokens) | 20-50K | 2-5K |
| Relevance | Domain-based | Graph-ranked |
| Build time | ~2s | <3s |
| Cache support | None | Yes |

---

## References

- [Aider repomap.py](https://github.com/Aider-AI/aider/blob/main/aider/repomap.py)
- [Aider repo map docs](https://aider.chat/docs/repomap.html)
- [grep_ast TreeContext](https://github.com/paul-gauthier/grep-ast)
- [NetworkX PageRank](https://networkx.org/documentation/stable/reference/algorithms/generated/networkx.algorithms.link_analysis.pagerank_alg.pagerank.html)
- **Existing krolik modules to reuse:**
  - `src/commands/context/parsers/import-graph-swc.ts` → extend for tags
  - `src/commands/context/helpers/` → add ranking.ts, tokens.ts
  - `src/lib/parsing/swc/` → AST parsing
  - `src/lib/modules/signals/naming.ts` → weight multipliers
  - `src/lib/modules/signals/imports.ts` → validation
