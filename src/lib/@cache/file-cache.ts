/**
 * @module lib/@cache/file-cache
 * @deprecated Use '@/lib/cache/file-cache' instead. This module will be removed in a future version.
 * @description Re-export from new location for backward compatibility
 */

export {
  FileCache,
  type FileCacheOptions,
  type FileCacheStats,
  fileCache,
  formatCacheStats,
} from '../cache/file-cache';
