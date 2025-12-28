# Smart Context Implementation Plan

> Based on Aider's RepoMap architecture analysis

## Executive Summary

Implement graph-based ranking for intelligent context selection, reducing token usage by 10x while improving relevance.

**Current state:** krolik context includes all files matching domain/feature
**Target state:** krolik context --smart includes only top-ranked files with signatures

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     krolik context --smart                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. Tag Extraction (SWC)                                        │
│     ├── Parse all .ts/.tsx files                                │
│     ├── Extract definitions (class, function, const, type)     │
│     └── Extract references (imports, usages)                   │
│                                                                  │
│  2. Graph Building (custom or graphology)                       │
│     ├── Nodes = files                                           │
│     ├── Edges = file A references symbol defined in file B     │
│     └── Weights = reference count × multiplier                 │
│                                                                  │
│  3. PageRank Ranking                                            │
│     ├── Apply personalization (chat files, mentioned files)    │
│     ├── Run PageRank algorithm                                  │
│     └── Sort files by rank                                      │
│                                                                  │
│  4. Signature Extraction                                        │
│     ├── For top N files                                         │
│     ├── Show only function/class signatures                    │
│     └── Collapse implementation details                        │
│                                                                  │
│  5. Token Budget Fitting                                        │
│     ├── Binary search for optimal N                             │
│     ├── Count tokens with tiktoken                              │
│     └── Output within budget                                    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Phase 1: Tag Extraction with SWC

### Location
```
src/lib/@smart-context/
├── index.ts
├── tags/
│   ├── extractor.ts      # Main tag extraction
│   ├── typescript.ts     # TS-specific patterns
│   └── types.ts
```

### Tag Structure
```typescript
interface Tag {
  relPath: string;      // Relative file path
  absPath: string;      // Absolute file path
  name: string;         // Symbol name
  kind: 'def' | 'ref';  // Definition or reference
  line: number;         // Line number
  type?: 'class' | 'function' | 'const' | 'type' | 'interface';
}
```

### Extraction Logic (using existing SWC)
```typescript
import { parseSync } from '@swc/core';

function extractTags(filePath: string, code: string): Tag[] {
  const ast = parseSync(code, { syntax: 'typescript', tsx: true });
  const tags: Tag[] = [];

  // Walk AST for definitions
  // - ClassDeclaration → def
  // - FunctionDeclaration → def
  // - VariableDeclaration (const) → def
  // - TypeAlias → def
  // - InterfaceDeclaration → def

  // Walk AST for references
  // - ImportDeclaration → ref (imported names)
  // - Identifier usages → ref

  return tags;
}
```

### Reuse from Existing Code
- `src/lib/@swc/` already has AST parsing infrastructure
- `buildImportGraph()` in context/parsers.ts already tracks imports
- Extend rather than rewrite

---

## Phase 2: Graph Building

### Dependencies
```bash
pnpm add graphology graphology-pagerank
# OR use simple custom implementation (no deps)
```

### Graph Structure
```typescript
interface FileNode {
  path: string;
  definitions: Set<string>;  // Symbols defined here
  references: Set<string>;   // Symbols referenced here
}

interface Edge {
  from: string;   // Referencing file
  to: string;     // Defining file
  weight: number; // Reference strength
  symbol: string; // What symbol connects them
}
```

### Weight Multipliers (from Aider)
```typescript
function calculateWeight(symbol: string, context: Context): number {
  let weight = 1.0;

  // Meaningful names get higher weight
  const isSnakeCase = symbol.includes('_');
  const isCamelCase = /[a-z][A-Z]/.test(symbol);
  if ((isSnakeCase || isCamelCase) && symbol.length >= 8) {
    weight *= 10;
  }

  // Private symbols get lower weight
  if (symbol.startsWith('_')) {
    weight *= 0.1;
  }

  // Symbols defined in many places get lower weight (generic)
  if (context.definitionCount > 5) {
    weight *= 0.1;
  }

  // Mentioned in chat/feature get higher weight
  if (context.mentioned) {
    weight *= 10;
  }

  // Files in chat get much higher weight
  if (context.inChat) {
    weight *= 50;
  }

  return weight;
}
```

---

## Phase 3: PageRank Implementation

### Option A: Use graphology (recommended)
```typescript
import Graph from 'graphology';
import pagerank from 'graphology-pagerank';

function rankFiles(nodes: FileNode[], edges: Edge[]): Map<string, number> {
  const graph = new Graph();

  // Add nodes
  for (const node of nodes) {
    graph.addNode(node.path);
  }

  // Add weighted edges
  for (const edge of edges) {
    graph.addEdge(edge.from, edge.to, { weight: edge.weight });
  }

  // Run PageRank with personalization
  const ranks = pagerank(graph, {
    alpha: 0.85,
    weighted: true,
    // personalization for chat files
  });

  return ranks;
}
```

