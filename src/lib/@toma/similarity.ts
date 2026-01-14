/**
 * @module lib/@toma/similarity
 * @description Multi-metric similarity for Toma-based detection
 *
 * Implements 6 similarity metrics optimized for code comparison:
 * - Jaccard: Set overlap
 * - Dice: Normalized set overlap
 * - Jaro: Character-level matching
 * - Jaro-Winkler: Jaro with prefix bonus
 * - Cosine: Token frequency vectors
 * - LCS: Longest common subsequence
 */

import { DEFAULT_WEIGHTS, type MetricWeights, type SimilarityMetrics } from './types';

// ============================================================================
// SIMILARITY CACHE (for repeated comparisons)
// ============================================================================

/** LRU cache for similarity results */
const similarityCache = new Map<string, number>();
const MAX_CACHE_SIZE = 1000;

/**
 * Get cached similarity or compute and cache
 */
function getCachedSimilarity(seq1: string, seq2: string, compute: () => number): number {
  // Normalize key order for symmetry
  const key = seq1 < seq2 ? `${seq1}|${seq2}` : `${seq2}|${seq1}`;

  const cached = similarityCache.get(key);
  if (cached !== undefined) return cached;

  const result = compute();

  // LRU eviction
  if (similarityCache.size >= MAX_CACHE_SIZE) {
    const firstKey = similarityCache.keys().next().value;
    if (firstKey) similarityCache.delete(firstKey);
  }

  similarityCache.set(key, result);
  return result;
}

/**
 * Clear similarity cache (useful for testing)
 */
export function clearSimilarityCache(): void {
  similarityCache.clear();
}

// ============================================================================
// SET-BASED METRICS
// ============================================================================

/**
 * Jaccard similarity coefficient
 * |A ∩ B| / |A ∪ B|
 */
export function jaccard(seq1: string, seq2: string): number {
  const set1 = new Set(seq1.split(''));
  const set2 = new Set(seq2.split(''));

  let intersection = 0;
  for (const char of set1) {
    if (set2.has(char)) intersection++;
  }

  const union = set1.size + set2.size - intersection;
  return union === 0 ? 1 : intersection / union;
}

/**
 * Dice coefficient (Sørensen–Dice)
 * 2|A ∩ B| / (|A| + |B|)
 */
export function dice(seq1: string, seq2: string): number {
  const set1 = new Set(seq1.split(''));
  const set2 = new Set(seq2.split(''));

  let intersection = 0;
  for (const char of set1) {
    if (set2.has(char)) intersection++;
  }

  const total = set1.size + set2.size;
  return total === 0 ? 1 : (2 * intersection) / total;
}

// ============================================================================
// CHARACTER-LEVEL METRICS
// ============================================================================

/**
 * Jaro similarity
 * Character-level matching with transposition penalty
 *
 * @param s1 - First string
 * @param s2 - Second string
 * @returns Jaro similarity score (0-1)
 */
export function jaro(s1: string, s2: string): number {
  if (s1 === s2) return 1;
  if (s1.length === 0 || s2.length === 0) return 0;

  // For very short strings, match window could be negative - ensure it's at least 0
  const matchWindow = Math.max(0, Math.floor(Math.max(s1.length, s2.length) / 2) - 1);
  const s1Matches = new Array<boolean>(s1.length).fill(false);
  const s2Matches = new Array<boolean>(s2.length).fill(false);

  let matches = 0;
  let transpositions = 0;

  // Find matches
  for (let i = 0; i < s1.length; i++) {
    const start = Math.max(0, i - matchWindow);
    const end = Math.min(i + matchWindow + 1, s2.length);

    for (let j = start; j < end; j++) {
      if (s2Matches[j] || s1[i] !== s2[j]) continue;
      s1Matches[i] = true;
      s2Matches[j] = true;
      matches++;
      break;
    }
  }

  if (matches === 0) return 0;

  // Count transpositions
  let k = 0;
  for (let i = 0; i < s1.length; i++) {
    if (!s1Matches[i]) continue;
    while (!s2Matches[k]) k++;
    if (s1[i] !== s2[k]) transpositions++;
    k++;
  }

  return (matches / s1.length + matches / s2.length + (matches - transpositions / 2) / matches) / 3;
}

/**
 * Jaro-Winkler similarity
 * Jaro with prefix bonus (helpful for similar function names)
 */
export function jaroWinkler(s1: string, s2: string, prefixScale = 0.1): number {
  const jaroSim = jaro(s1, s2);

  // Find common prefix (max 4 chars)
  let prefix = 0;
  const maxPrefix = Math.min(4, Math.min(s1.length, s2.length));
  for (let i = 0; i < maxPrefix; i++) {
    if (s1[i] === s2[i]) prefix++;
    else break;
  }

  return jaroSim + prefix * prefixScale * (1 - jaroSim);
}

// ============================================================================
// VECTOR-BASED METRICS
// ============================================================================

/**
 * Cosine similarity using token frequency vectors
 */
