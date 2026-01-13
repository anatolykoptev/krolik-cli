/**
 * @module commands/refactor/analyzers/core/duplicates/strategies/helpers
 * @description Helper utilities for duplicate detection strategies
 */

import type { DuplicateLocation, FunctionSignature } from '../../../../core/types';
import { SIMILARITY_THRESHOLDS } from '../../../shared';

// ============================================================================
// SIZE CHECKS
// ============================================================================

/**
 * Check if function body is large enough to be a duplicate candidate.
 * Uses normalized body length (~100 chars = 2-3 lines of meaningful code).
 */
export function isLargeEnoughForDuplication(func: FunctionSignature): boolean {
  return func.normalizedBody.length >= SIMILARITY_THRESHOLDS.MIN_BODY_LENGTH;
}

// ============================================================================
// NEXT.JS FILE DETECTION
// ============================================================================

/**
 * Check if file is a Next.js page file (page.tsx or page.ts in app directory)
 */
export function isNextJsPageFile(filePath: string): boolean {
  return /\/page\.tsx?$/.test(filePath);
}

/**
 * Check if all functions are in different Next.js route segments.
 * Functions in different route segments (e.g., /panel/customers vs /panel/bookings)
 * are intentional wrappers, not real duplicates.
 */
export function areAllInDifferentRouteSegments(funcs: FunctionSignature[]): boolean {
  // Only applies if ALL functions are in page.tsx files
  if (!funcs.every((f) => isNextJsPageFile(f.file))) return false;

  // Extract route segments (everything before /page.tsx)
  const segments = funcs.map((f) => {
    const match = f.file.match(/(.+)\/page\.tsx?$/);
    return match?.[1] ?? f.file;
  });

  // If all segments are unique, these are different routes
  const uniqueSegments = new Set(segments);
  return uniqueSegments.size === funcs.length;
}

// ============================================================================
// DEDUPLICATION
// ============================================================================

/**
 * Deduplicate locations by file:line key
 * Returns unique locations and whether there are multiple unique files
 */
export function deduplicateLocations(funcs: FunctionSignature[]): {
  locations: DuplicateLocation[];
  uniqueFileCount: number;
} {
  const seen = new Map<string, DuplicateLocation>();
  const uniqueFiles = new Set<string>();

  for (const f of funcs) {
    const key = `${f.file}:${f.line}`;
    if (!seen.has(key)) {
      seen.set(key, { file: f.file, line: f.line, exported: f.exported });
      uniqueFiles.add(f.file);
    }
  }

  return {
    locations: [...seen.values()],
    uniqueFileCount: uniqueFiles.size,
  };
}

// ============================================================================
// NAME SORTING
// ============================================================================

/**
 * Sort names by export status (exported first) then alphabetically
 */
export function sortNamesByExportStatus(
  uniqueNames: Set<string>,
  funcs: FunctionSignature[],
): string[] {
  return [...uniqueNames].sort((a, b) => {
    const aExported = funcs.some((f) => f.name === a && f.exported);
    const bExported = funcs.some((f) => f.name === b && f.exported);
    if (aExported && !bExported) return -1;
    if (!aExported && bExported) return 1;
    return a.localeCompare(b);
  });
}
