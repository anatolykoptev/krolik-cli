/**
 * @module lib/@cache/file-cache
 * @description Unified file content cache with mtime tracking and statistics
 *
 * Combines features from:
 * - refactor/core/file-cache.ts: mtime-based invalidation
 * - fix/core/file-cache.ts: statistics tracking, warmup, singleton pattern
 *
 * Performance benefits:
 * - Eliminates repeated file reads (4x+ reduction per file)
 * - Automatic mtime-based invalidation for file changes
 * - Statistics for cache hit rate analysis
 * - Memory usage tracking
 * - Session-scoped (cleared between command runs)
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * Cached file content with modification time
 */
interface CachedContent {
  content: string;
  mtime: number;
}

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
 * File cache configuration options
 */
export interface FileCacheOptions {
  /**
   * Track file modification times for automatic invalidation
   * @default true
   */
  trackMtime?: boolean;

  /**
   * Collect hit/miss statistics
   * @default true
   */
  collectStats?: boolean;
}

/**
 * Unified file content cache
 *
 * Features:
 * - Automatic mtime-based invalidation
 * - Hit/miss statistics tracking
 * - Memory usage estimation
 * - Warmup for batch pre-loading
 * - Thread-safe within Node.js single-threaded context
 */
export class FileCache {
  private cache = new Map<string, CachedContent>();
  private stats = { hits: 0, misses: 0 };
  private options: Required<FileCacheOptions>;

  constructor(options: FileCacheOptions = {}) {
    this.options = {
      trackMtime: options.trackMtime ?? true,
      collectStats: options.collectStats ?? true,
    };
  }

  /**
   * Get file content, reading from disk if not cached
   *
   * Automatically invalidates cache if file modification time changed.
   *
   * @param filepath - Absolute or relative file path
   * @returns File content
   * @throws Error if file cannot be read
   */
  get(filepath: string): string {
    const absolute = path.resolve(filepath);

    // Check cache and validate mtime if tracking enabled
    const cached = this.cache.get(absolute);
    if (cached) {
      if (this.options.trackMtime) {
        try {
          const stat = fs.statSync(absolute);
          const currentMtime = stat.mtime.getTime();

          if (currentMtime === cached.mtime) {
            if (this.options.collectStats) {
              this.stats.hits++;
            }
            return cached.content;
          }

          // File modified, invalidate cache entry
          this.cache.delete(absolute);
        } catch {
          // File no longer exists, remove from cache
          this.cache.delete(absolute);
        }
      } else {
        // No mtime tracking, trust cache
        if (this.options.collectStats) {
          this.stats.hits++;
        }
        return cached.content;
      }
    }

    // Cache miss or invalidated - read from disk
    if (this.options.collectStats) {
      this.stats.misses++;
    }

    const content = fs.readFileSync(absolute, 'utf-8');

    // Store in cache with mtime if tracking enabled
    if (this.options.trackMtime) {
      try {
        const stat = fs.statSync(absolute);
        this.cache.set(absolute, {
          content,
          mtime: stat.mtime.getTime(),
        });
      } catch {
        // Failed to stat, cache without mtime (mtime: 0)
        this.cache.set(absolute, {
          content,
          mtime: 0,
        });
      }
    } else {
      this.cache.set(absolute, {
        content,
        mtime: 0,
      });
    }

    return content;
  }

  /**
   * Update cached content (e.g., after fix applied)
   *
   * This keeps the cache consistent with disk state when you
   * write to a file and want to avoid re-reading it.
   *
   * @param filepath - Absolute or relative file path
   * @param content - New file content
   */
  set(filepath: string, content: string): void {
    const absolute = path.resolve(filepath);

    if (this.options.trackMtime) {
      try {
        const stat = fs.statSync(absolute);
        this.cache.set(absolute, {
          content,
          mtime: stat.mtime.getTime(),
        });
      } catch {
        // File doesn't exist yet or can't be stat'd
        this.cache.set(absolute, {
          content,
          mtime: 0,
        });
      }
    } else {
      this.cache.set(absolute, {
        content,
        mtime: 0,
      });
    }
  }

  /**
   * Check if file is cached (and valid if mtime tracking enabled)
   *
   * @param filepath - Absolute or relative file path
   * @returns true if file is cached and valid
   */
  has(filepath: string): boolean {
    const absolute = path.resolve(filepath);
    const cached = this.cache.has(absolute);

    if (!cached || !this.options.trackMtime) {
      return cached;
    }

    // Validate mtime if tracking enabled
    const entry = this.cache.get(absolute);
    if (!entry) return false;

    try {
      const stat = fs.statSync(absolute);
      if (stat.mtime.getTime() !== entry.mtime) {
        this.cache.delete(absolute);
        return false;
      }
      return true;
    } catch {
      this.cache.delete(absolute);
      return false;
    }
  }

  /**
   * Invalidate cache for a specific file
   *
   * Use when file is modified externally and you want to force
   * a fresh read on next get().
   *
   * @param filepath - Absolute or relative file path
   */
  invalidate(filepath: string): void {
    const absolute = path.resolve(filepath);
    this.cache.delete(absolute);
  }

  /**
   * Clear entire cache and reset statistics
   *
   * Call at end of command execution to free memory.
   */
  clear(): void {
    this.cache.clear();
    this.stats = { hits: 0, misses: 0 };
  }

  /**
   * Get cache statistics
   *
   * @returns Statistics object with hits, misses, size, and memory usage
   */
  getStats(): FileCacheStats {
    // Estimate memory usage (rough approximation)
    let memoryBytes = 0;
    for (const entry of this.cache.values()) {
      // UTF-16 string encoding (2 bytes per character in JavaScript)
      memoryBytes += entry.content.length * 2;
      // Add overhead for mtime number (8 bytes)
      memoryBytes += 8;
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
   *
   * Useful when you know which files will be accessed and want to
   * batch-load them for better performance.
   *
   * @param filepaths - Array of file paths to pre-load
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
 *
 * Shared across all operations in a single command run.
 * This is the recommended way to use FileCache for most commands.
 */
export const fileCache = new FileCache();

/**
 * Helper function to format cache stats for display
 *
 * @param stats - Cache statistics from getStats()
 * @returns Formatted multi-line string
 */
export function formatCacheStats(stats: FileCacheStats): string {
  const hitRate =
    stats.hits + stats.misses > 0
      ? ((stats.hits / (stats.hits + stats.misses)) * 100).toFixed(1)
      : '0.0';

  const memoryMB = (stats.memoryBytes / (1024 * 1024)).toFixed(2);

  return [
    'Cache stats:',
    `  Files cached: ${stats.size}`,
    `  Cache hits: ${stats.hits}`,
    `  Cache misses: ${stats.misses}`,
    `  Hit rate: ${hitRate}%`,
    `  Memory usage: ${memoryMB} MB`,
  ].join('\n');
}