### Option B: Simple custom PageRank (no deps)
```typescript
function pageRank(
  nodes: string[],
  edges: Map<string, Map<string, number>>,
  damping = 0.85,
  iterations = 100
): Map<string, number> {
  const n = nodes.length;
  let ranks = new Map(nodes.map(node => [node, 1 / n]));

  for (let i = 0; i < iterations; i++) {
    const newRanks = new Map<string, number>();

    for (const node of nodes) {
      let rank = (1 - damping) / n;

      // Sum contributions from incoming edges
      for (const [source, targets] of edges) {
        const weight = targets.get(node) || 0;
        if (weight > 0) {
          const totalWeight = [...targets.values()].reduce((a, b) => a + b, 0);
          rank += damping * (ranks.get(source)! * weight / totalWeight);
        }
      }

      newRanks.set(node, rank);
    }

    ranks = newRanks;
  }

  return ranks;
}
```

---

## Phase 4: Signature Extraction

### Location
```
src/lib/@smart-context/
├── signatures/
│   ├── extractor.ts      # Extract signatures from AST
│   ├── formatter.ts      # Format for output
│   └── types.ts
```

### Output Format (Aider-style)
```typescript
function formatSignatures(file: string, tags: Tag[]): string {
  let output = `${file}:\n`;

  // Group by class
  const classes = tags.filter(t => t.type === 'class');
  const functions = tags.filter(t => t.type === 'function');

  for (const cls of classes) {
    output += `⋮...\n`;
    output += `│class ${cls.name}:\n`;
    // Add method signatures
  }

  for (const fn of functions) {
    output += `⋮...\n`;
    output += `│function ${fn.name}(...):\n`;
  }

  return output;
}
```

### Alternative: Show actual code lines
```typescript
function formatWithContext(
  file: string,
  code: string,
  linesOfInterest: number[]
): string {
  const lines = code.split('\n');
  let output = `${file}:\n`;

  for (const lineNum of linesOfInterest) {
    output += `${lineNum}: ${lines[lineNum]}\n`;
  }

  return output;
}
```

---

## Phase 5: Token Budget Fitting

### Token Counting
```typescript
import { encode } from 'gpt-tokenizer'; // or tiktoken

function countTokens(text: string): number {
  return encode(text).length;
}
```

### Binary Search for Optimal Size
```typescript
function fitToBudget(
  rankedFiles: string[],
  formatFn: (files: string[]) => string,
  maxTokens: number
): string {
  let lower = 0;
  let upper = rankedFiles.length;
  let bestOutput = '';
  let bestTokens = 0;

  while (lower <= upper) {
    const mid = Math.floor((lower + upper) / 2);
    const output = formatFn(rankedFiles.slice(0, mid));
    const tokens = countTokens(output);

    if (tokens <= maxTokens && tokens > bestTokens) {
      bestOutput = output;
      bestTokens = tokens;
    }

    if (tokens < maxTokens) {
      lower = mid + 1;
    } else {
      upper = mid - 1;
    }
  }

  return bestOutput;
}
```

---

## CLI Integration

### New Flags
```bash
krolik context --smart              # Enable smart ranking
krolik context --smart --budget=4000  # Token budget (default: 2000)
krolik context --signatures         # Show only signatures (no full code)
krolik context --map-only           # Output only the repo map
```

### Integration with Existing Modes
```typescript
// In src/commands/context/index.ts

if (options.smart) {
  // Use new smart context pipeline
  aiData.repoMap = await buildSmartRepoMap(projectRoot, {
    budget: options.budget || 2000,
    feature: options.feature,
    domains: result.domains,
    signaturesOnly: options.signatures,
  });
} else {
  // Existing full-context behavior
  aiData.files = discoverFiles(projectRoot, result.domains);
}
```

---

## Implementation Roadmap

### Week 1: Foundation
- [ ] Create `src/lib/@smart-context/` module structure
- [ ] Implement tag extraction using existing SWC infrastructure
- [ ] Add unit tests for tag extraction

### Week 2: Graph & Ranking
- [ ] Implement graph building from tags
- [ ] Add PageRank (using graphology or custom)
- [ ] Add personalization based on feature/domain

### Week 3: Output Formatting
- [ ] Implement signature extraction
- [ ] Implement Aider-style output formatting
- [ ] Add token counting and budget fitting

### Week 4: Integration & Testing
- [ ] Integrate with `krolik context` command
- [ ] Add `--smart`, `--budget`, `--signatures` flags
- [ ] Benchmark on piternow-wt-fix codebase
- [ ] Documentation

---

## Dependencies

### Required
```json
{
  "gpt-tokenizer": "^2.1.0"  // Token counting
}
```

### Optional (for graph)
```json
{
  "graphology": "^0.25.0",
  "graphology-pagerank": "^0.6.0"
}
```

### Already Available
- `@swc/core` - AST parsing
- `fast-glob` - File discovery
- Existing import graph code in `context/parsers.ts`

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
