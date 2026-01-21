/**
 * @module lib/@storage/semantic-search/migration-runner
 * @description Generic backfill runner for embeddings
 *
 * Provides a reusable runner for migrating existing entities to have
 * embeddings, with progress tracking and batch processing.
 */

import type { Database } from 'better-sqlite3';
import { isEmbeddingsAvailable } from '../memory/embeddings';
import type { EmbeddingStorage } from './types';

/**
 * Configuration for migration runner
 */
export interface MigrationRunnerConfig<TId = number, TEntity = Record<string, unknown>> {
  /** Database instance */
  db: Database;
  /** Embedding storage instance */
  storage: EmbeddingStorage<TId>;
  /** SQL query to count entities without embeddings */
  getMissingCountQuery: string;
  /** SQL query to get entities without embeddings */
  getWithoutEmbeddingsQuery: string;
  /** SQL query to get entity data for embedding generation */
  getEntityQuery: string;
  /** Function to extract text from entity for embedding */
  extractText: (entity: TEntity) => string;
  /** Function to extract ID from entity */
  extractId: (entity: TEntity) => TId;
}

/**
 * Migration state tracker
 */
interface MigrationState {
  promise: Promise<void> | null;
  complete: boolean;
}

/**
 * Create a reusable migration runner
 *
 * Factory function that returns migration operations with automatic
 * batch processing and progress tracking.
 *
 * @param config - Migration configuration
 * @returns Migration runner instance
 *
 * @example
 * ```typescript
 * // For memories
 * const memoryMigration = createMigrationRunner({
 *   db: getDatabase(),
 *   storage: memoryEmbeddings,
 *   getMissingCountQuery: `
 *     SELECT COUNT(*) as count FROM memories m
 *     LEFT JOIN memory_embeddings me ON m.id = me.memory_id
 *     WHERE me.memory_id IS NULL
 *   `,
 *   getWithoutEmbeddingsQuery: `
 *     SELECT m.id FROM memories m
 *     LEFT JOIN memory_embeddings me ON m.id = me.memory_id
 *     WHERE me.memory_id IS NULL
 *     LIMIT ?
 *   `,
 *   getEntityQuery: 'SELECT id, title, description FROM memories WHERE id = ?',
 *   extractText: (m) => `${m.title} ${m.description}`,
 *   extractId: (m) => m.id,
 * });
 *
 * // Run migration
 * const { processed, total } = await memoryMigration.migrate((p, t) => {
 *   console.log(`Progress: ${p}/${t}`);
 * });
 * ```
 */
export function createMigrationRunner<TId = number, TEntity = Record<string, unknown>>(
  config: MigrationRunnerConfig<TId, TEntity>,
) {
  const {
    db,
    storage,
    getMissingCountQuery,
    getWithoutEmbeddingsQuery,
    getEntityQuery,
    extractText,
    extractId,
  } = config;

  // Track migration state
  const state: MigrationState = {
    promise: null,
    complete: false,
  };

  /**
   * Check if migration is complete
   */
  function isComplete(): boolean {
    return state.complete;
  }

  /**
   * Get count of entities without embeddings
   */
  function getMissingCount(): number {
    const row = db.prepare(getMissingCountQuery).get() as { count: number };
    return row?.count ?? 0;
  }

  /**
   * Get IDs of entities without embeddings
   */
  function getWithoutEmbeddings(limit = 100): TId[] {
    const rows = db.prepare(getWithoutEmbeddingsQuery).all(limit) as Array<{ id: TId }>;
    return rows.map((r) => r.id);
  }

  /**
   * Run migration with progress callback
   */
  async function migrate(
    onProgress?: (processed: number, total: number) => void,
  ): Promise<{ processed: number; total: number }> {
    // Already migrated
    if (state.complete) {
      return { processed: 0, total: 0 };
    }

    // Migration in progress - wait for it
    if (state.promise) {
      await state.promise;
      return { processed: 0, total: 0 };
    }

    // Check if embeddings are available
    if (!isEmbeddingsAvailable()) {
      return { processed: 0, total: 0 };
    }

    const total = getMissingCount();
    if (total === 0) {
      state.complete = true;
      return { processed: 0, total: 0 };
    }

    let processed = 0;

    state.promise = (async () => {
      const batchSize = 50;

      while (true) {
        const entityIds = getWithoutEmbeddings(batchSize);
        if (entityIds.length === 0) break;

        for (const id of entityIds) {
          try {
            // Get entity data
            const entity = db.prepare(getEntityQuery).get(id) as TEntity;
            if (!entity) continue;

            // Extract text and store embedding
            const text = extractText(entity);
            const entityId = extractId(entity);
            await storage.store(entityId, text);

            processed++;
            if (onProgress) {
              onProgress(processed, total);
            }
          } catch {
            // Skip this entity, continue with others
          }
        }
      }

      state.complete = true;
    })();

    await state.promise;
    return { processed, total };
  }

  /**
   * Ensure migration is started (non-blocking)
   */
  function ensureMigrated(): void {
    if (state.complete) return;

    // Start migration in background if not already running (fire and forget)
    if (!state.promise) {
      migrate().catch(() => {
        // Silently ignore migration errors
      });
    }
    // Don't await - let caller proceed immediately
  }

  return {
    isComplete,
    getMissingCount,
    getWithoutEmbeddings,
    migrate,
    ensureMigrated,
  };
}
