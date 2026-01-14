/**
 * @module lib/@toma
 * @description Toma-based similarity detection library
 *
 * A fast, lightweight approach to semantic code clone detection.
 * Based on ICSE 2024 research showing 65x faster performance than
 * deep learning approaches with comparable accuracy.
 *
 * Key features:
 * - Abstract tokenization: Converts code to type sequences (V, F, T, P, M, S, N)
 * - Multi-metric similarity: 6 metrics combined for robust comparison
 * - Fast detection: Hash-based Phase 1, fuzzy Phase 2
 *
 * @example
 * ```ts
 * import { abstractTokens, quickSimilarity } from '@/lib/@toma';
 *
 * const code1 = 'function add(a, b) { return a + b; }';
 * const code2 = 'function sum(x, y) { return x + y; }';
 *
 * const seq1 = abstractTokens(code1).typeSequence;
 * const seq2 = abstractTokens(code2).typeSequence;
 *
 * const similarity = quickSimilarity(seq1, seq2);
 * // similarity ≈ 1.0 (identical structure)
 * ```
 */

// Similarity metrics
export {
  clearSimilarityCache,
  combinedSimilarity,
  computeAllMetrics,
  cosine,
  dice,
  diceSets,
  jaccard,
  jaccardSets,
  jaro,
  jaroWinkler,
  lcsRatio,
  quickSimilarity,
} from './similarity';
// Tokenization
export {
  abstractTokens,
  abstractTypeDefinition,
  toSequenceHash,
  toTypeSequence,
} from './tokenization';
// Types
export type {
  AbstractToken,
  IdentifierSubtype,
  LiteralSubtype,
  MetricWeights,
  SimilarityMetrics,
  TokenizationResult,
  TokenType,
} from './types';
// Constants
export { DEFAULT_WEIGHTS, MIN_SEQUENCE_LENGTH, SIMILARITY_THRESHOLDS } from './types';
