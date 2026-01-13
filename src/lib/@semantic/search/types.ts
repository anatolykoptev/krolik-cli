/**
 * @module lib/@semantic/search/types
 * @description Type definitions for semantic search
 */

/**
 * Configuration for semantic search
 */
export interface SemanticSearchConfig<T> {
  /** Extract unique identifier from item */
  getId: (item: T) => string;

  /** Extract text to embed from item */
  getText: (item: T) => string;

  /** Custom scoring thresholds (optional) */
  thresholds?: ScoringThresholds;

  /** Maximum time to wait for embeddings init (ms) */
  initTimeout?: number;

  /** Cache name for this search instance */
  cacheName?: string;
}

/**
 * Scoring thresholds for semantic similarity
 *
 * Note: MiniLM-L6-v2 produces lower scores for short texts.
 * Default thresholds are calibrated for typical use cases.
 */
export interface ScoringThresholds {
  /** Score for very high similarity (default: 0.50) */
  high: number;
  /** Score for medium similarity (default: 0.35) */
  medium: number;
  /** Score for low similarity (default: 0.25) */
  low: number;
  /** Points for high threshold (default: 15) */
  highPoints: number;
  /** Points for medium threshold (default: 10) */
  mediumPoints: number;
  /** Points for low threshold (default: 5) */
  lowPoints: number;
}

/**
 * Result of semantic search
 */
export interface SearchResult<T> {
  /** The matched item */
  item: T;
  /** Cosine similarity score (0-1) */
  similarity: number;
  /** Points based on thresholds */
  points: number;
}

/**
 * Search options for a single query
 */
export interface SearchOptions {
  /** Maximum results to return */
  maxResults?: number;
  /** Minimum similarity threshold to include */
  minSimilarity?: number;
}

/**
 * Status of semantic search availability
 */
export interface SearchStatus {
  /** Whether embeddings are available */
  available: boolean;
  /** Whether embeddings are currently loading */
  loading: boolean;
  /** Number of cached embeddings */
  cachedItems: number;
}

/**
 * Default scoring thresholds (calibrated for MiniLM-L6-v2)
 */
export const DEFAULT_THRESHOLDS: ScoringThresholds = {
  high: 0.5,
  medium: 0.35,
  low: 0.25,
  highPoints: 15,
  mediumPoints: 10,
  lowPoints: 5,
};

/**
 * Default init timeout (3 seconds)
 */
export const DEFAULT_INIT_TIMEOUT = 3000;
