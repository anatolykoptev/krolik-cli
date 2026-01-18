# Toma Approach: Semantic Clone Detection

## Overview

Implement token-based ML approach for detecting Type-3/Type-4 semantic code clones.
Based on ICSE 2024 paper "Toma" - 65x faster than deep learning, comparable accuracy.

## Current State

### Existing Detection Strategies

| Strategy | File | Detection Type |
|----------|------|----------------|
| Name-based | `strategies/name-duplicates.ts` | Same name, different files |
| Body hash | `strategies/body-duplicates.ts` | Identical normalized body |
| Structural | `strategies/structural-clones.ts` | Same fingerprint (AST structure) |

### Current Flow

```
findDuplicates() [analyzer.ts]
  ├── findSourceFiles() → list of .ts/.tsx files
  ├── parseFilesWithSwc() → FunctionSignature[]
  │     └── normalizeBody() → remove comments, normalize strings/numbers
  │     └── hashBody() → MD5 hash
  │     └── tokens → Set<string> (whitespace split)
  └── Run strategies:
        ├── findNameBasedDuplicates()
        ├── findBodyHashDuplicates()
        └── findStructuralClones()
```

### Current Similarity

```typescript
// similarity.ts - Jaccard only
calculateSimilarity(body1, body2) {
  tokens1 = body1.split(/\s+/)
  tokens2 = body2.split(/\s+/)
  return jaccardSimilarity(tokens1, tokens2)
}
```

**Limitations:**
- Whitespace tokenization misses code semantics
- No AST-aware token abstraction
- Can't detect `for(i=0;i<n;i++)` ≈ `arr.forEach()`

## Toma Approach

### Core Idea

1. **Abstract tokens** to type sequences (variable → `V`, literal → `L`, etc.)
2. **Compute multiple similarity metrics** (Jaccard, Dice, Jaro, Jaro-Winkler, Cosine)
3. **Combine into feature vector**
4. **Classify with lightweight ML** (or weighted combination)

### Token Abstraction Rules

| Original | Abstracted | Example |
|----------|------------|---------|
| Identifiers (variables) | `V` | `userId` → `V` |
| Identifiers (functions) | `F` | `getData` → `F` |
| Identifiers (types) | `T` | `UserType` → `T` |
| String literals | `S` | `"hello"` → `S` |
| Number literals | `N` | `42` → `N` |
| Keywords | Keep | `if`, `for`, `return` |
| Operators | Keep | `+`, `===`, `=>` |
| Punctuation | Keep | `{`, `}`, `;` |

### Example

```typescript
// Original A
function getUser(id: string): User {
  return db.findById(id);
}

// Original B
function fetchItem(key: string): Item {
  return store.getByKey(key);
}

// Abstracted A
function F(V: T): T { return V.F(V); }

// Abstracted B
function F(V: T): T { return V.F(V); }

// Result: 100% match (semantic clone!)
```

## Implementation Plan

### Phase 1: Token Abstraction

**New file:** `analyzers/core/duplicates/tokenization/abstract-tokens.ts`

```typescript
interface AbstractToken {
  type: 'keyword' | 'identifier' | 'literal' | 'operator' | 'punctuation';
  abstract: string;  // V, F, T, S, N, or original
  original: string;
}

function abstractTokens(code: string): AbstractToken[] {
  // Use SWC lexer for tokenization
  // Apply abstraction rules
}

function toTypeSequence(tokens: AbstractToken[]): string {
  return tokens.map(t => t.abstract).join(' ');
}
```

### Phase 2: Multi-Metric Similarity

**New file:** `analyzers/core/duplicates/similarity/multi-metric.ts`

```typescript
interface SimilarityMetrics {
  jaccard: number;      // |A ∩ B| / |A ∪ B|
  dice: number;         // 2|A ∩ B| / (|A| + |B|)
  jaro: number;         // Character-level similarity
  jaroWinkler: number;  // Jaro with prefix bonus
  cosine: number;       // Dot product / (||A|| * ||B||)
  lcs: number;          // Longest common subsequence ratio
}

function computeAllMetrics(seq1: string, seq2: string): SimilarityMetrics;

function combinedScore(metrics: SimilarityMetrics): number {
  // Weighted combination (from Toma paper)
  return 0.25 * metrics.jaccard +
         0.20 * metrics.dice +
         0.15 * metrics.jaro +
         0.15 * metrics.jaroWinkler +
         0.15 * metrics.cosine +
         0.10 * metrics.lcs;
}
```

### Phase 3: New Detection Strategy

**New file:** `analyzers/core/duplicates/strategies/semantic-clones.ts`

```typescript
export function findSemanticClones(
  allFunctions: FunctionSignature[],
  reportedLocations: Set<string>,
): DuplicateInfo[] {
  // 1. Generate abstract type sequences for all functions
  // 2. Group by sequence hash (exact semantic matches)
  // 3. For remaining, compute multi-metric similarity
  // 4. Report pairs with combinedScore > 0.7
}
```

