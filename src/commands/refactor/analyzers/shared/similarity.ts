/**
 * @module commands/refactor/analyzers/shared/similarity
 * @description Shared similarity calculation algorithms for duplicate detection
 */

import { SIMILARITY_THRESHOLDS } from './constants';

/**
 * Calculate Jaccard similarity between two sets
 * Jaccard(A, B) = |A ∩ B| / |A ∪ B|
 *
 * @param set1 - First set
 * @param set2 - Second set
 * @returns Similarity score between 0 and 1
 */
export function jaccardSimilarity<T>(set1: Set<T>, set2: Set<T>): number {
  if (set1.size === 0 && set2.size === 0) return 1;

  const intersection = [...set1].filter((item) => set2.has(item)).length;
  const union = new Set([...set1, ...set2]).size;

  return union === 0 ? 0 : intersection / union;
}

/**
 * Tokenize a string for similarity comparison
 * Splits on whitespace and filters empty tokens
 *
 * @param str - String to tokenize
 * @returns Set of tokens
 */
export function tokenize(str: string): Set<string> {
  return new Set(str.split(/\s+/).filter((t) => t.length > 0));
}

/**
 * Calculate similarity between two strings using token-based Jaccard
 * Includes length-based early exit optimization
 *
 * @param str1 - First string
 * @param str2 - Second string
 * @param options - Optional pre-computed tokens and threshold
 * @returns Similarity score between 0 and 1
 */
export function calculateStringSimilarity(
  str1: string,
  str2: string,
  options?: {
    tokens1?: Set<string>;
    tokens2?: Set<string>;
    maxLengthDiff?: number;
  },
): number {
  if (str1 === str2) return 1;

  const len1 = str1.length;
  const len2 = str2.length;
  const maxLen = Math.max(len1, len2);

  if (maxLen === 0) return 1;

  // Quick exit for very different lengths
  const maxLengthDiff = options?.maxLengthDiff ?? SIMILARITY_THRESHOLDS.LENGTH_DIFF;
  if (Math.abs(len1 - len2) / maxLen > maxLengthDiff) return 0;

  // Use provided tokens or tokenize
  const tokens1 = options?.tokens1 ?? tokenize(str1);
  const tokens2 = options?.tokens2 ?? tokenize(str2);

  return jaccardSimilarity(tokens1, tokens2);
}

/**
 * Calculate pairwise similarity for a group
 * Returns minimum similarity across all pairs (conservative approach)
 *
 * @param items - Items to compare
 * @param getSimilarity - Function to calculate similarity between two items
 * @param earlyExitThreshold - Threshold below which to stop early
 * @returns Minimum similarity score
 */
export function calculateGroupSimilarity<T>(
  items: T[],
  getSimilarity: (a: T, b: T) => number,
  earlyExitThreshold?: number,
): number {
  if (items.length < 2) return 0;

  // Short-circuit for 2-element groups
  if (items.length === 2) {
    const [a, b] = items;
    return a && b ? getSimilarity(a, b) : 0;
  }

  let minSimilarity = 1;
  const threshold = earlyExitThreshold ?? SIMILARITY_THRESHOLDS.MERGE;

  for (let i = 0; i < items.length - 1; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const itemI = items[i];
      const itemJ = items[j];
      if (itemI && itemJ) {
        const sim = getSimilarity(itemI, itemJ);
        minSimilarity = Math.min(minSimilarity, sim);

        // Early exit when below threshold
        if (minSimilarity < threshold) return minSimilarity;
      }
    }
  }

  return minSimilarity;
}
