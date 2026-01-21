/**
 * @module lib/@storage/docs/semantic-search
 * @description Semantic search for documentation using embeddings
 *
 * Provides:
 * - Store embeddings for doc sections
 * - Semantic search with cosine similarity
 * - Hybrid search combining BM25 + semantic
 *
 * Built on shared semantic-search module for consistency with memory system.
 */

import { getDatabase } from '../database';
import { isEmbeddingsAvailable } from '../memory/embeddings';
import {
  createEmbeddingStorage,
  createMigrationRunner,
  hybridSearch as sharedHybridSearch,
} from '../semantic-search';
import type {
  EmbeddingStorage,
  MigrationRunner,
  HybridSearchOptions as SharedHybridOptions,
} from '../semantic-search/types';
import { ensureDocEmbeddingsMigrated } from './migrate-embeddings';
import { searchDocs } from './search';
import type {
  DocSearchResult,
  DocSection,
  DocsHybridSearchOptions,
  SemanticSearchResult,
} from './types';

// ============================================================================
// STORAGE SETUP
// ============================================================================

/**
 * Create embedding storage instance for doc sections
 */
function createDocEmbeddingStorage(): EmbeddingStorage<number> {
  return createEmbeddingStorage({
    db: getDatabase(),
    tableName: 'doc_embeddings',
    entityIdColumn: 'section_id',
  });
}

/**
 * Create migration runner instance for doc embeddings
 */
function createDocMigrationRunner(): MigrationRunner<number> {
  const storage = createDocEmbeddingStorage();

  return createMigrationRunner({
    db: getDatabase(),
    storage,
    getMissingCountQuery: `
      SELECT COUNT(*) as count FROM doc_sections s
      LEFT JOIN doc_embeddings de ON s.id = de.section_id
      WHERE de.section_id IS NULL
    `,
    getWithoutEmbeddingsQuery: `
      SELECT s.id FROM doc_sections s
      LEFT JOIN doc_embeddings de ON s.id = de.section_id
      WHERE de.section_id IS NULL
      LIMIT ?
    `,
    getEntityQuery: 'SELECT id, title, content FROM doc_sections WHERE id = ?',
    extractText: (section: Record<string, unknown>) =>
      `${section.title} ${section.content}` as string,
    extractId: (section: Record<string, unknown>) => section.id as number,
  });
}

// Singleton instances
let storageInstance: EmbeddingStorage<number> | null = null;
let migrationInstance: MigrationRunner<number> | null = null;

function getStorage(): EmbeddingStorage<number> {
  if (!storageInstance) {
    storageInstance = createDocEmbeddingStorage();
  }
  return storageInstance;
}

function getMigration(): MigrationRunner<number> {
  if (!migrationInstance) {
    migrationInstance = createDocMigrationRunner();
  }
  return migrationInstance;
}

// ============================================================================
// EMBEDDING STORAGE
// ============================================================================

/**
 * Store embedding for a doc section
 *
 * @param sectionId - ID of the doc section
 * @param text - Text to embed (typically title + content)
 * @returns true if successful, false if embeddings unavailable
 *
 * @example
 * ```typescript
 * const saved = await storeDocEmbedding(123, 'React useEffect cleanup');
 * console.log(saved); // true
 * ```
 */
export async function storeDocEmbedding(sectionId: number, text: string): Promise<boolean> {
  return getStorage().store(sectionId, text);
}

/**
 * Delete embedding for a doc section
 *
 * @param sectionId - ID of the doc section
 */
export function deleteDocEmbedding(sectionId: number): void {
  getStorage().delete(sectionId);
}

/**
 * Check if a doc section has an embedding
 *
 * @param sectionId - ID of the doc section
 */
export function hasDocEmbedding(sectionId: number): boolean {
  return getStorage().has(sectionId);
}

/**
 * Get embedding for a doc section
 *
 * @param sectionId - ID of the doc section
 * @returns Float32Array embedding or null if not found
 */
export function getDocEmbedding(sectionId: number): Float32Array | null {
  return getStorage().get(sectionId);
}

// ============================================================================
// SEMANTIC SEARCH
// ============================================================================

/**
 * Semantic search using cosine similarity
 *
 * Compares query embedding against all stored embeddings.
 * Falls back to empty results if embeddings unavailable.
 *
 * @param query - Natural language query
 * @param options - Search options
 * @returns Array of section IDs with similarity scores
 *
 * @example
 * ```typescript
 * const results = await semanticDocSearch('server components hydration', {
 *   limit: 10,
 *   minSimilarity: 0.5,
 * });
 * ```
 */
