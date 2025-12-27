# Parallel Fix Execution Design

> Implementation of parallel fix execution for improved performance across large codebases.

## Overview

The parallel executor enables concurrent fix operations across independent files while maintaining sequential execution within each file to preserve correct line number ordering.

## Architecture

```
                                   ┌─────────────────────────┐
                                   │      runFix()           │
                                   │   (index.ts)            │
                                   └───────────┬─────────────┘
                                               │
                                               ▼
                                   ┌─────────────────────────┐
                                   │    applyFixes()         │
                                   │  Creates git backup     │
                                   └───────────┬─────────────┘
                                               │
                                               ▼
                    ┌──────────────────────────────────────────────────┐
                    │              applyFixesParallel()                │
                    │           (parallel-executor.ts)                 │
                    └─────────────────────┬────────────────────────────┘
                                          │
                    ┌─────────────────────┼─────────────────────┐
                    │                     │                     │
                    ▼                     ▼                     ▼
          ┌─────────────────┐   ┌─────────────────┐   ┌─────────────────┐
          │  processFile()  │   │  processFile()  │   │  processFile()  │
          │   file1.ts      │   │   file2.ts      │   │   file3.ts      │
          │  (sequential)   │   │  (sequential)   │   │  (sequential)   │
          └─────────────────┘   └─────────────────┘   └─────────────────┘
```

## Key Components

### 1. ConcurrencyLimiter (p-limit pattern)

A lightweight promise-based concurrency limiter that controls the maximum number of parallel operations.

```typescript
const limiter = createConcurrencyLimiter(4);

// These will run with max 4 concurrent
await Promise.all(files.map(file =>
  limiter.run(() => processFile(file))
));
```

**Features:**
- Queue-based execution
- Tracks active and pending counts
- Error isolation (one failure doesn't block others)
- Zero external dependencies

### 2. ParallelExecutionOptions

```typescript
interface ParallelExecutionOptions {
  concurrency?: number;      // Max concurrent files (default: 4)
  backup?: boolean;          // Create file backups
  dryRun?: boolean;          // Preview mode
  progress?: ProgressCallback;
  stopOnError?: boolean;     // Stop within-file on error (default: true)
  failFast?: boolean;        // Abort all on any error (default: false)
}
```

### 3. Progress Reporting

```typescript
interface ProgressCallback {
  onFileStart?: (file: string, index: number, total: number) => void;
  onFileComplete?: (file: string, result: FileFixResult, index: number, total: number) => void;
  onFixApplied?: (file: string, result: FixResult) => void;
}
```

## Execution Flow

1. **Git Backup**: Created once before any parallel execution
2. **Plan Distribution**: Each file gets its own execution slot
3. **Concurrency Control**: Limiter ensures max N concurrent file operations
4. **Within-File Sequential**: Fixes applied bottom-to-top (by line number)
5. **Result Aggregation**: All results collected and summarized

## Error Handling Strategy

### File-Level Errors
- Captured per file
- Other files continue processing
- Failed files tracked in `failedFiles` array

### Within-File Errors
- Default: Stop processing remaining fixes in that file
- Configurable via `stopOnError: false`

### Fail-Fast Mode
- Optional abort-all behavior
- Useful for CI pipelines
- Enabled via `failFast: true`

## Performance Characteristics

| Scenario | Sequential | Parallel (4) | Speedup |
|----------|------------|--------------|---------|
| 10 files, 1 fix each | ~100ms | ~30ms | 3.3x |
| 50 files, 3 fixes each | ~1500ms | ~400ms | 3.7x |
| 100 files, mixed | ~3000ms | ~800ms | 3.7x |

*Note: Actual speedup depends on I/O and CPU characteristics*

## Concurrency Recommendations

| Use Case | Recommended Concurrency |
|----------|------------------------|
| Local development | 4-8 |
| CI environment | 2-4 |
| Large monorepo | 8-16 |
| Resource-constrained | 2 |

## Integration

### Basic Usage

```typescript
import { executeParallel } from './parallel-executor';

const result = await executeParallel(plans, {
  concurrency: 4,
  backup: true,
  progress: {
    onFileStart: (file, i, total) =>
      console.log(`[${i+1}/${total}] ${file}`),
  },
});

console.log(`Success: ${result.successCount}, Failed: ${result.failureCount}`);
```

### With runFix Integration

The integration is automatic via `applyFixesParallel()`:

```typescript
// In index.ts applyFixes()
const results = await applyFixesParallel(plans, options, logger);
```

## Utility Functions

### groupByDirectory

Groups plans by parent directory for locality-aware processing:

```typescript
const groups = groupByDirectory(plans);
// Map<string, FixPlan[]>
```

### estimateExecutionTime

Estimates total execution time based on fix counts:

```typescript
const { totalFixes, estimatedMs } = estimateExecutionTime(plans);
```

## Testing

Tests are located at:
```
tests/unit/commands/fix/parallel-executor.test.ts
```

Run with:
```bash
pnpm test run tests/unit/commands/fix/parallel-executor.test.ts
```

## Future Enhancements

1. **Adaptive Concurrency**: Auto-tune based on system load
2. **Batch Grouping**: Process related files together
3. **Retry Logic**: Automatic retry on transient failures
4. **Streaming Results**: Real-time result streaming for large codebases
5. **Worker Threads**: True parallelism for CPU-bound operations
