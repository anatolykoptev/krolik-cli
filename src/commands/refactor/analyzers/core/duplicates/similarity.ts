/**
 * @module commands/refactor/analyzers/core/duplicates/similarity
 * @description Similarity calculation for function duplicate detection
 */

import type { FunctionSignature } from '../../../core';
import { jaccardSimilarity, SIMILARITY_THRESHOLDS } from '../../shared';

/**
 * Calculate similarity between two function bodies
 * Returns 0-1 (1 = identical)
 * Uses shared jaccardSimilarity for token comparison
 */
export function calculateSimilarity(
  body1: string,
  body2: string,
  tokens1?: Set<string>,
  tokens2?: Set<string>,
): number {
  if (body1 === body2) return 1;

  const len1 = body1.length;
  const len2 = body2.length;
  const maxLen = Math.max(len1, len2);

  if (maxLen === 0) return 1;

  // For very different lengths, quick exit
  if (Math.abs(len1 - len2) / maxLen > SIMILARITY_THRESHOLDS.LENGTH_DIFF) return 0;

  // Token-based Jaccard similarity using shared utility
  // Use pre-computed tokens if available, otherwise compute on demand
  const t1 = tokens1 ?? new Set(body1.split(/\s+/).filter((t) => t.length > 0));
  const t2 = tokens2 ?? new Set(body2.split(/\s+/).filter((t) => t.length > 0));

  return jaccardSimilarity(t1, t2);
}

/**
 * Calculate pairwise similarity for multiple functions
 * Returns the minimum similarity (conservative approach)
 */
export function calculateGroupSimilarity(funcs: FunctionSignature[]): number {
  if (funcs.length < 2) return 0;

  // Short-circuit for 2-element groups
  if (funcs.length === 2) {
    const f1 = funcs[0];
    const f2 = funcs[1];
    if (!f1 || !f2) return 0;
    return calculateSimilarity(f1.normalizedBody, f2.normalizedBody, f1.tokens, f2.tokens);
  }

  let minSimilarity = 1;

  for (let i = 0; i < funcs.length - 1; i++) {
    for (let j = i + 1; j < funcs.length; j++) {
      const fi = funcs[i];
      const fj = funcs[j];
      if (fi && fj) {
        const sim = calculateSimilarity(fi.normalizedBody, fj.normalizedBody, fi.tokens, fj.tokens);
        minSimilarity = Math.min(minSimilarity, sim);

        // Early exit when below threshold - can't improve
        if (minSimilarity < SIMILARITY_THRESHOLDS.MERGE) return minSimilarity;
      }
    }
  }

  return minSimilarity;
}