### Phase 4: Integration

**Update:** `analyzers/core/duplicates/analyzer.ts`

```typescript
export async function findDuplicates(...) {
  // ... existing code ...

  const nameDuplicates = findNameBasedDuplicates(allFunctions);
  const bodyDuplicates = findBodyHashDuplicates(allFunctions, reportedLocations);
  const structuralClones = findStructuralClones(allFunctions, reportedLocations);

  // NEW: Semantic clone detection
  const semanticClones = findSemanticClones(allFunctions, reportedLocations);

  return [...nameDuplicates, ...bodyDuplicates, ...structuralClones, ...semanticClones];
}
```

### Phase 5: FunctionSignature Extension

**Update:** `core/types.ts`

```typescript
export interface FunctionSignature {
  // ... existing fields ...

  /** Abstract token sequence for semantic comparison */
  abstractSequence?: string;

  /** Hash of abstract sequence for quick grouping */
  abstractHash?: string;
}
```

## File Structure

```
analyzers/core/duplicates/
├── tokenization/
│   ├── index.ts
│   ├── abstract-tokens.ts    # NEW: Token abstraction
│   ├── swc-lexer.ts          # NEW: SWC-based lexer wrapper
│   └── types.ts              # NEW: Token types
├── similarity/
│   ├── index.ts
│   ├── jaccard.ts            # Move from shared
│   ├── multi-metric.ts       # NEW: Dice, Jaro, etc.
│   └── combiner.ts           # NEW: Weighted combination
├── strategies/
│   ├── index.ts              # Update exports
│   ├── name-duplicates.ts
│   ├── body-duplicates.ts
│   ├── structural-clones.ts
│   └── semantic-clones.ts    # NEW
└── ...
```

## Performance Considerations

### Current Complexity

- `O(n²)` pairwise comparison for duplicates
- ~3s for 500 files (SWC parser)

### Toma Optimization

1. **Hash-based grouping first** — exact abstract matches are instant
2. **Length filter** — skip pairs with >50% length difference
3. **Early exit** — stop computing metrics if below threshold
4. **Batch processing** — process in chunks of 100 functions

### Expected Performance

| Files | Current | With Toma |
|-------|---------|-----------|
| 100 | ~0.5s | ~0.7s |
| 500 | ~3s | ~4s |
| 1000 | ~8s | ~10s |

~25% overhead is acceptable for significantly better detection.

## Testing Strategy

### Unit Tests

```typescript
// tokenization/abstract-tokens.test.ts
test('abstracts variables to V', () => {
  expect(abstractTokens('const x = 1')).toEqual([
    { type: 'keyword', abstract: 'const', original: 'const' },
    { type: 'identifier', abstract: 'V', original: 'x' },
    { type: 'operator', abstract: '=', original: '=' },
    { type: 'literal', abstract: 'N', original: '1' },
  ]);
});
```

### Integration Tests

```typescript
// strategies/semantic-clones.test.ts
test('detects for-loop vs forEach as semantic clone', () => {
  const funcs = [
    parseFunction(`function sumA(arr) { let s = 0; for(let i = 0; i < arr.length; i++) s += arr[i]; return s; }`),
    parseFunction(`function sumB(arr) { let s = 0; arr.forEach(x => s += x); return s; }`),
  ];

  const clones = findSemanticClones(funcs, new Set());
  expect(clones.length).toBe(1);
  expect(clones[0].similarity).toBeGreaterThan(0.7);
});
```

## Migration Steps

1. **Create tokenization module** (2h)
   - Abstract token types
   - SWC lexer integration
   - Type sequence generation

2. **Create multi-metric similarity** (2h)
   - Implement Dice, Jaro, Jaro-Winkler, Cosine
   - LCS algorithm
   - Weighted combiner

3. **Create semantic-clones strategy** (2h)
   - Hash-based exact grouping
   - Similarity-based fuzzy matching
   - Integration with existing filters

4. **Update extraction** (1h)
   - Add abstractSequence to FunctionSignature
   - Generate during parsing

5. **Testing & tuning** (2h)
   - Unit tests for each module
   - Integration tests on real codebase
   - Tune thresholds

**Total: ~9h**

## Success Metrics

| Metric | Current | Target |
|--------|---------|--------|
| Detected clones | Type-1, Type-2 | Type-1, 2, 3, 4 |
| False positives | ~5% | <10% |
| Performance | 3s/500 files | <5s/500 files |
| Semantic detection | 0% | >80% |

## References

- [Toma Paper (ICSE 2024)](https://wu-yueming.github.io/Files/ICSE2024_Toma.pdf)
- [BigCloneBench Dataset](https://github.com/clonebench/BigCloneBench)
- [SWC Lexer API](https://swc.rs/docs/usage/core#lexer)
