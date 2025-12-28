/**
 * @module commands/fix/core/line-utils
 * @description Line manipulation utilities for fix strategies
 */

// ============================================================================
// TYPES
// ============================================================================

export interface LineContext {
  /** The full line content */
  line: string;
  /** Trimmed line content */
  trimmed: string;
  /** 0-based index in the lines array */
  index: number;
  /** 1-based line number */
  lineNumber: number;
}

export interface LineCacheStats {
  /** Number of cached entries */
  size: number;
  /** Number of cache hits */
  hits: number;
  /** Number of cache misses */
  misses: number;
}

// ============================================================================
// LINE CACHE
// ============================================================================

/** Maximum number of cached entries before eviction */
const MAX_CACHE_SIZE = 100;

/** Cache for split lines to avoid repeated string splitting */
const lineCache = new Map<string, string[]>();

/** Cache statistics for monitoring */
let cacheHits = 0;
let cacheMisses = 0;

/**
 * Generate a quick hash for content identification
 * Uses length + first/last chars for fast comparison
 */
function getContentHash(content: string): string {
  const len = content.length;
  // Use first and last 50 chars (or less if content is shorter)
  const prefix = content.slice(0, 50);
  const suffix = len > 50 ? content.slice(-50) : '';
  return `${len}:${prefix}:${suffix}`;
}

/**
 * Get cached lines or split and cache if not present
 */
export function getCachedLines(content: string): string[] {
  const hash = getContentHash(content);

  const cached = lineCache.get(hash);
  if (cached) {
    cacheHits++;
    return cached;
  }

  cacheMisses++;
  const lines = content.split('\n');

  // Evict oldest entry if cache is full
  if (lineCache.size >= MAX_CACHE_SIZE) {
    const firstKey = lineCache.keys().next().value;
    if (firstKey) {
      lineCache.delete(firstKey);
    }
  }

  lineCache.set(hash, lines);
  return lines;
}

/**
 * Clear the line cache
 * Call this when starting a new fix session or when memory pressure is high
 */
export function clearLineCache(): void {
  lineCache.clear();
  cacheHits = 0;
  cacheMisses = 0;
}

/**
 * Get cache statistics for monitoring
 */
export function getLineCacheStats(): LineCacheStats {
  return {
    size: lineCache.size,
    hits: cacheHits,
    misses: cacheMisses,
  };
}

// ============================================================================
// LINE EXTRACTION
// ============================================================================

/**
 * Split content into lines array
 * Uses internal cache to avoid repeated splitting of the same content
 */
export function splitLines(content: string): string[] {
  return getCachedLines(content);
}

/**
 * Get line context from content at a specific line number
 * Returns null if line doesn't exist
 */
export function getLineContext(content: string, lineNumber: number): LineContext | null {
  if (lineNumber < 1) return null;

  const lines = splitLines(content);
  const index = lineNumber - 1;
  const line = lines[index];

  if (line === undefined) return null;

  return {
    line,
    trimmed: line.trim(),
    index,
    lineNumber,
  };
}

/**
 * Get multiple lines from content
 * startLine and endLine are 1-based
 */
export function getLines(content: string, startLine: number, endLine: number): string[] {
  const lines = splitLines(content);
  return lines.slice(startLine - 1, endLine);
}

/**
 * Join lines back into content
 */
export function joinLines(lines: string[]): string {
  return lines.join('\n');
}

/**
 * Count total lines in content
 */
export function countLines(content: string): number {
  return splitLines(content).length;
}

// ============================================================================
// LINE CHECKS
// ============================================================================

/**
 * Check if line starts with any of the prefixes (trimmed)
 */
export function lineStartsWith(line: string, prefixes: string[]): boolean {
  const trimmed = line.trim();
  return prefixes.some((prefix) => trimmed.startsWith(prefix));
}

/**
 * Check if line ends with any of the suffixes (trimmed)
 */
export function lineEndsWith(line: string, suffixes: string[]): boolean {
  const trimmed = line.trim();
  return suffixes.some((suffix) => trimmed.endsWith(suffix));
}

/**
 * Check if line contains any of the patterns
 */
export function lineContains(line: string, patterns: string[]): boolean {
  return patterns.some((pattern) => line.includes(pattern));
}

/**
 * Check if line is a comment
 */
export function isComment(line: string): boolean {
  const trimmed = line.trim();
  return trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*');
}

/**
 * Check if line is empty or whitespace only
 */
export function isEmptyLine(line: string): boolean {
  return line.trim() === '';
}
