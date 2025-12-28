/**
 * @module lib/modules/signals/directory
 * @description Directory pattern matching for reusable code detection
 *
 * Analyzes file paths to determine if they're in directories
 * commonly used for reusable code.
 */

import * as path from 'node:path';
import type { DirectorySignals } from '../types';
import { REUSABLE_DIRECTORY_PATTERNS } from '../types';

// ============================================================================
// PATTERN MATCHING
// ============================================================================

/**
 * Check if a path matches a glob-like pattern
 *
 * Supports:
 * - ** for any directory depth
 * - * for single directory/file
 */
function matchesPattern(relativePath: string, pattern: string): boolean {
  // Normalize paths
  const normalizedPath = relativePath.replace(/\\/g, '/');
  const normalizedPattern = pattern.replace(/\\/g, '/');

  // Convert glob to regex
  const regexPattern = normalizedPattern
    .replace(/\*\*/g, '<<<DOUBLE_STAR>>>') // Protect **
    .replace(/\*/g, '[^/]+') // * matches single segment
    .replace(/<<<DOUBLE_STAR>>>/g, '.*') // ** matches any depth
    .replace(/\//g, '\\/'); // Escape slashes

  const regex = new RegExp(`(^|/)${regexPattern}`, 'i');
  return regex.test(normalizedPath);
}

/**
 * Find the best matching directory pattern for a path
 */
function findBestPatternMatch(
  relativePath: string,
  customScores: Record<string, number> = {},
): { pattern: string; score: number } | null {
  const allPatterns = { ...REUSABLE_DIRECTORY_PATTERNS, ...customScores };

  let bestMatch: { pattern: string; score: number } | null = null;

  for (const [pattern, score] of Object.entries(allPatterns)) {
    if (matchesPattern(relativePath, pattern)) {
      // Prefer more specific patterns (longer patterns)
      if (!bestMatch || pattern.length > bestMatch.pattern.length || score > bestMatch.score) {
        bestMatch = { pattern, score };
      }
    }
  }

  return bestMatch;
}

/**
 * Calculate depth adjustment for score
 *
 * Deeper paths get slightly lower scores as they're less "shared"
 */
function getDepthAdjustment(depth: number): number {
  if (depth <= 2) return 0; // src/lib, packages/shared
  if (depth <= 3) return -5; // src/lib/utils
  if (depth <= 4) return -10; // apps/web/src/lib
  return -15; // Very deep paths
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Analyze directory signals for a file path
 *
 * @param relativePath - Path relative to project root
 * @param customScores - Optional custom directory scores
 * @returns Directory signals with score
 *
 * @example
 * ```ts
 * const signals = analyzeDirectorySignals('src/lib/utils/format.ts');
 * // { matchedPattern: 'lib/**', depth: 3, score: 25, isInReusableDir: true }
 * ```
 */
export function analyzeDirectorySignals(
  relativePath: string,
  customScores: Record<string, number> = {},
): DirectorySignals {
  const normalizedPath = relativePath.replace(/\\/g, '/');
  const depth = normalizedPath.split('/').length;

  // Find matching pattern
  const match = findBestPatternMatch(normalizedPath, customScores);

  if (!match) {
    return {
      depth,
      score: 0,
      isInReusableDir: false,
    };
  }

  // Calculate final score with depth adjustment
  const depthAdjustment = getDepthAdjustment(depth);
  const finalScore = Math.max(0, match.score + depthAdjustment);

  return {
    matchedPattern: match.pattern,
    depth,
    score: finalScore,
    isInReusableDir: true,
  };
}

/**
 * Check if a path is in a reusable directory
 *
 * @param relativePath - Path relative to project root
 * @returns True if path matches any reusable directory pattern
 */
export function isInReusableDirectory(relativePath: string): boolean {
  return analyzeDirectorySignals(relativePath).isInReusableDir;
}

/**
 * Get directory category hint from path
 *
 * Returns a hint about what category the module might be based on directory.
 */
export function getDirectoryCategoryHint(
  relativePath: string,
): 'component' | 'hook' | 'utility' | 'type' | 'service' | 'context' | 'constant' | null {
  const normalizedPath = relativePath.toLowerCase().replace(/\\/g, '/');

  if (/\/components\/|\/ui\/|\/atoms\/|\/molecules\/|\/organisms\//.test(normalizedPath)) {
    return 'component';
  }
  if (/\/hooks\//.test(normalizedPath)) {
    return 'hook';
  }
  if (/\/utils\/|\/utilities\/|\/helpers\//.test(normalizedPath)) {
    return 'utility';
  }
  if (/\/types\/|\/interfaces\/|\/models\//.test(normalizedPath)) {
    return 'type';
  }
  if (/\/services\/|\/api\/|\/clients\//.test(normalizedPath)) {
    return 'service';
  }
  if (/\/contexts\/|\/providers\//.test(normalizedPath)) {
    return 'context';
  }
  if (/\/constants\/|\/config\//.test(normalizedPath)) {
    return 'constant';
  }

  return null;
}

/**
 * Extract the reusable module name from a path
 *
 * For directories with index.ts, returns the directory name.
 * For single files, returns the file name without extension.
 */
export function extractModuleName(relativePath: string): string {
  const normalizedPath = relativePath.replace(/\\/g, '/');
  const parts = normalizedPath.split('/');

  // If ends with index.ts, use parent directory name
  const fileName = parts[parts.length - 1] ?? 'unknown';
  if (/^index\.(ts|tsx|js|jsx)$/.test(fileName)) {
    return parts[parts.length - 2] ?? 'unknown';
  }

  // Otherwise use file name without extension
  return path.basename(fileName, path.extname(fileName));
}
