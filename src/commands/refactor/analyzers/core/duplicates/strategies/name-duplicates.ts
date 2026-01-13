/**
 * @module commands/refactor/analyzers/core/duplicates/strategies/name-duplicates
 * @description Name-based duplicate detection strategy
 *
 * Finds functions with the same name in multiple files.
 */

import type { DuplicateInfo, FunctionSignature } from '../../../../core/types';
import { SIMILARITY_THRESHOLDS } from '../../../shared';
import { isMeaningfulFunctionName, isNextJsConventionPattern } from '../name-detection';
import { calculateGroupSimilarity } from '../similarity';
import { haveDifferentArchPatterns } from './filters';
import { deduplicateLocations } from './helpers';

// ============================================================================
// NAME-BASED DETECTION
// ============================================================================

/**
 * Find duplicates based on function name.
 * Groups functions by name and identifies those with same name in multiple files.
 */
export function findNameBasedDuplicates(allFunctions: FunctionSignature[]): DuplicateInfo[] {
  const duplicates: DuplicateInfo[] = [];

  // Group functions by name (skip generic names and framework conventions)
  const byName = new Map<string, FunctionSignature[]>();

  for (const func of allFunctions) {
    // Skip generic/callback names
    if (!isMeaningfulFunctionName(func.name)) continue;

    // Skip Next.js convention patterns (POST, GET, *Page in page.tsx, etc.)
    if (isNextJsConventionPattern(func.name, func.file)) continue;

    const existing = byName.get(func.name) ?? [];
    existing.push(func);
    byName.set(func.name, existing);
  }

  // Find duplicates (same name in multiple files)
  for (const [name, funcs] of byName) {
    if (funcs.length < 2) continue;

    // Deduplicate locations and check if there are multiple unique files
    const { locations, uniqueFileCount } = deduplicateLocations(funcs);

    // Skip if all occurrences are in the same file (not a real duplicate)
    if (uniqueFileCount < 2) continue;

    // Skip if only one unique location after deduplication
    if (locations.length < 2) continue;

    // Skip if functions have different architectural patterns (sync vs async, DI vs internal-fetch)
    // These represent intentional architectural separation, not duplication
    if (haveDifferentArchPatterns(funcs)) continue;

    const similarity = calculateGroupSimilarity(funcs);

    // Skip if similarity is too low - these are just naming collisions, not duplicates
    // E.g., `formatAI` in fix/output vs issue/output with completely different bodies
    if (similarity < SIMILARITY_THRESHOLDS.MIN_REPORT_SIMILARITY) continue;

    let recommendation: 'merge' | 'rename' | 'keep-both' = 'keep-both';
    if (similarity > SIMILARITY_THRESHOLDS.MERGE) {
      recommendation = 'merge';
    } else if (similarity > SIMILARITY_THRESHOLDS.RENAME_FUNCTIONS) {
      recommendation = 'rename';
    }

    duplicates.push({
      name,
      locations,
      similarity,
      recommendation,
    });
  }

  return duplicates;
}
