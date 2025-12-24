/**
 * @module commands/fix/core/file-cache
 * @description File content cache to reduce I/O operations
 *
 * Session-scoped cache that stores file contents in memory to avoid
 * repeated reads during analysis and fix application.
 *
 * Performance impact:
 * - Eliminates 4x file reads per file (analyze.ts reads twice, applier.ts reads twice)
 * - Keeps cache up-to-date after write operations
 * - Session-scoped (cleared between command runs)
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * Cache statistics
 */
export interface FileCacheStats {
  hits: number;
  misses: number;
  size: number;
  memoryBytes: number;
}

/**
 * File content cache
 * Thread-safe within single-threaded Node.js context
 */
export class FileCache {
  private cache = new Map<string, string>();
  private stats = { hits: 0, misses: 0 };

  /**
   * Get file content, reading from disk if not cached
   */
  get(filepath: string): string {
    const absolute = path.resolve(filepath);

    if (this.cache.has(absolute)) {
      this.stats.hits++;
      return this.cache.get(absolute)!;
    }

    this.stats.misses++;
    const content = fs.readFileSync(absolute, 'utf-8');
    this.cache.set(absolute, content);
    return content;
  }

  /**
   * Update cached content (after fix applied)
   * This keeps the cache consistent with disk state
   */
  set(filepath: string, content: string): void {
    this.cache.set(path.resolve(filepath), content);
  }

  /**
   * Check if file is cached
   */
  has(filepath: string): boolean {
    return this.cache.has(path.resolve(filepath));
  }

  /**
   * Invalidate cache for a specific file
   * Use when file is modified externally
   */
  invalidate(filepath: string): void {
    this.cache.delete(path.resolve(filepath));
  }

  /**
   * Clear entire cache
   * Call at end of command execution
   */
  clear(): void {
    this.cache.clear();
    this.stats = { hits: 0, misses: 0 };
  }

  /**
   * Get cache statistics
   */
  getStats(): FileCacheStats {
    // Estimate memory usage (rough approximation)
    let memoryBytes = 0;
    for (const content of this.cache.values()) {
      memoryBytes += content.length * 2; // UTF-16 string encoding
    }

    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      size: this.cache.size,
      memoryBytes,
    };
  }

  /**
   * Pre-warm cache with multiple files
   * Useful when you know which files will be accessed
   */
  warmup(filepaths: string[]): void {
    for (const filepath of filepaths) {
      try {
        this.get(filepath); // Triggers cache population
      } catch {
        // Skip files that can't be read
      }
    }
  }
}

/**
 * Singleton cache instance for session
 * Shared across all fixer operations in a single command run
 */
export const fileCache = new FileCache();

/**
 * Helper function to format cache stats for display
 */
export function formatCacheStats(stats: FileCacheStats): string {
  const hitRate = stats.hits + stats.misses > 0
    ? ((stats.hits / (stats.hits + stats.misses)) * 100).toFixed(1)
    : '0.0';

  const memoryMB = (stats.memoryBytes / (1024 * 1024)).toFixed(2);

  return [
    `Cache stats:`,
    `  Files cached: ${stats.size}`,
    `  Cache hits: ${stats.hits}`,
    `  Cache misses: ${stats.misses}`,
    `  Hit rate: ${hitRate}%`,
    `  Memory usage: ${memoryMB} MB`,
  ].join('\n');
}
