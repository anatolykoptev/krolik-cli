/**
 * @module lib/@storage/semantic-search
 * @description Shared semantic search utilities
 *
 * Provides reusable components for implementing semantic search
 * across different storage modules (memory, docs, etc.).
 *
 * Features:
 * - Generic embedding storage (CRUD operations)
 * - Migration runner for backfilling embeddings
 * - Hybrid search algorithm (BM25 + semantic)
 * - Cosine similarity calculation
 * - Buffer conversion utilities
 *
 * @example
 * ```typescript
 * import {
 *   createEmbeddingStorage,
 *   createMigrationRunner,
 *   hybridSearch,
 *   cosineSimilarity,
 * } from '@/lib/@storage/semantic-search';
 *
 * // Create storage for your entity type
 * const storage = createEmbeddingStorage({
 *   db: getDatabase(),
 *   tableName: 'my_embeddings',
 *   entityIdColumn: 'entity_id',
 * });
 *
 * // Store embeddings
 * await storage.store(123, 'text to embed');
 *
 * // Create migration runner
 * const migration = createMigrationRunner({
 *   db: getDatabase(),
 *   storage,
 *   // ... configuration
 * });
 *
 * // Backfill existing entities
 * await migration.migrate((processed, total) => {
 *   console.log(`Progress: ${processed}/${total}`);
 * });
 * ```
 */

// Buffer utilities
export { bufferToEmbedding, embeddingToBuffer, validateDimensions } from './buffer-utils';

// Cosine similarity
export { cosineSimilarity } from './cosine';
export type { EmbeddingStorageConfig } from './embedding-storage';

// Embedding storage factory
export { createEmbeddingStorage } from './embedding-storage';
// Hybrid search algorithm
export {
  calculateWeightedScore,
  hybridSearch,
  normalizeScores,
} from './hybrid-algorithm';
export type { MigrationRunnerConfig } from './migration-runner';
// Migration runner factory
export { createMigrationRunner } from './migration-runner';
// Types
export type {
  EmbeddingRow,
  EmbeddingStorage,
  HybridSearchAlgorithm,
  HybridSearchOptions,
  MigrationRunner,
  SearchableEntity,
  SearchResult,
  SemanticSearchResult,
} from './types';
export type {
  Vec0SearchOptions,
  Vec0SearchResult,
  Vec0Storage,
  Vec0StorageConfig,
} from './vec0-storage';
// Vec0 (sqlite-vec) storage factory
export { createVec0Storage } from './vec0-storage';
