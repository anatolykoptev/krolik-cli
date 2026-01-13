/**
 * @module lib/@semantic/search
 * @description Reusable semantic search module using Xenova embeddings
 *
 * Provides:
 * - Semantic similarity search across any collection
 * - Automatic embedding caching
 * - Graceful fallback when embeddings unavailable
 * - Configurable scoring thresholds
 *
 * Usage:
 * ```typescript
 * import { SemanticSearch } from '@/lib/@semantic/search';
 *
 * const search = new SemanticSearch({
 *   getId: (item) => item.name,
 *   getText: (item) => item.description,
 * });
 *
 * const results = await search.search('optimize performance', agents);
 * ```
 */

export { SemanticSearch } from './semantic-search';
export type {
  ScoringThresholds,
  SearchResult,
  SemanticSearchConfig,
} from './types';