export function cosine(seq1: string, seq2: string): number {
  // Build frequency maps
  const freq1 = new Map<string, number>();
  const freq2 = new Map<string, number>();

  for (const char of seq1) {
    freq1.set(char, (freq1.get(char) ?? 0) + 1);
  }
  for (const char of seq2) {
    freq2.set(char, (freq2.get(char) ?? 0) + 1);
  }

  // Compute dot product and magnitudes
  let dotProduct = 0;
  let mag1 = 0;
  let mag2 = 0;

  for (const [char, count] of freq1) {
    mag1 += count * count;
    const count2 = freq2.get(char) ?? 0;
    dotProduct += count * count2;
  }

  for (const [, count] of freq2) {
    mag2 += count * count;
  }

  const magnitude = Math.sqrt(mag1) * Math.sqrt(mag2);
  return magnitude === 0 ? 0 : dotProduct / magnitude;
}

// ============================================================================
// SEQUENCE-BASED METRICS
// ============================================================================

/**
 * Longest Common Subsequence ratio
 * LCS length / max(len1, len2)
 */
export function lcsRatio(seq1: string, seq2: string): number {
  const m = seq1.length;
  const n = seq2.length;

  if (m === 0 || n === 0) return 0;

  // Space-optimized LCS using two rows
  let prev = new Array<number>(n + 1).fill(0);
  let curr = new Array<number>(n + 1).fill(0);

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (seq1[i - 1] === seq2[j - 1]) {
        curr[j] = prev[j - 1]! + 1;
      } else {
        curr[j] = Math.max(prev[j]!, curr[j - 1]!);
      }
    }
    [prev, curr] = [curr, prev];
  }

  const lcsLength = prev[n]!;
  return lcsLength / Math.max(m, n);
}

// ============================================================================
// COMBINED SIMILARITY
// ============================================================================

/**
 * Compute all similarity metrics at once
 */
export function computeAllMetrics(seq1: string, seq2: string): SimilarityMetrics {
  return {
    jaccard: jaccard(seq1, seq2),
    dice: dice(seq1, seq2),
    jaro: jaro(seq1, seq2),
    jaroWinkler: jaroWinkler(seq1, seq2),
    cosine: cosine(seq1, seq2),
    lcsRatio: lcsRatio(seq1, seq2),
  };
}

/**
 * Compute weighted combined similarity score
 * Uses caching for repeated comparisons
 *
 * @param seq1 - First type sequence
 * @param seq2 - Second type sequence
 * @param weights - Optional custom metric weights
 * @returns Combined similarity score (0-1)
 */
export function combinedSimilarity(
  seq1: string,
  seq2: string,
  weights: MetricWeights = DEFAULT_WEIGHTS,
): number {
  return getCachedSimilarity(seq1, seq2, () => {
    const metrics = computeAllMetrics(seq1, seq2);

    return (
      metrics.jaccard * weights.jaccard +
      metrics.dice * weights.dice +
      metrics.jaro * weights.jaro +
      metrics.jaroWinkler * weights.jaroWinkler +
      metrics.cosine * weights.cosine +
      metrics.lcsRatio * weights.lcsRatio
    );
  });
}

/**
 * Quick similarity with early exit for performance
 *
 * Uses Jaccard as fast gate-keeper. If below threshold * 0.8,
 * skips expensive metrics and returns 0.
 *
 * @param seq1 - First type sequence
 * @param seq2 - Second type sequence
 * @param threshold - Minimum similarity threshold (default: 0.5)
 * @returns Combined similarity score (0-1) or 0 if below threshold
 */
export function quickSimilarity(seq1: string, seq2: string, threshold = 0.5): number {
  // Fast path: both empty
  if (seq1.length === 0 && seq2.length === 0) return 1;

  // Fast path: one empty
  if (seq1.length === 0 || seq2.length === 0) return 0;

  // Fast path: identical sequences
  if (seq1 === seq2) return 1;

  // Fast path: very different lengths (ratio < 0.5)
  const lenRatio = Math.min(seq1.length, seq2.length) / Math.max(seq1.length, seq2.length);
  if (lenRatio < 0.5) return 0;

  // Compute Jaccard first (fast)
  const jaccardSim = jaccard(seq1, seq2);

  // Early exit if Jaccard is way below threshold
  if (jaccardSim < threshold * 0.8) return 0;

  // Compute full similarity
  return combinedSimilarity(seq1, seq2);
}

// ============================================================================
// SET-BASED UTILITIES (for interface field comparison)
// ============================================================================

/**
 * Jaccard similarity for string sets
 * Useful for comparing interface fields
 */
export function jaccardSets(set1: Set<string>, set2: Set<string>): number {
  let intersection = 0;
  for (const item of set1) {
    if (set2.has(item)) intersection++;
  }

  const union = set1.size + set2.size - intersection;
  return union === 0 ? 1 : intersection / union;
}

/**
 * Dice similarity for string sets
 */
export function diceSets(set1: Set<string>, set2: Set<string>): number {
  let intersection = 0;
  for (const item of set1) {
    if (set2.has(item)) intersection++;
  }

  const total = set1.size + set2.size;
  return total === 0 ? 1 : (2 * intersection) / total;
}
