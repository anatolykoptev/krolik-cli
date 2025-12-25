# Unified SWC Analyzer

> Single-pass AST analyzer combining lint, type-safety, and hardcoded value detection

## Overview

The unified SWC analyzer combines three separate analyzers into a single, optimized AST pass:

1. **lint-rules-swc.ts** - console, debugger, alert, eval detection
2. **type-safety-swc.ts** - any, as any, @ts-ignore, non-null assertion detection
3. **hardcoded-swc.ts** - magic numbers, URLs, hex colors detection

## Performance Benefits

**Benchmark Results** (1200-line test file, 50 iterations):

```
Individual analyzers: 138.56ms per iteration
Unified analyzer:      27.90ms per iteration

Speedup: 4.97x faster
Time saved: 79.9%
```

**Why so fast?**

| Operation | Individual | Unified | Savings |
|-----------|-----------|---------|---------|
| parseSync() calls | 3 | 1 | 67% reduction |
| visitNode() passes | 3 | 1 | 67% reduction |
| lineOffsets calc | 3 | 1 | 67% reduction |

## Usage

### Recommended: Unified Analysis

```typescript
import { analyzeFileUnified } from './analyzers/unified-swc';

const { lintIssues, typeSafetyIssues, hardcodedValues } = analyzeFileUnified(content, filepath);

// Process all issues from single pass
processBatch([...lintIssues, ...typeSafetyIssues]);
processHardcoded(hardcodedValues);
```

### Backward Compatible: Individual Functions

```typescript
import { checkLintRulesSwc, checkTypeSafetySwc, detectHardcodedSwc } from './analyzers/unified-swc';

// Same signatures as original analyzers
const lintIssues = checkLintRulesSwc(content, filepath);
const typeSafetyIssues = checkTypeSafetySwc(content, filepath);
const hardcodedValues = detectHardcodedSwc(content, filepath);
```

## API

### analyzeFileUnified()

**Single-pass analysis returning all issue types.**

```typescript
function analyzeFileUnified(
  content: string,
  filepath: string
): UnifiedAnalysisResult

interface UnifiedAnalysisResult {
  lintIssues: QualityIssue[];
  typeSafetyIssues: QualityIssue[];
  hardcodedValues: HardcodedValue[];
}
```

**Detections:**

- **Lint**: console.*, debugger, alert/confirm/prompt, eval
- **Type-Safety**: any annotations, as any, non-null (!), @ts-ignore/@ts-nocheck
- **Hardcoded**: magic numbers (excluding 0, 1, -1, 100, 1000), URLs, hex colors

**Smart Skipping:**

- Lint: Skips infrastructure files, allows console in CLI files
- Type-Safety: Skips .d.ts, test files, infrastructure files
- Hardcoded: Skips config files, migrations, constants files

### Backward-Compatible Wrappers

**checkLintRulesSwc()**

```typescript
function checkLintRulesSwc(content: string, filepath: string): QualityIssue[]
```

Drop-in replacement for `lint-rules-swc.ts`.

**checkTypeSafetySwc()**

```typescript
function checkTypeSafetySwc(content: string, filepath: string): QualityIssue[]
```

Drop-in replacement for `type-safety-swc.ts`.

**detectHardcodedSwc()**

```typescript
function detectHardcodedSwc(content: string, filepath: string): HardcodedValue[]
```

Drop-in replacement for `hardcoded-swc.ts`.

## Implementation Details

### Single Parse Strategy

```typescript
// ⭐ BEFORE: 3 parseSync() calls (one per analyzer)
const ast1 = parseSync(content, options); // lint
const ast2 = parseSync(content, options); // type-safety
const ast3 = parseSync(content, options); // hardcoded

// ⭐ AFTER: 1 parseSync() call (shared AST)
const ast = parseSync(content, options);
```

### Single Visit Strategy

```typescript
// ⭐ BEFORE: 3 separate AST traversals
visitNode(ast1, detectLint);
visitNode(ast2, detectTypeSafety);
visitNode(ast3, detectHardcoded);

// ⭐ AFTER: 1 unified traversal
visitNodeUnified(ast, (node) => {
  const lint = detectLintIssue(node);
  const typeSafety = detectTypeSafetyIssue(node);
  const hardcoded = detectHardcodedValue(node);
});
```

### Shared Line Offsets

```typescript
// ⭐ BEFORE: 3 lineOffset calculations
const lineOffsets1 = calculateLineOffsets(content);
const lineOffsets2 = calculateLineOffsets(content);
const lineOffsets3 = calculateLineOffsets(content);

// ⭐ AFTER: 1 lineOffset calculation
const lineOffsets = calculateLineOffsets(content);
```

## Detection Logic

### Lint Detection

```typescript
function detectLintIssue(node: Node): LintIssueDetection | null {
  // 1. DebuggerStatement
  if (nodeType === 'DebuggerStatement') { ... }

  // 2. CallExpression - console.log, alert, eval
  if (nodeType === 'CallExpression') {
    // 2a. MemberExpression: console.log
    if (callee.type === 'MemberExpression' && object.value === 'console') { ... }

    // 2b. Identifier: alert(), eval()
    if (callee.type === 'Identifier' && ['alert', 'eval'].includes(callee.value)) { ... }
  }
}
```

### Type-Safety Detection

