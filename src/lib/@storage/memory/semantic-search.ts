/**
 * @module lib/@storage/memory/semantic-search
 * @description Semantic search using embeddings and cosine similarity
 *
 * Provides:
 * - Store embeddings for memories
 * - Semantic search with cosine similarity
 * - Hybrid search combining BM25 + semantic
 *
 * Falls back gracefully if embeddings are unavailable.
 */

import { getDatabase, prepareStatement } from '../database';
import {
  cosineSimilarity,
  EMBEDDING_DIMENSION,
  generateEmbedding,
  isEmbeddingsAvailable,
} from './embeddings';
import { ensureEmbeddingsMigrated } from './migrate-embeddings';
import { search } from './search';
import type { Memory, MemorySearchOptions, MemorySearchResult } from './types';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Semantic search result with similarity score
 */
export interface SemanticSearchResult {
  memoryId: number;
  similarity: number;
}

/**
 * Hybrid search options
 */
export interface HybridSearchOptions extends MemorySearchOptions {
  /** Weight for semantic similarity (0-1, default 0.5) */
  semanticWeight?: number;
  /** Weight for BM25 text match (0-1, default 0.5) */
  bm25Weight?: number;
  /** Minimum semantic similarity threshold (0-1, default 0.3) */
  minSimilarity?: number;
}

/**
 * Embedding storage record
 */
interface EmbeddingRow {
  memory_id: number;
  embedding: Buffer;
}

// ============================================================================
// EMBEDDING STORAGE
// ============================================================================

/**
 * Store embedding for a memory
 *
 * @param memoryId - ID of the memory
 * @param text - Text to embed (typically title + description)
 * @returns true if successful, false if embeddings unavailable
 *
 * @example
 * ```typescript
 * const saved = await storeEmbedding(123, 'Authentication with JWT tokens');
 * console.log(saved); // true
 * ```
 */
export async function storeEmbedding(memoryId: number, text: string): Promise<boolean> {
  if (!isEmbeddingsAvailable()) {
    return false;
  }

  try {
    const db = getDatabase();
    const result = await generateEmbedding(text);

    // Convert Float32Array to Buffer for SQLite storage
    const buffer = Buffer.from(result.embedding.buffer);

    const sql = `
      INSERT OR REPLACE INTO memory_embeddings (memory_id, embedding, created_at)
      VALUES (?, ?, datetime('now'))
    `;

    prepareStatement<[number, Buffer]>(db, sql).run(memoryId, buffer);
    return true;
  } catch {
    return false;
  }
}

/**
 * Store embeddings for multiple memories (batch)
 *
 * @param items - Array of {memoryId, text} pairs
 * @returns Number of successfully stored embeddings
 */
export async function storeEmbeddings(
  items: Array<{ memoryId: number; text: string }>,
): Promise<number> {
  let count = 0;
  for (const item of items) {
    const success = await storeEmbedding(item.memoryId, item.text);
    if (success) count++;
  }
  return count;
}

/**
 * Delete embedding for a memory
 *
 * @param memoryId - ID of the memory
 */
export function deleteEmbedding(memoryId: number): void {
  const db = getDatabase();
  const sql = 'DELETE FROM memory_embeddings WHERE memory_id = ?';
  prepareStatement<[number]>(db, sql).run(memoryId);
}

/**
 * Check if a memory has an embedding
 *
 * @param memoryId - ID of the memory
 */
export function hasEmbedding(memoryId: number): boolean {
  const db = getDatabase();
  const sql = 'SELECT 1 FROM memory_embeddings WHERE memory_id = ? LIMIT 1';
  const row = prepareStatement<[number], { 1: number }>(db, sql).get(memoryId);
  return row !== undefined;
}

/**
 * Get embedding for a memory
 *
 * @param memoryId - ID of the memory
 * @returns Float32Array embedding or null if not found
 */
