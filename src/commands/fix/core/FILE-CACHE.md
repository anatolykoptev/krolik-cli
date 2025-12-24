# File Cache Implementation

## Overview

The file cache layer reduces I/O operations in the `krolik fix` command by caching file contents in memory during a single command execution session.

## Problem Statement

Before the cache implementation, the fix command read each file multiple times:
1. **analyze.ts**: Read file for analysis (2x - once for legacy analyzers, once for new fixers)
2. **recommendations**: Re-read file for recommendation checks
3. **applier.ts**: Read file to apply fixes
4. **applier.ts**: Read file again for backup

**Total: ~4 reads per file per fix operation**

## Solution

The `FileCache` class provides a session-scoped in-memory cache that:
- Stores file contents after first read
- Returns cached content on subsequent reads
- Updates cache when files are modified (during fix application)
- Clears automatically at end of command execution

## Performance Impact

### Cache Hit Rate
- **Without cache**: 100% disk I/O (4 reads per file)
- **With cache**: 75% cache hit rate (1 disk read + 3 cache hits)

### Example: 100 files
- **Before**: 400 disk reads
- **After**: 100 disk reads + 300 cache hits
- **I/O Reduction**: 75%

## API

### FileCache Class

```typescript
class FileCache {
  get(filepath: string): string
  set(filepath: string, content: string): void
  has(filepath: string): boolean
  invalidate(filepath: string): void
  clear(): void
  getStats(): FileCacheStats
  warmup(filepaths: string[]): void
}
```

### Singleton Instance

```typescript
import { fileCache } from './core/file-cache';

// Read file (cached)
const content = fileCache.get('/path/to/file.ts');

// Update cache after modification
fileCache.set('/path/to/file.ts', modifiedContent);

// Clear at end of session
fileCache.clear();
```

## Integration Points

### 1. analyze.ts
- Uses cache for initial file reads
- Stores content in fileContents map

```typescript
for (const file of files) {
  const content = fileCache.get(file); // Cache miss on first read
  // Analysis uses cached content
}
```

### 2. analyzers/index.ts
- Uses cache in analyzeFile function

```typescript
export function analyzeFile(filepath: string) {
  const content = fileCache.get(filepath); // Cache hit if already read
  // Analyze content
}
```

### 3. applier.ts
- Uses cache to read current content
- Updates cache after writing changes

```typescript
export function applyFix(operation: FixOperation) {
  const content = fileCache.get(file); // Cache hit
  // Apply fix
  fs.writeFileSync(file, newContent);
  fileCache.set(file, newContent); // Keep cache in sync
}
```

### 4. index.ts (main command)
- Clears cache at end of execution
- Logs cache statistics in debug mode

```typescript
export async function runFix(ctx: CommandContext) {
  try {
    // ... run fix operations
  } finally {
    const stats = fileCache.getStats();
    logger.debug(formatCacheStats(stats));
    fileCache.clear();
  }
}
```

## Cache Statistics

The cache tracks:
- **hits**: Number of successful cache reads
- **misses**: Number of disk reads (cache misses)
- **size**: Number of unique files cached
- **memoryBytes**: Approximate memory usage

### Example Output

```
Cache stats:
  Files cached: 50
  Cache hits: 150
  Cache misses: 50
  Hit rate: 75.0%
  Memory usage: 2.34 MB
```

## Memory Considerations

- **UTF-16 encoding**: ~2 bytes per character
- **Typical file**: 10 KB average
- **100 files**: ~2 MB memory usage
- **1000 files**: ~20 MB memory usage

The cache is session-scoped and cleared after each command run, so memory is automatically reclaimed.

## Testing

### Unit Tests
- `tests/commands/fix/core/file-cache.test.ts`
- Tests all cache operations and edge cases

### Integration Tests
- `tests/commands/fix/core/file-cache.integration.test.ts`
- Demonstrates real-world performance benefits

## Future Enhancements

Potential improvements:
1. **LRU eviction**: Limit cache size with LRU policy
2. **TTL expiration**: Invalidate old entries
3. **Persistent cache**: Cache across command runs
4. **Pre-warming**: Warm cache based on git diff

## See Also

- [Fix Command Documentation](../CLAUDE.md)
- [Core Infrastructure](./index.ts)
- [Performance Analysis](../../../docs/performance.md)
