/**
 * @module commands/refactor/analyzers/core/duplicates/strategies/filters
 * @description Filtering functions to eliminate false positives in duplicate detection
 */

import { detectArchitecturalPattern } from '../../../../../../lib/@detectors/noise-filter/extractors';
import type { FunctionSignature } from '../../../../core/types';

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Common verb prefixes that indicate intentional patterns when followed by different nouns.
 * E.g., `clearContentCache` vs `clearEmbeddingCache` = intentional pattern, not duplicate.
 */
const INTENTIONAL_VERB_PREFIXES = [
  // State management
  'clear',
  'get',
  'set',
  'add',
  'remove',
  'delete',
  'create',
  'update',
  'register',
  // Processing
  'extract',
  'find',
  'detect',
  'analyze',
  'calculate',
  'generate',
  'parse',
  'format',
  'validate',
  'escape',
  'group',
  // Boolean checks
  'is',
  'has',
  'have',
  'can',
  'should',
  'matches',
  'all',
  // Actions
  'complete',
  'hold',
  'apply',
  'resolve',
  'render',
  'build',
  'load',
  'save',
  'fetch',
  'visit',
] as const;

// ============================================================================
// FILTER FUNCTIONS
// ============================================================================

/**
 * Check if function names follow a verb+noun pattern with same verb but different nouns.
 * These are intentional patterns, not real duplicates.
 *
 * Examples:
 * - clearContentCache / clearEmbeddingCache -> true (same verb, different nouns)
 * - formatAI / formatMarkdown -> true (same verb, different nouns)
 * - createContext / createContext -> false (same name entirely)
 */
export function areIntentionalVerbNounPatterns(names: string[]): boolean {
  if (names.length < 2) return false;

  // Find common prefix that matches a verb
  const firstChars = names[0]?.toLowerCase() ?? '';

  for (const verb of INTENTIONAL_VERB_PREFIXES) {
    if (!firstChars.startsWith(verb)) continue;

    // Check if all names start with this verb but have different suffixes
    const suffixes = names.map((name) => {
      const lower = name.toLowerCase();
      if (!lower.startsWith(verb)) return null;
      return name.slice(verb.length);
    });

    // If any name doesn't match the verb pattern, this is not a verb+noun pattern
    if (suffixes.some((s) => s === null)) continue;

    // If all suffixes are different, this is an intentional pattern
    const uniqueSuffixes = new Set(suffixes);
    if (uniqueSuffixes.size === names.length) {
      return true;
    }
  }

  return false;
}

/**
 * Check if functions have different architectural patterns.
 * Functions with different patterns (sync vs async, DI vs internal-fetch)
 * represent architectural separation, not real duplicates.
 */
export function haveDifferentArchPatterns(funcs: FunctionSignature[]): boolean {
  if (funcs.length < 2) return false;

  const patterns = funcs.map((f) =>
    detectArchitecturalPattern({
      file: f.file,
      name: f.name,
      text: f.normalizedBody,
      params: f.params,
      isAsync: f.isAsync,
      paramCount: f.paramCount,
    }),
  );

  const uniquePatterns = new Set(patterns.map((p) => p.patternKey));
  return uniquePatterns.size > 1;
}