export function getEmbedding(memoryId: number): Float32Array | null {
  const db = getDatabase();
  const sql = 'SELECT embedding FROM memory_embeddings WHERE memory_id = ?';
  const row = prepareStatement<[number], { embedding: Buffer }>(db, sql).get(memoryId);

  if (!row) return null;

  return new Float32Array(
    row.embedding.buffer.slice(
      row.embedding.byteOffset,
      row.embedding.byteOffset + row.embedding.byteLength,
    ),
  );
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
 * @returns Array of memory IDs with similarity scores
 *
 * @example
 * ```typescript
 * const results = await semanticSearch('how do we handle user sessions', {
 *   limit: 10,
 *   minSimilarity: 0.5,
 * });
 * ```
 */
export async function semanticSearch(
  query: string,
  options: {
    limit?: number | undefined;
    minSimilarity?: number | undefined;
    project?: string | undefined;
  } = {},
): Promise<SemanticSearchResult[]> {
  if (!isEmbeddingsAvailable()) {
    return [];
  }

  const { limit = 10, minSimilarity = 0.3, project } = options;

  try {
    const db = getDatabase();

    // Generate query embedding
    const queryResult = await generateEmbedding(query);
    const queryEmbedding = queryResult.embedding;

    // Get all embeddings (optionally filtered by project)
    const sql = project
      ? `SELECT me.memory_id, me.embedding
         FROM memory_embeddings me
         JOIN memories m ON me.memory_id = m.id
         WHERE m.project = ?`
      : 'SELECT memory_id, embedding FROM memory_embeddings';

    const params = project ? [project] : [];
    const rows = db.prepare(sql).all(...params) as EmbeddingRow[];

    // Calculate similarity for each
    const results: SemanticSearchResult[] = [];

    for (const row of rows) {
      const embedding = new Float32Array(
        row.embedding.buffer.slice(
          row.embedding.byteOffset,
          row.embedding.byteOffset + row.embedding.byteLength,
        ),
      );

      // Skip if dimension mismatch
      if (embedding.length !== EMBEDDING_DIMENSION) continue;

      const similarity = cosineSimilarity(queryEmbedding, embedding);

      if (similarity >= minSimilarity) {
        results.push({
          memoryId: row.memory_id,
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
 * - Migrates existing memories to have embeddings (one-time)
 * - Falls back to BM25-only if embeddings unavailable
 *
 * @param query - Search query
 * @param options - Hybrid search options
 * @returns Combined and re-ranked search results
 *
 * @example
 * ```typescript
 * const results = await hybridSearch('authentication tokens', {
 *   project: 'my-project',
 *   semanticWeight: 0.6,
 *   bm25Weight: 0.4,
 *   limit: 10,
 * });
 * ```
 */
export async function hybridSearch(
  query: string,
  options: HybridSearchOptions = {},
): Promise<MemorySearchResult[]> {
  const {
    limit = 10,
    semanticWeight = 0.5,
    bm25Weight = 0.5,
    minSimilarity = 0.3,
    ...searchOptions
  } = options;

  // Get BM25 results first (always works)
  const bm25Results = search({
    ...searchOptions,
    query,
    limit: limit * 2, // Fetch more to allow for merging
  });

  // If embeddings unavailable, return BM25 only
  if (!isEmbeddingsAvailable()) {
    return bm25Results.slice(0, limit);
  }

  // Start background migration for existing memories (non-blocking)
  ensureEmbeddingsMigrated();

  // Get semantic results
  const semanticResults = await semanticSearch(query, {
    limit: limit * 2,
    minSimilarity,
    project: searchOptions.project,
  });

  // If no semantic results, return BM25 only
  if (semanticResults.length === 0) {
    return bm25Results.slice(0, limit);
  }

  // Build score map
  const scoreMap = new Map<number, { memory: Memory; bm25: number; semantic: number }>();

  // Add BM25 scores (normalize to 0-1)
  const maxBm25 = Math.max(...bm25Results.map((r) => r.relevance), 1);
  for (const result of bm25Results) {
    const id = Number.parseInt(result.memory.id, 10);
    scoreMap.set(id, {
      memory: result.memory,
      bm25: result.relevance / maxBm25,
      semantic: 0,
    });
  }

  // Add semantic scores
  for (const result of semanticResults) {
    const existing = scoreMap.get(result.memoryId);
    if (existing) {
      existing.semantic = result.similarity;
    } else {
      // Need to fetch memory for semantic-only results
      const memoryFromBm25 = bm25Results.find(
        (r) => Number.parseInt(r.memory.id, 10) === result.memoryId,
      );
      if (memoryFromBm25) {
        scoreMap.set(result.memoryId, {
          memory: memoryFromBm25.memory,
          bm25: 0,
          semantic: result.similarity,
        });
      }
    }
  }

  // Calculate combined scores and sort
  const combined = Array.from(scoreMap.values())
    .map((item) => ({
      memory: item.memory,
      relevance: (item.bm25 * bm25Weight + item.semantic * semanticWeight) * 100,
    }))
    .sort((a, b) => b.relevance - a.relevance)
    .slice(0, limit);

  return combined;
}

// ============================================================================
// MAINTENANCE
// ============================================================================

/**
 * Get count of memories with embeddings
 */
export function getEmbeddingsCount(): number {
  const db = getDatabase();
  const sql = 'SELECT COUNT(*) as count FROM memory_embeddings';
  const row = prepareStatement<[], { count: number }>(db, sql).get();
  return row?.count ?? 0;
}

/**
 * Get count of memories without embeddings
 */
export function getMissingEmbeddingsCount(): number {
  const db = getDatabase();
  const sql = `
    SELECT COUNT(*) as count FROM memories m
    LEFT JOIN memory_embeddings me ON m.id = me.memory_id
    WHERE me.memory_id IS NULL
  `;
  const row = prepareStatement<[], { count: number }>(db, sql).get();
  return row?.count ?? 0;
}

/**
 * Get IDs of memories without embeddings
 */
export function getMemoriesWithoutEmbeddings(limit = 100): number[] {
  const db = getDatabase();
  const sql = `
    SELECT m.id FROM memories m
    LEFT JOIN memory_embeddings me ON m.id = me.memory_id
    WHERE me.memory_id IS NULL
    LIMIT ?
  `;
  const rows = prepareStatement<[number], { id: number }>(db, sql).all(limit);
  return rows.map((r) => r.id);
}

/**
 * Backfill embeddings for existing memories
 *
 * @param batchSize - Number of memories to process per batch
 * @param onProgress - Callback for progress updates
 * @returns Total number of embeddings created
 */
export async function backfillEmbeddings(
  batchSize = 50,
  onProgress?: (processed: number, total: number) => void,
): Promise<number> {
  if (!isEmbeddingsAvailable()) {
    return 0;
  }

  const db = getDatabase();
  let totalProcessed = 0;
  const totalMissing = getMissingEmbeddingsCount();

  while (true) {
    const memoryIds = getMemoriesWithoutEmbeddings(batchSize);
    if (memoryIds.length === 0) break;

    for (const id of memoryIds) {
      // Get memory title and description
      const sql = 'SELECT title, description FROM memories WHERE id = ?';
      const row = prepareStatement<[number], { title: string; description: string }>(db, sql).get(
        id,
      );

      if (row) {
        const text = `${row.title} ${row.description}`;
        await storeEmbedding(id, text);
        totalProcessed++;

        if (onProgress) {
          onProgress(totalProcessed, totalMissing);
        }
      }
    }
  }

  return totalProcessed;
}
