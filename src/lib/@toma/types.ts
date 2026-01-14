/**
 * @module lib/@toma/types
 * @description Core types for Toma-based similarity detection
 *
 * Toma approach: Token-based clone detection using abstract type sequences
 * and multi-metric similarity. Based on ICSE 2024 research showing 65x
 * faster performance than deep learning approaches with comparable accuracy.
 */

// ============================================================================
// TOKENIZATION TYPES
// ============================================================================

/**
 * Token types in abstract representation
 */
export type TokenType = 'keyword' | 'identifier' | 'literal' | 'operator' | 'punctuation';

/**
 * Subtypes for identifiers (context-aware classification)
 */
export type IdentifierSubtype = 'variable' | 'function' | 'type' | 'property' | 'method';

/**
 * Subtypes for literals
 */
export type LiteralSubtype = 'string' | 'number' | 'boolean' | 'null' | 'undefined' | 'regex';

/**
 * Abstract token representation
 */
export interface AbstractToken {
  /** Token type category */
  type: TokenType;
  /** Abstract representation (V, F, T, P, M, S, N, or original for keywords/operators) */
  abstract: string;
  /** Original token text */
  original: string;
  /** Subtype for identifiers */
  identifierSubtype?: IdentifierSubtype;
  /** Subtype for literals */
  literalSubtype?: LiteralSubtype;
}

/**
 * Result of tokenization
 */
export interface TokenizationResult {
  /** Array of abstract tokens */
  tokens: AbstractToken[];
  /** Type sequence string (e.g., "V=F(V,V)") */
  typeSequence: string;
  /** Hash of type sequence for quick comparison */
  sequenceHash: string;
}

// ============================================================================
// SIMILARITY TYPES
// ============================================================================

/**
 * All similarity metrics computed for a pair
 */
export interface SimilarityMetrics {
  /** Jaccard similarity: |A ∩ B| / |A ∪ B| */
  jaccard: number;
  /** Dice coefficient: 2|A ∩ B| / (|A| + |B|) */
  dice: number;
  /** Jaro similarity: character-level matching */
  jaro: number;
  /** Jaro-Winkler: Jaro with prefix bonus */
  jaroWinkler: number;
  /** Cosine similarity: token frequency vectors */
  cosine: number;
  /** LCS ratio: longest common subsequence / max length */
  lcsRatio: number;
}

/**
 * Weights for combining metrics into final score
 */
export interface MetricWeights {
  jaccard: number;
  dice: number;
  jaro: number;
  jaroWinkler: number;
  cosine: number;
  lcsRatio: number;
}

/**
 * Default weights optimized for code similarity
 * Based on empirical testing on real codebases
 */
export const DEFAULT_WEIGHTS: MetricWeights = {
  jaccard: 0.25, // Good for set overlap
  dice: 0.2, // Similar to Jaccard but penalizes size difference
  jaro: 0.1, // Character-level, less important for code
  jaroWinkler: 0.15, // Prefix bonus helps with similar function names
  cosine: 0.2, // Good for token frequency
  lcsRatio: 0.1, // Sequence order matters less in abstract tokens
};

// ============================================================================
// THRESHOLDS
// ============================================================================

/**
 * Similarity thresholds for recommendations
 */
export const SIMILARITY_THRESHOLDS = {
  /** Above this: recommend merge */
  MERGE: 0.9,
  /** Above this: recommend rename/review */
  RENAME: 0.7,
  /** Below this: likely different intent */
  DIFFERENT: 0.5,
} as const;

/**
 * Minimum sequence length to consider for comparison
 * Filters out trivial one-liners
 */
export const MIN_SEQUENCE_LENGTH = 20;
