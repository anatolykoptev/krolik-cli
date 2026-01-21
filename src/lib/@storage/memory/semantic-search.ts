/**
 * @module lib/@storage/memory/semantic-search
 * @description Semantic search using sqlite-vec for k-NN
 *
 * Architecture:
 * - BLOB storage (memory_embeddings): stores raw embeddings
 * - vec0 index (memory_vec): k-NN search O(log n)
 */

import { logger } from '../../@core/logger';
import { getDatabase } from '../database';
import type {
  EmbeddingStorage,
  HybridSearchOptions as SharedHybridOptions,
} from '../semantic-search';
import {
  bufferToEmbedding,
  cosineSimilarity,
  createEmbeddingStorage,
  createMigrationRunner,
  createVec0Storage,
  hybridSearch as sharedHybridSearch,
} from '../semantic-search';
import { EMBEDDING_DIMENSION, generateEmbedding, isEmbeddingsAvailable } from './embeddings';
import { search } from './search';
import type { Memory, MemorySearchOptions, MemorySearchResult } from './types';

// ============================================================================
// TYPES
// ============================================================================

export interface SemanticSearchResult {
  memoryId: number;
  similarity: number;
}

export interface HybridSearchOptions extends MemorySearchOptions {
  semanticWeight?: number;
  bm25Weight?: number;
  minSimilarity?: number;
}

// ============================================================================
// STORAGE INSTANCES (lazy initialization)
// ============================================================================

type MemoryEntity = { id: number; title: string; description: string };

let _embeddingStorage: EmbeddingStorage<number> | null = null;
let _vec0Storage: ReturnType<typeof createVec0Storage> | null = null;
let _migrationRunner: ReturnType<typeof createMigrationRunner<number, MemoryEntity>> | null = null;

function getEmbeddingStorage() {
  if (!_embeddingStorage) {
    _embeddingStorage = createEmbeddingStorage<number>({
      db: getDatabase(),
      tableName: 'memory_embeddings',
      entityIdColumn: 'memory_id',
      getAllQuery: (filter) =>
        filter?.project
          ? {
              sql: `SELECT me.memory_id as entity_id, me.embedding, me.created_at
                  FROM memory_embeddings me
                  JOIN memories m ON me.memory_id = m.id
                  WHERE m.project = ?`,
              params: [filter.project],
            }
          : {
              sql: 'SELECT memory_id as entity_id, embedding, created_at FROM memory_embeddings',
              params: [],
            },
    });
  }
  return _embeddingStorage!;
}

function getVec0Storage() {
  if (!_vec0Storage) {
    _vec0Storage = createVec0Storage({
      db: getDatabase(),
      vecTableName: 'memory_vec',
      mapTableName: 'memory_vec_map',
      entityIdColumn: 'memory_id',
      dimension: EMBEDDING_DIMENSION,
    });
  }
  return _vec0Storage!;
}

function getMigrationRunner() {
  if (!_migrationRunner) {
    _migrationRunner = createMigrationRunner<number, MemoryEntity>({
      db: getDatabase(),
      storage: getEmbeddingStorage(),
      getMissingCountQuery: `
        SELECT COUNT(*) as count FROM memories m
        LEFT JOIN memory_embeddings me ON m.id = me.memory_id
        WHERE me.memory_id IS NULL
      `,
      getWithoutEmbeddingsQuery: `
        SELECT m.id FROM memories m
        LEFT JOIN memory_embeddings me ON m.id = me.memory_id
        WHERE me.memory_id IS NULL
        LIMIT ?
      `,
      getEntityQuery: 'SELECT id, title, description FROM memories WHERE id = ?',
      extractText: (m) => `${m.title} ${m.description}`,
      extractId: (m) => m.id,
    });
  }
  return _migrationRunner!;
}

// ============================================================================
// EMBEDDING CRUD
// ============================================================================

export async function storeEmbedding(memoryId: number, text: string): Promise<boolean> {
  const stored = await getEmbeddingStorage().store(memoryId, text);
  if (stored) {
    const embedding = getEmbeddingStorage().get(memoryId);
    if (embedding) {
      getVec0Storage().store(memoryId, embedding);
    }
  }
  return stored;
}

export function deleteEmbedding(memoryId: number): void {
  getEmbeddingStorage().delete(memoryId);
  getVec0Storage().delete(memoryId);
}

export function hasEmbedding(memoryId: number): boolean {
  return getEmbeddingStorage().has(memoryId);
}

export function getEmbedding(memoryId: number): Float32Array | null {
  return getEmbeddingStorage().get(memoryId);
}

// ============================================================================
// SEMANTIC SEARCH
// ============================================================================

