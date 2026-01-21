/**
 * @module lib/@storage/semantic-search/vec0-storage
 * @description Shared vec0 (sqlite-vec) storage for k-NN search
 *
 * Provides reusable vec0 functionality for any entity type (memory, agents, docs).
 * Falls back gracefully if sqlite-vec is not available.
 *
 * @example
 * ```typescript
 * const vec0Storage = createVec0Storage({
 *   db: getDatabase(),
 *   vecTableName: 'memory_vec',
 *   mapTableName: 'memory_vec_map',
 *   entityIdColumn: 'memory_id',
 *   dimension: 384,
 * });
 *
 * // Store embedding
 * vec0Storage.store(123, embedding);
 *
 * // K-NN search
 * const results = vec0Storage.search(queryEmbedding, { limit: 10 });
 * ```
 */

import type { Database } from 'better-sqlite3';
import { logger } from '../../@core/logger';
import { prepareStatement } from '../database';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Vec0 storage configuration
 */
export interface Vec0StorageConfig {
  /** Database instance */
  db: Database;
  /** Name of the vec0 virtual table (e.g., 'memory_vec') */
  vecTableName: string;
  /** Name of the mapping table (e.g., 'memory_vec_map') */
  mapTableName: string;
  /** Column name for entity ID in mapping table (e.g., 'memory_id') */
  entityIdColumn: string;
  /** Vector dimension (default: 384 for MiniLM-L6-v2) */
  dimension?: number;
}

/**
 * K-NN search result from vec0
 */
export interface Vec0SearchResult {
  entityId: number;
  distance: number;
  similarity: number;
}

/**
 * Vec0 search options
 */
export interface Vec0SearchOptions {
  /** Maximum results (default: 10) */
  limit?: number;
  /** Minimum similarity threshold (default: 0.3) */
  minSimilarity?: number;
  /** Additional WHERE clause for filtering */
  whereClause?: string;
  /** Parameters for the WHERE clause */
  whereParams?: (string | number)[];
}

/**
 * Vec0 storage interface
 */
export interface Vec0Storage {
  /** Check if vec0 is available */
  isAvailable(): boolean;
  /** Store embedding in vec0 */
  store(entityId: number, embedding: Float32Array): boolean;
  /** Delete embedding from vec0 */
  delete(entityId: number): void;
  /** K-NN search */
  search(queryEmbedding: Float32Array, options?: Vec0SearchOptions): Vec0SearchResult[];
  /** Get count of stored vectors */
  count(): number;
  /** Check if entity has vec0 embedding */
  has(entityId: number): boolean;
}

// ============================================================================
// VEC0 AVAILABILITY CHECK
// ============================================================================

/** Cached vec0 availability status per database */
const vec0AvailabilityCache = new Map<string, boolean>();

/**
 * Check if vec0 is available for a database
 */
function checkVec0Available(db: Database): boolean {
  const dbPath = db.name;

  if (vec0AvailabilityCache.has(dbPath)) {
    return vec0AvailabilityCache.get(dbPath)!;
  }

  try {
    const result = db.prepare('SELECT vec_version() as v').get() as { v: string } | undefined;
    const available = !!result?.v;
    vec0AvailabilityCache.set(dbPath, available);

    if (available) {
      logger.debug(`sqlite-vec ${result?.v} available for ${dbPath}`);
    }

    return available;
  } catch {
    vec0AvailabilityCache.set(dbPath, false);
    return false;
  }
}

// ============================================================================
// FACTORY
// ============================================================================

/**
 * Create vec0 storage for an entity type
 */
