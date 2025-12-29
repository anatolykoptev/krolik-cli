/**
 * @module commands/refactor/analyzers/core/duplicates/name-detection
 * @description Dynamic function name detection without hardcoded word lists
 */

import { detectNamingPattern } from '@/lib/@discovery/reusables';
import { GENERIC_STRUCTURAL_PATTERNS } from './constants';
import { getVowelRatio, isAbbreviation, splitIntoSegments } from './linguistic';
import {
  isCommonCallbackPattern,
  isPlaceholderName,
  isShortVerbPrefix,
  isSuffixOnlyName,
} from './patterns';

// Re-export pattern functions for backward compatibility
export { isCommonCallbackPattern, isPlaceholderName, isSuffixOnlyName } from './patterns';

/**
 * Check if a function name is likely generic/not meaningful for duplicate detection
 * Uses dynamic heuristics without static word lists
 */
export function isGenericFunctionName(name: string): boolean {
  // 1. Structural patterns (single letter, short abbreviations, underscores)
  for (const pattern of GENERIC_STRUCTURAL_PATTERNS) {
    if (pattern.test(name)) return true;
  }

  // 2. Too short names are usually generic
  if (name.length < 3) return true;

  // 3. Check if it's a short abbreviation (low vowel ratio)
  if (name.length <= 4 && isAbbreviation(name)) return true;

  // 4. JS/TS reserved words and types (detected by pattern, not list)
  const lowerName = name.toLowerCase();
  if (/^(null|undefined|true|false|nan|infinity)$/.test(lowerName)) return true;
  if (/^(string|number|boolean|object|array|function|symbol|bigint)$/.test(lowerName)) return true;

  // 5. Placeholder naming patterns (dynamic detection)
  if (isPlaceholderName(name)) return true;

  return false;
}

/**
 * Check if a name is likely a meaningful function name worth tracking
 * Uses dynamic analysis: naming patterns, structure, linguistics
 */
export function isMeaningfulFunctionName(name: string): boolean {
  // Skip obviously generic names
  if (isGenericFunctionName(name)) return false;

  // Must be at least 4 chars
  if (name.length < 4) return false;

  // Skip common callback patterns - they repeat everywhere by design
  if (isCommonCallbackPattern(name)) return false;

  // 1. Check if it matches a recognized naming pattern from @reusable
  const namedPattern = detectNamingPattern(name);
  if (namedPattern) {
    return true;
  }

  // 2. Multi-word names are meaningful (camelCase/snake_case with 2+ segments)
  const segments = splitIntoSegments(name);
  if (segments.length >= 2) {
    return true;
  }

  // 3. Single words: check for suffix-only patterns (dynamic detection)
  if (isSuffixOnlyName(name)) {
    return false;
  }

  // 4. Single words: analyze linguistically
  if (segments.length === 1) {
    const word = segments[0]?.toLowerCase() ?? '';

    // Long single words (7+ chars) are usually meaningful domain terms
    if (word.length >= 7) return true;

    // Short single words (4-6 chars): check if they're real words
    const vowelRatio = getVowelRatio(word);
    if (vowelRatio < 0.2 || vowelRatio > 0.7) {
      return false;
    }

    // Check for short verb prefixes that need context
    if (isShortVerbPrefix(word)) {
      return false;
    }

    return true;
  }

  return true;
}
