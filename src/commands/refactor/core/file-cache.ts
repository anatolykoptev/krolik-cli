/**
 * @module commands/refactor/core/file-cache
 * @description File discovery caching for performance optimization
 *
 * Caches directory scans to avoid repeated file discovery during refactor analysis.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

export interface FindFilesOptions {
  extensions?: string[];
  exclude?: string[];
  maxDepth?: number;
}

const DEFAULT_EXTENSIONS = ['.ts', '.tsx'];
const DEFAULT_EXCLUDE = ['node_modules', '.git', 'dist', 'build', '.next', 'coverage'];

// File cache to avoid repeated directory scans
const fileCache = new Map<string, string[]>();

// Content cache with mtime-based invalidation
interface CachedContent {
  content: string;
  mtime: number;
}

const contentCache = new Map<string, CachedContent>();

/**
 * Find files in directory with caching
 */
export function getCachedFiles(dirPath: string, options: FindFilesOptions = {}): string[] {
  const key = `${dirPath}:${JSON.stringify(options)}`;

  const cached = fileCache.get(key);
  if (cached) {
    return cached;
  }

  const files = findFilesInternal(dirPath, options);
  fileCache.set(key, files);
  return files;
}

/**
 * Clear the file cache (call at start of new refactor run)
 */
export function clearFileCache(): void {
  fileCache.clear();
  contentCache.clear();
}

/**
 * Get cached file content with mtime-based invalidation
 */
export function getCachedContent(filePath: string): string | null {
  const cached = contentCache.get(filePath);
  if (!cached) return null;

  try {
    const stat = fs.statSync(filePath);
    if (stat.mtime.getTime() !== cached.mtime) {
      contentCache.delete(filePath);
      return null;
    }
    return cached.content;
  } catch {
    contentCache.delete(filePath);
    return null;
  }
}

/**
 * Cache file content with mtime tracking
 */
export function setCachedContent(filePath: string, content: string): void {
  try {
    const stat = fs.statSync(filePath);
    contentCache.set(filePath, {
      content,
      mtime: stat.mtime.getTime(),
    });
  } catch {
    // Ignore cache failures
  }
}

/**
 * Clear content cache only
 */
export function clearContentCache(): void {
  contentCache.clear();
}

/**
 * Internal file finding implementation
 */
function findFilesInternal(dirPath: string, options: FindFilesOptions = {}, depth = 0): string[] {
  const { extensions = DEFAULT_EXTENSIONS, exclude = DEFAULT_EXCLUDE, maxDepth = 10 } = options;

  if (depth > maxDepth) {
    return [];
  }

  const results: string[] = [];

  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);

      // Skip excluded directories
      if (exclude.includes(entry.name)) {
        continue;
      }

      if (entry.isDirectory()) {
        // Recurse into subdirectories
        results.push(...findFilesInternal(fullPath, options, depth + 1));
      } else if (entry.isFile()) {
        // Check extension
        const ext = path.extname(entry.name);
        if (extensions.includes(ext)) {
          results.push(fullPath);
        }
      }
    }
  } catch {
    // Directory not accessible
  }

  return results;
}