```typescript
function detectTypeSafetyIssue(node: Node): TypeSafetyIssueDetection | null {
  // 1. TsTypeAnnotation with 'any'
  if (nodeType === 'TsTypeAnnotation' && typeAnnotation.kind === 'any') { ... }

  // 2. TsAsExpression with 'any'
  if (nodeType === 'TsAsExpression' && typeAnnotation.kind === 'any') { ... }

  // 3. TsNonNullExpression (!)
  if (nodeType === 'TsNonNullExpression') { ... }

  // 4. Parameter with 'any'
  if (nodeType === 'Parameter' && paramType.kind === 'any') { ... }

  // 5. Array with 'any[]'
  if (nodeType === 'TsArrayType' && elemType.kind === 'any') { ... }
}
```

### Hardcoded Detection

```typescript
function detectHardcodedValue(node: Node, context: VisitorContext): HardcodedDetection | null {
  // 1. NumericLiteral (excluding 0, 1, -1, 100, 1000, array indices, const declarations)
  if (nodeType === 'NumericLiteral' && !ACCEPTABLE_NUMBERS.has(value)) { ... }

  // 2. StringLiteral with http(s):// (excluding localhost, example.com)
  if (nodeType === 'StringLiteral' && value.startsWith('http')) { ... }

  // 3. StringLiteral with hex color #RGB or #RRGGBB (excluding tailwind/CSS files)
  if (nodeType === 'StringLiteral' && /^#[0-9A-Fa-f]{3,6}$/.test(value)) { ... }
}
```

## Migration Guide

### For Existing Code

**Option 1: No changes needed**

The unified analyzer exports the same functions as the original analyzers. Imports will automatically use the unified versions.

**Option 2: Use unified function for better performance**

```typescript
// Before
import { checkLintRulesSwc } from './analyzers/lint-rules-swc';
import { checkTypeSafetySwc } from './analyzers/type-safety-swc';
import { detectHardcodedSwc } from './analyzers/hardcoded-swc';

const lint = checkLintRulesSwc(content, filepath);
const typeSafety = checkTypeSafetySwc(content, filepath);
const hardcoded = detectHardcodedSwc(content, filepath);

// After
import { analyzeFileUnified } from './analyzers/unified-swc';

const { lintIssues, typeSafetyIssues, hardcodedValues } = analyzeFileUnified(content, filepath);
```

### For New Code

Always use `analyzeFileUnified()` when you need multiple analysis types:

```typescript
import { analyzeFileUnified } from './analyzers/unified-swc';

const result = analyzeFileUnified(content, filepath);

// Filter and process as needed
const errors = result.lintIssues.filter(i => i.severity === 'error');
const anyUsage = result.typeSafetyIssues.filter(i => i.fixerId === 'no-any');
const urls = result.hardcodedValues.filter(v => v.type === 'url');
```

## Testing

### Correctness Test

```bash
npx tsx test-unified-analyzer.ts
```

Verifies that unified analyzer produces identical results to individual analyzers.

### Performance Benchmark

```bash
npx tsx benchmark-unified.ts
```

Measures performance improvement (expected: 2.5-5x faster).

## Architecture Decisions

### Why Single Pass?

**Problem**: Running 3 analyzers meant:
- Parsing the same file 3 times (expensive)
- Visiting each node 3 times (expensive)
- Calculating line offsets 3 times (wasteful)

**Solution**: Single unified pass:
- Parse once, visit once, calculate once
- 3x theoretical speedup (actual: ~5x due to reduced overhead)

### Why Keep Wrappers?

**Backward compatibility** without code changes:

- Existing code continues to work
- Same function signatures
- Same return types
- Gradual migration path

### Why Not Merge Files?

**Keep original analyzers** for:

- Documentation and examples
- Easier debugging (single-purpose functions)
- Gradual deprecation path
- Testing correctness

## Future Improvements

### Potential Optimizations

1. **Lazy Detection**: Skip detection types based on caller needs
2. **Parallel Processing**: Worker threads for large batches
3. **AST Caching**: Cache parsed ASTs for unchanged files
4. **Incremental Analysis**: Only re-analyze changed regions

### Integration Points

The unified analyzer can be used in:

- **krolik fix**: Single-pass issue detection
- **krolik audit**: Comprehensive analysis
- **CI/CD pipelines**: Fast pre-commit checks
- **IDE plugins**: Real-time linting

## Related Files

| File | Purpose |
|------|---------|
| `unified-swc.ts` | Main unified analyzer implementation |
| `lint-rules-swc.ts` | Original lint analyzer (reference) |
| `type-safety-swc.ts` | Original type-safety analyzer (reference) |
| `hardcoded-swc.ts` | Original hardcoded analyzer (reference) |
| `test-unified-analyzer.ts` | Correctness test suite |
| `benchmark-unified.ts` | Performance benchmark |

## Notes

- **SWC Offset Bug**: Unified analyzer handles SWC's global state bug (span offset accumulation) with baseOffset adjustment
- **Circular References**: Uses WeakSet to prevent infinite loops in AST traversal
- **Context Tracking**: Maintains parent context to skip false positives (e.g., array indices, const declarations)
- **Smart Filtering**: Each analyzer respects its own skip rules (CLI files, test files, .d.ts, etc.)
