/**
 * @module lib/@ranking/weights
 * @description Symbol weight calculation for PageRank-based ranking
 *
 * Provides functions to calculate importance weights for symbols
 * based on naming patterns, visibility, and context matching.
 *
 * @example
 * ```ts
 * import { calculateSymbolWeight, matchesFeatureOrDomain } from '@/lib/@ranking';
 *
 * const match = matchesFeatureOrDomain('getUserBooking', 'booking', ['user']);
 * const weight = calculateSymbolWeight('getUserBooking', {
 *   definitionCount: 1,
 *   matchesFeature: match.matchesFeature,
 *   matchesDomain: match.matchesDomain,
 * });
 * ```
 */

import { detectNamingPattern } from '@/lib/@discovery/reusables/signals';
import type { FeatureDomainMatch, SymbolWeightContext } from './types.js';

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Weight multipliers for different symbol characteristics
 *
 * These values are tuned to produce meaningful ranking differences
 * while avoiding extreme score disparities.
 */
export const WEIGHT_MULTIPLIERS = {
  /**
   * Multiplier for meaningful names (8+ chars with proper naming convention)
   *
   * Rewards well-named symbols that are likely to be important abstractions.
   */
  MEANINGFUL_NAME: 10,

  /**
   * Multiplier for private/internal symbols (starts with underscore)
   *
   * Reduces weight since private symbols are implementation details.
   */
  PRIVATE_SYMBOL: 0.1,

  /**
   * Multiplier for generic symbols (defined in many places)
   *
   * Reduces weight for common names like `id`, `name`, `value`.
   */
  GENERIC_SYMBOL: 0.1,

  /**
   * Multiplier for symbols matching the target feature
   *
   * Strong boost for directly relevant symbols.
   */
  FEATURE_MATCH: 10,

  /**
   * Multiplier for symbols matching related domains
   *
   * Moderate boost for contextually relevant symbols.
   */
  DOMAIN_MATCH: 3,

  /**
   * Multiplier for exported symbols
   *
   * Slightly higher weight for public API symbols.
   */
  EXPORTED: 2,
} as const;

/**
 * Minimum character length for a symbol to qualify as "meaningful"
 *
 * Short names like `id`, `fn`, `x` are excluded from the meaningful name bonus.
 */
export const MIN_MEANINGFUL_LENGTH = 8;

/**
 * Threshold for considering a symbol as "generic" (defined in too many places)
 *
 * Symbols defined in more than this many files are likely common/generic names.
 */
export const GENERIC_DEFINITION_THRESHOLD = 5;

/**
 * Naming patterns that qualify for the meaningful name bonus
 *
 * These patterns indicate well-structured, purposeful abstractions.
 */
export const MEANINGFUL_PATTERNS = new Set([
  'utility',
  'hook',
  'service',
  'guard',
  'schema',
  'component',
  'context',
  'hoc',
]);

// ============================================================================
// FEATURE/DOMAIN MATCHING
// ============================================================================

/**
 * Check if a symbol name matches a feature or domain pattern
 *
 * Performs case-insensitive substring matching to determine
 * relevance to the target feature and related domains.
 *
 * @param symbolName - Symbol name to check
 * @param feature - Feature name to match (e.g., "booking", "auth")
 * @param domains - Additional domain names to match
 * @returns Object indicating feature and domain match status
 *
 * @example
 * ```ts
 * const match = matchesFeatureOrDomain('createBookingSlot', 'booking', ['slot', 'calendar']);
 * // { matchesFeature: true, matchesDomain: true }
 *
 * const noMatch = matchesFeatureOrDomain('handleLogin', 'booking', ['slot']);
 * // { matchesFeature: false, matchesDomain: false }
 * ```
 */
export function matchesFeatureOrDomain(
  symbolName: string,
  feature?: string,
  domains?: string[],
): FeatureDomainMatch {
  const lowerSymbol = symbolName.toLowerCase();

  const matchesFeature = feature ? lowerSymbol.includes(feature.toLowerCase()) : false;

  const matchesDomain = domains
    ? domains.some((domain) => lowerSymbol.includes(domain.toLowerCase()))
    : false;

  return { matchesFeature, matchesDomain };
}

