/**
 * @module lib/@swc/parser
 * @description SWC parser with caching for performance
 *
 * Provides high-performance TypeScript/JavaScript parsing using SWC.
 * Includes LRU cache to avoid re-parsing the same files.
 */

import * as crypto from 'node:crypto';
import type { Module, Node } from '@swc/core';
import { parseSync } from '@swc/core';
import type { CacheEntry, ParseOptions } from './types';
import { calculateLineOffsets } from './visitor';

/**
 * Simple LRU cache for parsed ASTs
 */
class AstCache {
  private cache = new Map<string, CacheEntry>();
  private maxSize: number;

  constructor(maxSize = 100) {
    this.maxSize = maxSize;
  }

  get(key: string): CacheEntry | undefined {
    const entry = this.cache.get(key);
    if (entry) {
      // Update access time for LRU
      entry.lastAccess = Date.now();
      return entry;
    }
    return undefined;
  }

  set(key: string, entry: CacheEntry): void {
    // If cache is full, remove oldest entry
    if (this.cache.size >= this.maxSize) {
      let oldestKey: string | undefined;
      let oldestTime = Infinity;

      this.cache.forEach((v, k) => {
        if (v.lastAccess < oldestTime) {
          oldestTime = v.lastAccess;
          oldestKey = k;
        }
      });

      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }

    this.cache.set(key, entry);
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }
}

// Global cache instance
const astCache = new AstCache(100);

/**
 * Calculate content hash for cache invalidation
 */
function hashContent(content: string): string {
  return crypto.createHash('md5').update(content).digest('hex');
}

/**
 * Create cache key from file path and content hash
 */
function createCacheKey(filePath: string, contentHash: string): string {
  return `${filePath}:${contentHash}`;
}

/**
 * Parse TypeScript/JavaScript file with caching
 *
 * Parses source code using SWC and caches the result for performance.
 * Cache is invalidated when content changes.
 *
 * IMPORTANT: SWC accumulates span offsets globally across parseSync calls.
 * The returned `baseOffset` must be subtracted from all span.start/end values
 * to get correct 1-based byte offsets relative to the parsed content.
 *
 * @param filePath - Path to file (used for cache key and file extension detection)
 * @param content - Source code content
 * @param options - Parse options
 * @returns Parsed module, line offsets, and baseOffset for span normalization
 *
 * @example
 * const { ast, lineOffsets, baseOffset } = parseFile('src/example.ts', sourceCode);
 * // Normalize spans: realOffset = span.start - baseOffset
 */
export function parseFile(
  filePath: string,
  content: string,
  options: ParseOptions = {},
): { ast: Module; lineOffsets: number[]; baseOffset: number } {
  const contentHash = hashContent(content);
  const cacheKey = createCacheKey(filePath, contentHash);

  // Check cache
  const cached = astCache.get(cacheKey);
  if (cached) {
    return {
      ast: cached.ast as Module,
      lineOffsets: cached.lineOffsets,
      baseOffset: cached.baseOffset,
    };
  }

  // Parse with SWC
  const ast = parseSyncWithOptions(filePath, content, options);
  const lineOffsets = calculateLineOffsets(content);

  // Calculate base offset for span normalization
  // SWC accumulates span offsets globally across parseSync calls.
  // Formula: shift = ast.span.end - content.length
  // This gives us how much spans are offset from actual content positions.
  const baseOffset = ast.span.end - content.length;

  // Cache the result
  astCache.set(cacheKey, {
    ast,
    lineOffsets,
    contentHash,
    lastAccess: Date.now(),
    baseOffset,
  });

  return { ast, lineOffsets, baseOffset };
}

/**
 * Parse source code without caching
 *
 * Use this for one-off parsing where caching isn't beneficial.
 *
 * @param filePath - File path for extension detection
 * @param content - Source code
 * @param options - Parse options
 * @returns Parsed module
 */
export function parseFileUncached(
  filePath: string,
  content: string,
  options: ParseOptions = {},
): Module {
  return parseSyncWithOptions(filePath, content, options);
}

/**
 * Internal: Parse with SWC with proper options
 */
function parseSyncWithOptions(filePath: string, content: string, options: ParseOptions): Module {
  const syntax = options.syntax ?? 'typescript';

  // Auto-detect TSX/JSX from file extension if not specified
  const tsx = options.tsx ?? filePath.endsWith('.tsx');
  const jsx = options.jsx ?? filePath.endsWith('.jsx');
  const target = options.target ?? 'es2022';

  if (syntax === 'ecmascript') {
    return parseSync(content, {
      syntax: 'ecmascript',
      jsx,
      target,
    });
  }

  return parseSync(content, {
    syntax: 'typescript',
    tsx,
    target,
  });
}

/**
 * Clear the AST cache
 *
 * Useful for testing or when memory is constrained.
 */
export function clearCache(): void {
  astCache.clear();
}

/**
 * Get cache statistics
 *
 * @returns Object with cache size information
 */
export function getCacheStats(): { size: number; maxSize: number } {
  return {
    size: astCache.size(),
    maxSize: 100,
  };
}

/**
 * Parse and validate TypeScript/JavaScript code
 *
 * Attempts to parse code and returns success/failure result.
 * Useful for checking if code is syntactically valid.
 *
 * @param filePath - File path
 * @param content - Source code
 * @param options - Parse options
 * @returns Result with AST on success or error on failure
 *
 * @example
 * const result = validateSyntax('test.ts', 'const x = ;');
 * if (!result.success) {
 *   console.error('Parse error:', result.error);
 * }
 */
export function validateSyntax(
  filePath: string,
  content: string,
  options: ParseOptions = {},
): { success: true; ast: Module; lineOffsets: number[] } | { success: false; error: Error } {
  try {
    const { ast, lineOffsets } = parseFile(filePath, content, options);
    return { success: true, ast, lineOffsets };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error : new Error(String(error)),
    };
  }
}

/**
 * Extract node span information
 *
 * @param node - AST node
 * @returns Span with start/end byte offsets, or null if not available
 */
export function getNodeSpan(node: Node): { start: number; end: number } | null {
  const span = (node as { span?: { start: number; end: number } }).span;
  return span ?? null;
}

/**
 * Extract text content of a node from source
 *
 * @param node - AST node
 * @param content - Original source code
 * @returns Text content of node, or null if span not available
 */
export function getNodeText(node: Node, content: string): string | null {
  const span = getNodeSpan(node);
  if (!span) {
    return null;
  }
  // SWC uses 1-based byte offsets, convert to 0-based for string slicing
  return content.slice(span.start - 1, span.end - 1);
}
