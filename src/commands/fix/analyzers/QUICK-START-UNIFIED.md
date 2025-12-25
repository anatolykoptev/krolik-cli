# Unified SWC Analyzer - Quick Start

> 5x faster AST analysis with a single function call

## TL;DR

```typescript
import { analyzeFileUnified } from './analyzers/unified-swc';

// One function call, all detections
const { lintIssues, typeSafetyIssues, hardcodedValues } =
  analyzeFileUnified(content, filepath);

// 4.97x faster than:
// checkLintRulesSwc() + checkTypeSafetySwc() + detectHardcodedSwc()
```

## Why Use It?

**Before**: 3 separate analyzer calls
```typescript
const lint = checkLintRulesSwc(content, filepath);        // Parse #1
const types = checkTypeSafetySwc(content, filepath);      // Parse #2
const hardcoded = detectHardcodedSwc(content, filepath);  // Parse #3
```

**After**: 1 unified call
```typescript
const { lintIssues, typeSafetyIssues, hardcodedValues } =
  analyzeFileUnified(content, filepath);  // Single parse!
```

**Result**: 4.97x faster (79.9% time reduction)

## What It Detects

### Lint Issues
- `console.log`, `console.error`, etc.
- `debugger` statements
- `alert()`, `confirm()`, `prompt()`
- `eval()` calls

### Type-Safety Issues
- `any` type usage
- `as any` assertions
- Non-null assertions (`!`)
- `@ts-ignore`/`@ts-nocheck`

### Hardcoded Values
- Magic numbers (42, 3.14, etc.)
- Hardcoded URLs
- Hex colors (#RGB, #RRGGBB)

## Quick Examples

### Example 1: Basic Usage

```typescript
import { analyzeFileUnified } from './analyzers/unified-swc';

const code = `
  console.log("test");
  const x: any = 5;
  const magic = 42;
`;

const result = analyzeFileUnified(code, '/path/to/file.ts');

console.log(`Found ${result.lintIssues.length} lint issues`);
console.log(`Found ${result.typeSafetyIssues.length} type issues`);
console.log(`Found ${result.hardcodedValues.length} hardcoded values`);
```

### Example 2: Filtering Results

```typescript
const { lintIssues, typeSafetyIssues } = analyzeFileUnified(content, filepath);

// Get only errors
const errors = lintIssues.filter(i => i.severity === 'error');

// Get only 'any' usage
const anyUsage = typeSafetyIssues.filter(i => i.fixerId === 'no-any');
```

### Example 3: Batch Processing

```typescript
const files = ['a.ts', 'b.ts', 'c.ts'];
const results = files.map(filepath => {
  const content = fs.readFileSync(filepath, 'utf-8');
  return analyzeFileUnified(content, filepath);
});

const totalIssues = results.reduce((sum, r) =>
  sum + r.lintIssues.length + r.typeSafetyIssues.length, 0
);
```

## Backward Compatibility

No code changes needed! The unified analyzer exports wrapper functions:

```typescript
// These still work (and now use the unified analyzer internally)
import {
  checkLintRulesSwc,
  checkTypeSafetySwc,
  detectHardcodedSwc
} from './analyzers/unified-swc';

// Same API as before
const lintIssues = checkLintRulesSwc(content, filepath);
```

## Performance Comparison

**Test**: 1200-line file, 50 iterations

| Approach | Time | Speedup |
|----------|------|---------|
| Individual analyzers | 138.56ms | 1x (baseline) |
| Unified analyzer | 27.90ms | **4.97x faster** |

**Time saved**: 79.9% reduction

## When to Use

✅ **Use unified analyzer when**:
- Analyzing multiple files in batch
- Running in CI/CD pipelines
- Need all detection types
- Performance matters

⚠️ **Use individual analyzers when**:
- Only need one detection type
- Debugging specific issues
- Learning how detection works

## Common Patterns

### Pattern 1: Process All Issues

```typescript
const result = analyzeFileUnified(content, filepath);
const allIssues = [
  ...result.lintIssues,
  ...result.typeSafetyIssues
];

allIssues.forEach(issue => {
  console.log(`${issue.file}:${issue.line} - ${issue.message}`);
});
```

### Pattern 2: Group by Severity

```typescript
const { lintIssues, typeSafetyIssues } = analyzeFileUnified(content, filepath);
const allIssues = [...lintIssues, ...typeSafetyIssues];

const grouped = {
  errors: allIssues.filter(i => i.severity === 'error'),
  warnings: allIssues.filter(i => i.severity === 'warning'),
  info: allIssues.filter(i => i.severity === 'info')
};
```

### Pattern 3: Fix Auto-Fixable Issues

```typescript
const result = analyzeFileUnified(content, filepath);

const autoFixable = result.lintIssues.filter(i =>
  ['no-console', 'no-debugger', 'no-alert'].includes(i.fixerId ?? '')
);

console.log(`${autoFixable.length} issues can be auto-fixed`);
```

## Key Benefits

1. **Performance**: 4.97x faster than separate analyzers
2. **Simplicity**: One function call instead of three
3. **Consistency**: Same line offset calculation across all detections
4. **Reliability**: Single AST parse eliminates discrepancies
5. **Maintainability**: Centralized SWC configuration and bug workarounds

## FAQs

**Q: Will my existing code break?**
A: No! Wrapper functions maintain backward compatibility.

**Q: Can I use only one detection type?**
A: Yes, but you won't get performance benefits. Use individual wrappers.

**Q: What about files that should skip analysis?**
A: The unified analyzer respects all skip rules (CLI files, .d.ts, tests, etc.)

**Q: Is it production-ready?**
A: Yes! Comprehensive tests verify identical results to original analyzers.

**Q: How do I enable it?**
A: Set `USE_UNIFIED_ANALYZER = true` in `analyzers/index.ts` (already enabled!)

## Next Steps

1. Read full documentation: `UNIFIED-SWC.md`
2. Check implementation: `unified-swc.ts`
3. Run benchmark: `npx tsx benchmark-unified.ts`
4. View integration: `analyzers/index.ts`

## Support

- Issues: Check original analyzer files for detection logic
- Performance: Run `benchmark-unified.ts` to verify speedup
- Migration: See `UNIFIED-SWC.md` for detailed guide
