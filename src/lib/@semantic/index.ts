/**
 * @module lib/@semantic
 * @description Semantic analysis modules
 *
 * Submodules:
 * - search: Reusable semantic search using Xenova embeddings
 */

// Semantic search
export { SemanticSearch } from './search';
export type {
  ScoringThresholds,
  SearchOptions,
  SearchResult,
  SearchStatus,
  SemanticSearchConfig,
} from './search/types';
export { DEFAULT_INIT_TIMEOUT, DEFAULT_THRESHOLDS } from './search/types';