export async function semanticDocSearch(
  query: string,
  options: {
    limit?: number | undefined;
    minSimilarity?: number | undefined;
    library?: string | undefined;
  } = {},
): Promise<SemanticSearchResult[]> {
  if (!isEmbeddingsAvailable()) {
    return [];
  }

  const { limit = 10, minSimilarity = 0.3 } = options;

  try {
    const { generateEmbedding } = await import('../memory/embeddings');
    const { cosineSimilarity } = await import('../semantic-search/cosine');

    // Generate query embedding
    const queryResult = await generateEmbedding(query);
    const queryEmbedding = queryResult.embedding;

    // Get all embeddings
    const embeddings = getStorage().getAll();

    // Calculate similarity for each
    const results: SemanticSearchResult[] = [];

    for (const row of embeddings) {
      const { bufferToEmbedding } = await import('../semantic-search/buffer-utils');
      const embedding = bufferToEmbedding(row.embedding);

      const similarity = cosineSimilarity(queryEmbedding, embedding);

      if (similarity >= minSimilarity) {
        results.push({
          sectionId: row.entity_id,
          similarity,
        });
      }
    }

    // Sort by similarity descending and limit
    return results.sort((a, b) => b.similarity - a.similarity).slice(0, limit);
  } catch {
    return [];
  }
}

// ============================================================================
// HYBRID SEARCH
// ============================================================================

/**
 * Hybrid search combining BM25 text match + semantic similarity
 *
 * Uses weighted combination of:
 * - BM25 (keyword match, precision)
 * - Semantic (meaning match, recall)
 *
 * Automatically:
 * - Migrates existing doc sections to have embeddings (one-time)
 * - Falls back to BM25-only if embeddings unavailable
 *
 * @param query - Search query
 * @param options - Hybrid search options
 * @returns Combined and re-ranked search results
 *
 * @example
 * ```typescript
 * const results = await hybridDocSearch('app router server actions', {
 *   library: 'next.js',
 *   semanticWeight: 0.6,
 *   bm25Weight: 0.4,
 *   limit: 10,
 * });
 * ```
 */
export async function hybridDocSearch(
  query: string,
  options: DocsHybridSearchOptions = {},
): Promise<DocSearchResult[]> {
  const {
    limit = 10,
    semanticWeight = 0.5,
    bm25Weight = 0.5,
    minSimilarity = 0.3,
    library,
    topic,
  } = options;

  // Get BM25 results first (always works)
  const bm25Results = searchDocs({
    query,
    library,
    topic,
    limit: limit * 2, // Fetch more to allow for merging
  });

  // If embeddings unavailable, return BM25 only
  if (!isEmbeddingsAvailable()) {
    return bm25Results.slice(0, limit);
  }

  // Start background migration for existing doc sections (non-blocking)
  ensureDocEmbeddingsMigrated();

  // Get semantic results
  const semanticResults = await semanticDocSearch(query, {
    limit: limit * 2,
    minSimilarity,
    library,
  });

  // If no semantic results, return BM25 only
  if (semanticResults.length === 0) {
    return bm25Results.slice(0, limit);
  }

  // Convert to shared types for hybrid algorithm
  // DocSection needs id for SearchableEntity compatibility
  const sharedBm25Results = bm25Results.map((r) => ({
    entity: {
      id: r.section.id,
      section: r.section,
      libraryName: r.libraryName,
    },
    relevance: r.relevance,
  }));

  const sharedSemanticResults = semanticResults.map((r) => ({
    entityId: r.sectionId,
    similarity: r.similarity,
  }));

  const sharedOptions: SharedHybridOptions = {
    semanticWeight,
    bm25Weight,
    minSimilarity,
    limit,
  };

  // Use shared hybrid algorithm
  const combined = sharedHybridSearch(
    query,
    sharedBm25Results,
    sharedSemanticResults,
    sharedOptions,
  );

  // Convert back to DocSearchResult format
  return combined.map((r) => ({
    section: r.entity.section as DocSection,
    libraryName: r.entity.libraryName as string,
    relevance: r.relevance,
  }));
}

// ============================================================================
// MAINTENANCE
// ============================================================================

/**
 * Get count of doc sections with embeddings
 */
export function getDocEmbeddingsCount(): number {
  return getStorage().count();
}

/**
 * Get count of doc sections without embeddings
 */
export function getMissingDocEmbeddingsCount(): number {
  return getMigration().getMissingCount();
}

/**
 * Backfill embeddings for existing doc sections
 *
 * @param onProgress - Optional callback for progress updates
 * @returns Number of embeddings created and total count
 */
export async function backfillDocEmbeddings(
  onProgress?: (processed: number, total: number) => void,
): Promise<{ processed: number; total: number }> {
  return getMigration().migrate(onProgress);
}
