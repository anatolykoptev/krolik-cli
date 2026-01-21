/**
 * @module lib/@storage/semantic-search/types
 * @description Generic types for semantic search operations
 *
 * Provides reusable interfaces for embedding storage, semantic search,
 * and hybrid search algorithms across different storage modules.
 */

/**
 * Generic embedding storage record
 *
 * Represents a stored embedding for any entity (memory, doc section, etc.)
 */
export interface EmbeddingRow<TId = number> {
  /** Foreign key to the entity this embedding belongs to */
  entity_id: TId;
  /** Raw embedding vector stored as Buffer */
  embedding: Buffer;
  /** Timestamp when the embedding was created */
  created_at: string;
}

/**
 * Semantic search result with similarity score
 *
 * Generic result from semantic search operations
 */
export interface SemanticSearchResult<TId = number> {
  /** ID of the matching entity */
  entityId: TId;
  /** Cosine similarity score (0-1, higher = more similar) */
  similarity: number;
}

/**
 * Hybrid search options
 *
 * Configures weights and thresholds for combining BM25 + semantic search
 */
export interface HybridSearchOptions {
  /** Weight for semantic similarity (0-1, default 0.5) */
  semanticWeight?: number;
  /** Weight for BM25 text match (0-1, default 0.5) */
  bm25Weight?: number;
  /** Minimum semantic similarity threshold (0-1, default 0.3) */
  minSimilarity?: number;
  /** Maximum number of results to return */
  limit?: number;
}

/**
 * Entity with searchable content
 *
 * Generic interface for entities that support text-based search
 */
export interface SearchableEntity<TId = number> {
  /** Unique identifier */
  id: TId;
  /** Any additional properties */
  [key: string]: unknown;
}

/**
 * Search result with relevance score
 *
 * Generic result from BM25 or hybrid search
 */
export interface SearchResult<TEntity extends SearchableEntity> {
  /** The matching entity */
  entity: TEntity;
  /** Relevance score (0-100, higher = more relevant) */
  relevance: number;
}

/**
 * Embedding storage operations interface
 *
 * Generic CRUD operations for embeddings
 */
export interface EmbeddingStorage<TId = number> {
  /** Store an embedding for an entity */
  store(entityId: TId, text: string): Promise<boolean>;
  /** Delete an embedding */
  delete(entityId: TId): void;
  /** Check if an entity has an embedding */
  has(entityId: TId): boolean;
  /** Get embedding for an entity */
  get(entityId: TId): Float32Array | null;
  /** Get all embeddings (optionally filtered) */
  getAll(filter?: Record<string, unknown>): EmbeddingRow<TId>[];
  /** Count total embeddings */
  count(): number;
}

/**
 * Migration runner interface
 *
 * Generic interface for backfilling embeddings
 */
export interface MigrationRunner<TId = number> {
  /** Check if migration is complete */
  isComplete(): boolean;
  /** Get count of entities without embeddings */
  getMissingCount(): number;
  /** Get IDs of entities without embeddings */
  getWithoutEmbeddings(limit?: number): TId[];
  /** Run migration with progress callback */
  migrate(
    onProgress?: (processed: number, total: number) => void,
  ): Promise<{ processed: number; total: number }>;
  /** Ensure migration is started (non-blocking) */
  ensureMigrated(): void;
}

/**
 * Hybrid search algorithm interface
 *
 * Generic interface for combining BM25 + semantic search
 */
export interface HybridSearchAlgorithm<TEntity extends SearchableEntity> {
  /** Perform hybrid search */
  search(
    query: string,
    bm25Results: SearchResult<TEntity>[],
    semanticResults: SemanticSearchResult[],
    options?: HybridSearchOptions,
  ): SearchResult<TEntity>[];
}