export function createVec0Storage(config: Vec0StorageConfig): Vec0Storage {
  const { db, vecTableName, mapTableName, entityIdColumn, dimension = 384 } = config;

  return {
    isAvailable(): boolean {
      return checkVec0Available(db);
    },

    store(entityId: number, embedding: Float32Array): boolean {
      if (!this.isAvailable()) return false;

      try {
        // Validate dimension
        if (embedding.length !== dimension) {
          logger.debug(`Dimension mismatch: expected ${dimension}, got ${embedding.length}`);
          return false;
        }

        // Convert to JSON for vec0
        const vectorJson = JSON.stringify(Array.from(embedding));

        // Check if already exists
        const existingSql = `SELECT vec_rowid FROM ${mapTableName} WHERE ${entityIdColumn} = ?`;
        const existing = prepareStatement<[number], { vec_rowid: number }>(db, existingSql).get(
          entityId,
        );

        if (existing) {
          // Update existing
          const updateSql = `UPDATE ${vecTableName} SET embedding = ? WHERE rowid = ?`;
          prepareStatement<[string, number]>(db, updateSql).run(vectorJson, existing.vec_rowid);
        } else {
          // Insert new
          const insertVecSql = `INSERT INTO ${vecTableName}(embedding) VALUES (?)`;
          const info = prepareStatement<[string]>(db, insertVecSql).run(vectorJson);

          const insertMapSql = `INSERT INTO ${mapTableName}(vec_rowid, ${entityIdColumn}) VALUES (?, ?)`;
          prepareStatement<[number, number]>(db, insertMapSql).run(
            info.lastInsertRowid as number,
            entityId,
          );
        }

        return true;
      } catch (error) {
        logger.debug(`Failed to store vec0 embedding: ${error}`);
        return false;
      }
    },

    delete(entityId: number): void {
      if (!this.isAvailable()) return;

      try {
        // Get vec rowid
        const getSql = `SELECT vec_rowid FROM ${mapTableName} WHERE ${entityIdColumn} = ?`;
        const mapping = prepareStatement<[number], { vec_rowid: number }>(db, getSql).get(entityId);

        if (mapping) {
          const deleteVecSql = `DELETE FROM ${vecTableName} WHERE rowid = ?`;
          prepareStatement<[number]>(db, deleteVecSql).run(mapping.vec_rowid);

          const deleteMapSql = `DELETE FROM ${mapTableName} WHERE ${entityIdColumn} = ?`;
          prepareStatement<[number]>(db, deleteMapSql).run(entityId);
        }
      } catch {
        // Ignore deletion errors
      }
    },

    search(queryEmbedding: Float32Array, options: Vec0SearchOptions = {}): Vec0SearchResult[] {
      if (!this.isAvailable()) return [];

      const { limit = 10, minSimilarity = 0.3, whereClause, whereParams = [] } = options;

      try {
        const vectorJson = JSON.stringify(Array.from(queryEmbedding));

        // Build SQL with optional WHERE clause
        let sql = `
          SELECT v.rowid, v.distance, m.${entityIdColumn} as entity_id
          FROM ${vecTableName} v
          JOIN ${mapTableName} m ON v.rowid = m.vec_rowid
          WHERE v.embedding MATCH ?
        `;

        const params: (string | number)[] = [vectorJson];

        if (whereClause) {
          sql += ` AND ${whereClause}`;
          params.push(...whereParams);
        }

        sql += ` ORDER BY v.distance LIMIT ?`;
        params.push(limit * 2); // Fetch extra for similarity filtering

        const rows = db.prepare(sql).all(...params) as Array<{
          rowid: number;
          distance: number;
          entity_id: number;
        }>;

        // Convert distance to similarity and filter
        const results: Vec0SearchResult[] = [];
        for (const row of rows) {
          // L2 distance to cosine similarity approximation
          // For normalized vectors: cos_sim ≈ 1 - (L2_dist² / 2)
          const similarity = Math.max(0, 1 - (row.distance * row.distance) / 2);

          if (similarity >= minSimilarity) {
            results.push({
              entityId: row.entity_id,
              distance: row.distance,
              similarity,
            });
          }
        }

        return results.slice(0, limit);
      } catch (error) {
        logger.debug(`vec0 search failed: ${error}`);
        return [];
      }
    },

    count(): number {
      if (!this.isAvailable()) return 0;

      try {
        const sql = `SELECT COUNT(*) as count FROM ${mapTableName}`;
        const row = prepareStatement<[], { count: number }>(db, sql).get();
        return row?.count ?? 0;
      } catch {
        return 0;
      }
    },

    has(entityId: number): boolean {
      if (!this.isAvailable()) return false;

      try {
        const sql = `SELECT 1 FROM ${mapTableName} WHERE ${entityIdColumn} = ? LIMIT 1`;
        const row = prepareStatement<[number], { 1: number }>(db, sql).get(entityId);
        return !!row;
      } catch {
        return false;
      }
    },
  };
}