export async function semanticSearch(
  query: string,
  options: { limit?: number; minSimilarity?: number; project?: string | undefined } = {},
): Promise<SemanticSearchResult[]> {
  if (!isEmbeddingsAvailable()) return [];

  const { limit = 10, minSimilarity = 0.3, project } = options;

  try {
    const { embedding: queryEmbedding } = await generateEmbedding(query);

    // vec0 k-NN search (O(log n))
    if (getVec0Storage().isAvailable()) {
      const results = project
        ? vec0SearchWithProject(queryEmbedding, limit, minSimilarity, project)
        : getVec0Storage()
            .search(queryEmbedding, { limit, minSimilarity })
            .map((r) => ({ memoryId: r.entityId, similarity: r.similarity }));

      if (results.length > 0) return results;
    }

    // Fallback: BLOB cosine similarity (O(n))
    return blobSearch(queryEmbedding, limit, minSimilarity, project);
  } catch {
    return [];
  }
}

function vec0SearchWithProject(
  queryEmbedding: Float32Array,
  limit: number,
  minSimilarity: number,
  project: string,
): SemanticSearchResult[] {
  try {
    const db = getDatabase();
    const vectorJson = JSON.stringify(Array.from(queryEmbedding));

    const rows = db
      .prepare(`
      SELECT mv.distance, mvm.memory_id
      FROM memory_vec mv
      JOIN memory_vec_map mvm ON mv.rowid = mvm.vec_rowid
      JOIN memories m ON mvm.memory_id = m.id
      WHERE mv.embedding MATCH ? AND m.project = ?
      ORDER BY mv.distance
      LIMIT ?
    `)
      .all(vectorJson, project, limit * 2) as Array<{ distance: number; memory_id: number }>;

    return rows
      .map((row) => ({
        memoryId: row.memory_id,
        similarity: Math.max(0, 1 - (row.distance * row.distance) / 2),
      }))
      .filter((r) => r.similarity >= minSimilarity)
      .slice(0, limit);
  } catch (error) {
    logger.debug(`vec0 project search failed: ${error}`);
    return [];
  }
}

function blobSearch(
  queryEmbedding: Float32Array,
  limit: number,
  minSimilarity: number,
  project?: string,
): SemanticSearchResult[] {
  const rows = getEmbeddingStorage().getAll(project ? { project } : undefined);

  return rows
    .map((row) => {
      const embedding = bufferToEmbedding(row.embedding);
      if (embedding.length !== EMBEDDING_DIMENSION) return null;
      return {
        memoryId: row.entity_id,
        similarity: cosineSimilarity(queryEmbedding, embedding),
      };
    })
    .filter((r): r is SemanticSearchResult => r !== null && r.similarity >= minSimilarity)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit);
}

// ============================================================================
// HYBRID SEARCH
// ============================================================================

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

  const bm25Results = search({ ...searchOptions, query, limit: limit * 2 });

  if (!isEmbeddingsAvailable()) {
    return bm25Results.slice(0, limit);
  }

  getMigrationRunner().ensureMigrated();

  const semanticResults = await semanticSearch(query, {
    limit: limit * 2,
    minSimilarity,
    project: searchOptions.project,
  });

  const combined = sharedHybridSearch(
    query,
    bm25Results.map((r) => ({
      entity: { ...r.memory, id: Number.parseInt(r.memory.id, 10) },
      relevance: r.relevance,
    })),
    semanticResults.map((r) => ({ entityId: r.memoryId, similarity: r.similarity })),
    { semanticWeight, bm25Weight, minSimilarity, limit } as SharedHybridOptions,
  );

  return combined.map((r) => ({
    memory: { ...r.entity, id: String(r.entity.id) } as Memory,
    relevance: r.relevance,
  }));
}

// ============================================================================
// MAINTENANCE
// ============================================================================

export const getEmbeddingsCount = () => getEmbeddingStorage().count();
export const getMissingEmbeddingsCount = () => getMigrationRunner().getMissingCount();
export const isVec0SearchAvailable = () => getVec0Storage().isAvailable();

export async function backfillEmbeddings(
  _batchSize = 50,
  onProgress?: (processed: number, total: number) => void,
): Promise<number> {
  if (!isEmbeddingsAvailable()) return 0;
  const result = await getMigrationRunner().migrate(onProgress);
  return result.processed;
}

export function migrateToVec0(onProgress?: (processed: number, total: number) => void): number {
  const vec0 = getVec0Storage();
  if (!vec0.isAvailable()) {
    logger.warn('vec0 not available');
    return 0;
  }

  const rows = getDatabase()
    .prepare(`
    SELECT me.memory_id, me.embedding
    FROM memory_embeddings me
    LEFT JOIN memory_vec_map mvm ON me.memory_id = mvm.memory_id
    WHERE mvm.memory_id IS NULL
  `)
    .all() as Array<{ memory_id: number; embedding: Buffer }>;

  if (rows.length === 0) return 0;

  let processed = 0;
  for (const row of rows) {
    try {
      const embedding = bufferToEmbedding(row.embedding);
      if (embedding.length === EMBEDDING_DIMENSION && vec0.store(row.memory_id, embedding)) {
        processed++;
      }
    } catch {
      /* skip */
    }

    if (onProgress && processed % 10 === 0) {
      onProgress(processed, rows.length);
    }
  }

  logger.info(`Migrated ${processed}/${rows.length} to vec0`);
  return processed;
}