// ============================================================================
// WEIGHT CALCULATION
// ============================================================================

/**
 * Calculate weight for a symbol based on naming patterns and context
 *
 * Combines multiple heuristics to determine symbol importance:
 * 1. Meaningful naming patterns (hooks, utilities, services, etc.)
 * 2. Private symbol penalty (underscore prefix)
 * 3. Generic symbol penalty (defined in many files)
 * 4. Feature/domain matching boost
 *
 * @param symbol - Symbol name to analyze
 * @param context - Context containing definition count and feature matching
 * @returns Computed weight multiplier (1.0 is baseline)
 *
 * @example
 * ```ts
 * // Well-named utility matching the feature
 * const weight1 = calculateSymbolWeight('getUserBookingById', {
 *   definitionCount: 1,
 *   matchesFeature: true,
 *   matchesDomain: false,
 * });
 * // Returns: 10 (meaningful) * 10 (feature match) = 100
 *
 * // Private, generic symbol
 * const weight2 = calculateSymbolWeight('_id', {
 *   definitionCount: 10,
 *   matchesFeature: false,
 *   matchesDomain: false,
 * });
 * // Returns: 1.0 * 0.1 (private) * 0.1 (generic) = 0.01
 * ```
 */
export function calculateSymbolWeight(symbol: string, context: SymbolWeightContext): number {
  let weight = 1.0;

  // Check for meaningful naming pattern
  const pattern = detectNamingPattern(symbol);
  const hasMeaningfulPattern = pattern !== null && MEANINGFUL_PATTERNS.has(pattern);

  if (hasMeaningfulPattern && symbol.length >= MIN_MEANINGFUL_LENGTH) {
    weight *= WEIGHT_MULTIPLIERS.MEANINGFUL_NAME;
  }

  // Private symbols get reduced weight
  if (symbol.startsWith('_')) {
    weight *= WEIGHT_MULTIPLIERS.PRIVATE_SYMBOL;
  }

  // Generic symbols (defined in many places) get reduced weight
  if (context.definitionCount > GENERIC_DEFINITION_THRESHOLD) {
    weight *= WEIGHT_MULTIPLIERS.GENERIC_SYMBOL;
  }

  // Feature/domain matching boosts
  if (context.matchesFeature) {
    weight *= WEIGHT_MULTIPLIERS.FEATURE_MATCH;
  } else if (context.matchesDomain) {
    weight *= WEIGHT_MULTIPLIERS.DOMAIN_MATCH;
  }

  return weight;
}

/**
 * Calculate path-based boost for feature/domain matching
 *
 * Provides additional weight based on file path matching.
 * Used for personalization vector construction.
 *
 * @param filePath - File path to analyze
 * @param feature - Feature name to match
 * @param domains - Additional domains to match
 * @returns Boost multiplier (1.0 if no match)
 *
 * @example
 * ```ts
 * const boost = calculatePathBoost('src/features/booking/slots.ts', 'booking', ['slots']);
 * // Returns: 5 (feature) * 2 (domain) = 10
 * ```
 */
export function calculatePathBoost(filePath: string, feature?: string, domains?: string[]): number {
  /** Boost for file path containing target feature */
  const FEATURE_PATH_BOOST = 5;
  /** Boost for file path containing related domain */
  const DOMAIN_PATH_BOOST = 2;

  let boost = 1.0;
  const lowerPath = filePath.toLowerCase();

  if (feature && lowerPath.includes(feature.toLowerCase())) {
    boost *= FEATURE_PATH_BOOST;
  }

  if (domains) {
    for (const domain of domains) {
      if (lowerPath.includes(domain.toLowerCase())) {
        boost *= DOMAIN_PATH_BOOST;
        break; // Only apply once
      }
    }
  }

  return boost;
}
