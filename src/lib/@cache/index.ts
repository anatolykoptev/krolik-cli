/**
 * @module lib/@cache
 * @deprecated Use '@/lib/cache' instead. This module will be removed in a future version.
 * @description Caching utilities for performance optimization
 *
 * Migration:
 * ```typescript
 * // Old (deprecated)
 * import { fileCache } from '@/lib/@cache';
 *
 * // New
 * import { fileCache } from '@/lib/cache';
 * // or
 * import { fileCache } from '@/lib';
 * ```
 */

export {
  FileCache,
  type FileCacheOptions,
  type FileCacheStats,
  fileCache,
  formatCacheStats,
} from '../cache';
