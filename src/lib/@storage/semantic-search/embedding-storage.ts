/**
 * @module lib/@storage/semantic-search/embedding-storage
 * @description Generic embedding storage factory
 *
 * Provides a reusable factory for creating type-safe embedding CRUD
 * operations for any entity type (memories, doc sections, etc.).
 */

import type { Database } from 'better-sqlite3';
import { generateEmbedding } from '../memory/embeddings';
import { bufferToEmbedding, embeddingToBuffer } from './buffer-utils';
import type { EmbeddingRow, EmbeddingStorage } from './types';

/**
 * Configuration for embedding storage
 */
export interface EmbeddingStorageConfig<TId = number> {
  /** Database instance */
  db: Database;
  /** Table name for embeddings (e.g., 'memory_embeddings', 'doc_embeddings') */
  tableName: string;
  /** Column name for entity ID (e.g., 'memory_id', 'section_id') */
  entityIdColumn: string;
  /** Optional filter for getAll() (e.g., JOIN with parent table) */
  getAllQuery?: (filter?: Record<string, unknown>) => { sql: string; params: unknown[] };
  /** Convert entity ID to/from database format if needed */
  idSerializer?: {
    toDb: (id: TId) => unknown;
    fromDb: (dbId: unknown) => TId;
  };
}

/**
 * Create a type-safe embedding storage instance
 *
 * Factory function that returns CRUD operations for embeddings
 * with automatic type safety for entity IDs.
 *
 * @param config - Storage configuration
 * @returns Embedding storage operations
 *
 * @example
 * ```typescript
 * // For memories (numeric ID)
 * const memoryEmbeddings = createEmbeddingStorage({
 *   db: getDatabase(),
 *   tableName: 'memory_embeddings',
 *   entityIdColumn: 'memory_id',
 * });
 *
 * await memoryEmbeddings.store(123, 'Authentication with JWT tokens');
 * const embedding = memoryEmbeddings.get(123);
 *
 * // For docs (string ID)
 * const docEmbeddings = createEmbeddingStorage<string>({
 *   db: getDatabase(),
 *   tableName: 'doc_embeddings',
 *   entityIdColumn: 'section_id',
 *   idSerializer: {
 *     toDb: (id) => id,
 *     fromDb: (id) => String(id),
 *   },
 * });
 * ```
 */
export function createEmbeddingStorage<TId = number>(
  config: EmbeddingStorageConfig<TId>,
): EmbeddingStorage<TId> {
  const { db, tableName, entityIdColumn, idSerializer } = config;

  // Default ID serializer (assumes numeric IDs)
  const serialize = {
    toDb: idSerializer?.toDb ?? ((id: TId) => id as unknown),
    fromDb: idSerializer?.fromDb ?? ((dbId: unknown) => dbId as TId),
  };

  /**
   * Store embedding for an entity
   */
  async function store(entityId: TId, text: string): Promise<boolean> {
    try {
      const result = await generateEmbedding(text);
      const buffer = embeddingToBuffer(result.embedding);

      const sql = `
        INSERT OR REPLACE INTO ${tableName} (${entityIdColumn}, embedding, created_at)
        VALUES (?, ?, datetime('now'))
      `;

      db.prepare(sql).run(serialize.toDb(entityId), buffer);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Delete embedding for an entity
   */
  function deleteEmbedding(entityId: TId): void {
    const sql = `DELETE FROM ${tableName} WHERE ${entityIdColumn} = ?`;
    db.prepare(sql).run(serialize.toDb(entityId));
  }

  /**
   * Check if an entity has an embedding
   */
  function has(entityId: TId): boolean {
    const sql = `SELECT 1 FROM ${tableName} WHERE ${entityIdColumn} = ? LIMIT 1`;
    const row = db.prepare(sql).get(serialize.toDb(entityId));
    return row !== undefined;
  }

  /**
   * Get embedding for an entity
   */
  function get(entityId: TId): Float32Array | null {
    const sql = `SELECT embedding FROM ${tableName} WHERE ${entityIdColumn} = ?`;
    const row = db.prepare(sql).get(serialize.toDb(entityId)) as { embedding: Buffer } | undefined;

    if (!row) return null;

    return bufferToEmbedding(row.embedding);
  }

  /**
   * Get all embeddings (optionally filtered)
   */
  function getAll(filter?: Record<string, unknown>): EmbeddingRow<TId>[] {
    let sql: string;
    let params: unknown[];

    if (config.getAllQuery) {
      ({ sql, params } = config.getAllQuery(filter));
    } else {
      sql = `SELECT ${entityIdColumn} as entity_id, embedding, created_at FROM ${tableName}`;
      params = [];
    }

    const rows = db.prepare(sql).all(...params) as Array<{
      entity_id: unknown;
      embedding: Buffer;
      created_at: string;
    }>;

    return rows.map((row) => ({
      entity_id: serialize.fromDb(row.entity_id),
      embedding: row.embedding,
      created_at: row.created_at,
    }));
  }

  /**
   * Count total embeddings
   */
  function count(): number {
    const sql = `SELECT COUNT(*) as count FROM ${tableName}`;
    const row = db.prepare(sql).get() as { count: number };
    return row?.count ?? 0;
  }

  return {
    store,
    delete: deleteEmbedding,
    has,
    get,
    getAll,
    count,
  };
}
