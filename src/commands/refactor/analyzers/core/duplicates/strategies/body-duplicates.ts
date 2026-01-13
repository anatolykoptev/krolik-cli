/**
 * @module commands/refactor/analyzers/core/duplicates/strategies/body-duplicates
 * @description Body hash-based duplicate detection strategy
 *
 * Finds functions with identical bodies but different names.
 */

import type { DuplicateInfo, FunctionSignature } from '../../../../core/types';
import { areIntentionalVerbNounPatterns, haveDifferentArchPatterns } from './filters';
import {
  deduplicateLocations,
  isLargeEnoughForDuplication,
  sortNamesByExportStatus,
} from './helpers';

// ============================================================================
// BODY HASH DETECTION
// ============================================================================

/**
 * Find duplicates based on body hash.
 * Groups functions by their body hash to find identical implementations with different names.
 *
 * @param allFunctions - All extracted functions
 * @param reportedLocations - Set to track reported locations (mutated, used to avoid duplicates in structural detection)
 */
export function findBodyHashDuplicates(
  allFunctions: FunctionSignature[],
  reportedLocations: Set<string>,
): DuplicateInfo[] {
  const duplicates: DuplicateInfo[] = [];

  // Group by body hash
  const byHash = new Map<string, FunctionSignature[]>();

  for (const func of allFunctions) {
    // Skip tiny functions
    if (!isLargeEnoughForDuplication(func)) continue;

    const existing = byHash.get(func.bodyHash) ?? [];
    existing.push(func);
    byHash.set(func.bodyHash, existing);
  }

  for (const [, funcs] of byHash) {
    if (funcs.length < 2) continue;

    // Deduplicate locations and check if there are multiple unique files
    const { locations, uniqueFileCount } = deduplicateLocations(funcs);

    // Skip if all occurrences are in the same file
    if (uniqueFileCount < 2) continue;

    // Skip if only one unique location after deduplication
    if (locations.length < 2) continue;

    const uniqueNames = new Set(funcs.map((f) => f.name));
    if (uniqueNames.size === 1) continue;

    // Skip if names follow intentional verb+noun patterns (e.g., getUser / getProduct)
    // Identical bodies with verb+noun patterns are intentional abstractions
    if (areIntentionalVerbNounPatterns([...uniqueNames])) continue;

    // Skip if functions have different architectural patterns
    if (haveDifferentArchPatterns(funcs)) continue;

    const sortedNames = sortNamesByExportStatus(uniqueNames, funcs);

    // Mark these locations as reported
    for (const loc of locations) {
      reportedLocations.add(`${loc.file}:${loc.line}`);
    }

    duplicates.push({
      name: `[identical body] ${sortedNames.join(' / ')}`,
      locations,
      similarity: 1,
      recommendation: 'merge',
    });
  }

  return duplicates;
}
