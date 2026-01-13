/**
 * @module commands/refactor/analyzers/core/duplicates/strategies/structural-clones
 * @description Structural clone detection strategy using fingerprints
 *
 * Finds functions with same structure but different variable names.
 * E.g., `getUser(id) { return db.find(id); }` and `fetchItem(key) { return store.find(key); }`
 */

import {
  allRenderDifferentComponents,
  areAllDifferentDomains,
  detectIntent,
} from '../../../../../../lib/@detectors/noise-filter/extractors';
import type { DuplicateInfo, FunctionSignature } from '../../../../core/types';
import { areIntentionalVerbNounPatterns, haveDifferentArchPatterns } from './filters';
import {
  areAllInDifferentRouteSegments,
  deduplicateLocations,
  isLargeEnoughForDuplication,
  sortNamesByExportStatus,
} from './helpers';

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Minimum structural complexity for clone detection.
 * Filters out simple wrappers like `return <Component />` (complexity ~15).
 * Only functions with meaningful logic (complexity > 25) are considered clones.
 */
const MIN_STRUCTURAL_COMPLEXITY = 25;

/**
 * Intents that should be skipped in structural clone detection.
 * These represent intentional patterns, not real duplicates.
 */
const SKIPPABLE_INTENTS = [
  'factory-instance',
  'component-wrapper',
  'route-handler',
  'schema-generator',
] as const;

// ============================================================================
// STRUCTURAL CLONE DETECTION
// ============================================================================

/**
 * Find structural clones using fingerprints.
 * Catches renamed clones that body hash misses.
 *
 * @param allFunctions - All extracted functions
 * @param reportedLocations - Set of already reported locations (to avoid duplicates)
 */
export function findStructuralClones(
  allFunctions: FunctionSignature[],
  reportedLocations: Set<string>,
): DuplicateInfo[] {
  const duplicates: DuplicateInfo[] = [];

  // Group by fingerprint
  const byFingerprint = new Map<string, FunctionSignature[]>();

  for (const func of allFunctions) {
    // Skip tiny functions and functions without fingerprint
    if (!isLargeEnoughForDuplication(func)) continue;
    if (!func.fingerprint) continue;

    // Skip low-complexity functions (simple wrappers like `return <X />`)
    // These are intentional patterns, not real duplicates
    if ((func.complexity ?? 0) < MIN_STRUCTURAL_COMPLEXITY) continue;

    // Skip if already reported in another duplicate group
    const locKey = `${func.file}:${func.line}`;
    if (reportedLocations.has(locKey)) continue;

    const existing = byFingerprint.get(func.fingerprint) ?? [];
    existing.push(func);
    byFingerprint.set(func.fingerprint, existing);
  }

  for (const [, funcs] of byFingerprint) {
    if (funcs.length < 2) continue;

    // Deduplicate locations and check if there are multiple unique files
    const { locations, uniqueFileCount } = deduplicateLocations(funcs);

    // Skip if all occurrences are in the same file
    if (uniqueFileCount < 2) continue;

    // Skip if only one unique location after deduplication
    if (locations.length < 2) continue;

    const uniqueNames = new Set(funcs.map((f) => f.name));
    // Only report if names are actually different (otherwise would be caught by name matching)
    if (uniqueNames.size < 2) continue;

    // Skip if names follow intentional verb+noun patterns (e.g., clearContentCache / clearEmbeddingCache)
    // These are intentional patterns with same structure but operating on different data
    if (areIntentionalVerbNounPatterns([...uniqueNames])) continue;

    // Skip if all functions are in different Next.js route segments
    // These are intentional page wrappers, not real duplicates
    if (areAllInDifferentRouteSegments(funcs)) continue;

    // Skip if all functions are in different domains
    // Cross-domain structural similarity is intentional, not duplication
    const filePaths = funcs.map((f) => f.file);
    if (areAllDifferentDomains(filePaths)) continue;

    // Skip if any function has a skippable intent (factory, wrapper, route-handler, schema-generator)
    const hasSkippableIntent = funcs.some((f) => {
      const { intent } = detectIntent({ file: f.file, name: f.name, text: f.normalizedBody });
      return (SKIPPABLE_INTENTS as readonly string[]).includes(intent);
    });
    if (hasSkippableIntent) continue;

    // Skip if all functions render different JSX components
    // These are intentional wrappers, not duplicates
    const bodies = funcs.map((f) => f.normalizedBody);
    if (allRenderDifferentComponents(bodies)) continue;

    // Skip if functions have different architectural patterns (sync vs async, DI vs internal-fetch)
    if (haveDifferentArchPatterns(funcs)) continue;

    const sortedNames = sortNamesByExportStatus(uniqueNames, funcs);

    duplicates.push({
      name: `[structural clone] ${sortedNames.join(' / ')}`,
      locations,
      similarity: 0.95, // Slightly less than identical body to differentiate
      recommendation: 'merge',
    });
  }

  return duplicates;
}
