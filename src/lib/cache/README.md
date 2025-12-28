# cache - File Caching Utilities

Unified file content caching with mtime-based invalidation and statistics tracking.

## Overview

The `cache` module provides a centralized file caching solution that combines features from both the `fix` and `refactor` commands:

- **Automatic mtime-based invalidation**: Cache entries are automatically invalidated when files change
- **Statistics tracking**: Hit/miss ratios and memory usage monitoring
- **Session-scoped**: Caches are cleared between command runs
- **Memory-efficient**: Tracks memory usage and provides warmup for batch operations

## Usage

### Basic Usage

```typescript
import { fileCache } from '@/lib';

// Read file (cached)
const content = fileCache.get('/path/to/file.ts');

// Update cache after modification
fileCache.set('/path/to/file.ts', newContent);

// Check if file is cached
if (fileCache.has('/path/to/file.ts')) {
  // File is in cache and valid
}

// Invalidate specific file
fileCache.invalidate('/path/to/file.ts');

// Clear all cache
fileCache.clear();
```

### Statistics

```typescript
import { fileCache, formatCacheStats } from '@/lib';

// Get statistics
const stats = fileCache.getStats();
console.log(`Hit rate: ${(stats.hits / (stats.hits + stats.misses) * 100).toFixed(1)}%`);

// Formatted output
console.log(formatCacheStats(stats));
// Output:
// Cache stats:
//   Files cached: 42
//   Cache hits: 156
//   Cache misses: 12
//   Hit rate: 92.9%
//   Memory usage: 2.34 MB
```

### Custom Cache Instance

```typescript
import { FileCache } from '@/lib';

// Create instance with custom options
const cache = new FileCache({
  trackMtime: true,      // Enable mtime-based invalidation (default: true)
  collectStats: true,    // Collect hit/miss statistics (default: true)
});

// Use the instance
const content = cache.get('/path/to/file.ts');
```

### Warmup for Batch Operations

```typescript
import { fileCache } from '@/lib';

// Pre-load files for better performance
const filesToAnalyze = glob('**/*.ts');
fileCache.warmup(filesToAnalyze);

// Now all files are cached
for (const file of filesToAnalyze) {
  const content = fileCache.get(file); // Hit from cache
}
```

## API

### FileCache

```typescript
class FileCache {
  constructor(options?: FileCacheOptions);

  // Core operations
  get(filepath: string): string;
  set(filepath: string, content: string): void;
  has(filepath: string): boolean;
  invalidate(filepath: string): void;
  clear(): void;

  // Performance
  getStats(): FileCacheStats;
  warmup(filepaths: string[]): void;
}
```

### Options

```typescript
interface FileCacheOptions {
  trackMtime?: boolean;    // Automatic invalidation on file change (default: true)
  collectStats?: boolean;  // Track hit/miss statistics (default: true)
}
```

### Statistics

```typescript
interface FileCacheStats {
  hits: number;         // Number of cache hits
  misses: number;       // Number of cache misses
  size: number;         // Number of files in cache
  memoryBytes: number;  // Estimated memory usage in bytes
}
```

## Singleton Instance

The recommended way to use the cache is through the singleton `fileCache` instance:

```typescript
import { fileCache } from '@/lib';
```

This instance is shared across all operations in a single command run, ensuring consistent caching behavior.

## Migration Notes

### From `@cache` (deprecated)

The `@cache` module has been renamed to `cache` (without @ prefix):

```typescript
// Old (deprecated, still works)
import { fileCache } from '@/lib/@cache';

// New (recommended)
import { fileCache } from '@/lib/cache';
// or via main barrel
import { fileCache } from '@/lib';
```

### From `fix/core/file-cache`

The fix command's file-cache has been **fully replaced** with the unified cache:

```typescript
// Old (removed)
import { fileCache } from './core/file-cache';

// New
import { fileCache } from '@/lib';
```

All functionality is identical. Tests have been updated to use the new location.

### From `refactor/core/file-cache`

The refactor command's file-cache now **uses the unified cache internally** for content caching:

- File list caching (`getCachedFiles`) remains in refactor-specific code
- Content caching functions (`getCachedContent`, `setCachedContent`) are deprecated wrappers
- Direct usage of unified cache is recommended for new code

```typescript
// Still works (deprecated)
import { getCachedContent } from './core/file-cache';
const content = getCachedContent('/path/to/file.ts');

// Preferred
import { fileCache } from '@/lib';
const content = fileCache.get('/path/to/file.ts');
```

## Performance Impact

The unified cache eliminates repeated file reads:

- **Fix command**: Reduces I/O by ~4x (analyze + apply both read files)
- **Refactor command**: Avoids re-reading files during AST analysis
- **Typical hit rate**: 85-95% for most operations

Memory usage is tracked automatically and typically ranges from 1-10 MB depending on project size.

## Related

- **Fix command**: Uses cache for all file operations
- **Refactor command**: Uses cache for content, maintains separate file list cache
- **AST pool**: Works alongside cache to reduce memory overhead from ts-morph
