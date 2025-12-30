/**
 * @module commands/refactor/analyzers/core/duplicates/linguistic
 * @description Linguistic analysis utilities for name detection
 *
 * Re-exports from @core/text for backward compatibility.
 * New code should import directly from '@/lib/@core/text'.
 */

import { extractVerbPrefix } from '../../../../../lib/@detectors';

// Re-export all morphology utilities from @core/text
export {
  estimateSyllables,
  getVowelRatio,
  hasNounSuffix,
  isAbbreviation,
  isPastParticiple,
  isPluralNoun,
  splitIntoSegments,
} from '../../../../../lib/@core/text';

/**
 * Check if a word starts with a verb prefix
 * Words starting with action verbs are usually meaningful when combined
 *
 * Uses the shared linguistic verb detection from @patterns/verb-detection
 */
export function hasVerbPrefix(word: string): boolean {
  // Use the shared verb detection module for consistent behavior
  return extractVerbPrefix(word) !== null;
}
