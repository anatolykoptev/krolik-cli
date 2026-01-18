/**
 * LRU Cache - Least Recently Used cache for LLM instances
 *
 * Manages cached LLM instances with:
 * - Size-based eviction (LRU)
 * - Time-based expiry (TTL)
 * - Auto-cleanup on access
 *
 * @module @ralph/models/lru-cache
 */

// ============================================================================
// TYPES
// ============================================================================

export interface LruCacheOptions {
  /** Maximum number of entries (default: 50) */
  maxSize?: number;
  /** Time-to-live in milliseconds (default: 30 minutes) */
  ttlMs?: number;
}

interface CacheEntry<T> {
  /** Cached value */
  value: T;
  /** Last access timestamp */
  lastAccess: number;
  /** Expiry timestamp */
  expiresAt: number;
}

// ============================================================================
// LRU CACHE
// ============================================================================

/**
 * Simple LRU cache with TTL support
 *
 * Features:
 * - Evicts least recently used entries when max size reached
 * - Auto-removes expired entries on access
 * - Thread-safe for single-threaded Node.js environment
 *
 * @example
 * ```typescript
 * const cache = new LruCache<BaseLlm>({ maxSize: 50, ttlMs: 30 * 60 * 1000 });
 *
 * // Store LLM instance
 * cache.set('sonnet:cli', llmInstance);
 *
 * // Retrieve (updates last access)
 * const llm = cache.get('sonnet:cli');
 *
 * // Clean up
 * cache.clear();
 * ```
 */
export class LruCache<T> {
  private cache: Map<string, CacheEntry<T>> = new Map();
  private readonly maxSize: number;
  private readonly ttlMs: number;

  constructor(options: LruCacheOptions = {}) {
    this.maxSize = options.maxSize ?? 50;
    this.ttlMs = options.ttlMs ?? 30 * 60 * 1000; // 30 minutes default
  }

  /**
   * Get value from cache
   * Returns undefined if not found or expired
   * Updates last access time on hit
   */
  get(key: string): T | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;

    const now = Date.now();

    // Check if expired
    if (now > entry.expiresAt) {
      this.cache.delete(key);
      return undefined;
    }

    // Update last access
    entry.lastAccess = now;

    // Move to end (most recently used)
    this.cache.delete(key);
    this.cache.set(key, entry);

    return entry.value;
  }

  /**
   * Set value in cache
   * Evicts least recently used entry if max size exceeded
   */
  set(key: string, value: T): void {
    const now = Date.now();

    // Remove existing entry if present
    this.cache.delete(key);

    // Evict LRU if at capacity
    if (this.cache.size >= this.maxSize) {
      this.evictLru();
    }

    // Add new entry (at end = most recently used)
    this.cache.set(key, {
      value,
      lastAccess: now,
      expiresAt: now + this.ttlMs,
    });
  }

  /**
   * Delete a specific entry
   * Returns true if entry existed and was deleted
   */
  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * Clear all entries
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get current cache size
   */
  size(): number {
    return this.cache.size;
  }

  /**
   * Remove expired entries
   * Returns number of entries removed
   */
  cleanup(): number {
    const now = Date.now();
    let removed = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
        removed++;
      }
    }

    return removed;
  }

  /**
   * Get cache statistics
   */
  stats(): {
    size: number;
    maxSize: number;
    ttlMs: number;
    oldestAccess: number | null;
    newestAccess: number | null;
  } {
    const accesses: number[] = [];
    for (const entry of this.cache.values()) {
      accesses.push(entry.lastAccess);
    }

    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      ttlMs: this.ttlMs,
      oldestAccess: accesses.length > 0 ? Math.min(...accesses) : null,
      newestAccess: accesses.length > 0 ? Math.max(...accesses) : null,
    };
  }

  /**
   * Evict least recently used entry
   * Map iteration order is insertion order, so first entry is LRU
   */
  private evictLru(): void {
    const firstKey = this.cache.keys().next().value;
    if (firstKey !== undefined) {
      this.cache.delete(firstKey);
    }
  }
}
