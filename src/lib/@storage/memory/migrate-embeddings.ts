/**
 * @module lib/@storage/memory/migrate-embeddings
 * @description One-time migration to generate embeddings for existing memories
 *
 * This runs automatically on first semantic search if embeddings are missing.
 * After migration completes, all new memories get embeddings automatically via save().
 */

import { getDatabase, prepareStatement } from '../database';
import { generateEmbedding, isEmbeddingsAvailable } from './embeddings';

// ============================================================================
// MIGRATION STATE
// ============================================================================

let migrationPromise: Promise<void> | null = null;
let migrationComplete = false;

/**
 * Check if migration has been completed
 */
export function isMigrationComplete(): boolean {
  return migrationComplete;
}

/**
 * Get count of memories without embeddings
 */
function getMissingCount(): number {
  const db = getDatabase();
  const sql = `
    SELECT COUNT(*) as count FROM memories m
    LEFT JOIN memory_embeddings me ON m.id = me.memory_id
    WHERE me.memory_id IS NULL
  `;
  const row = prepareStatement<[], { count: number }>(db, sql).get();
  return row?.count ?? 0;
}

// ============================================================================
// MIGRATION
// ============================================================================

/**
 * Migrate existing memories to have embeddings
 *
 * This is idempotent - safe to call multiple times.
 * Runs in background, doesn't block the caller.
 *
 * @param onProgress - Optional callback for progress updates
 */
export async function migrateEmbeddings(
  onProgress?: (processed: number, total: number) => void,
): Promise<{ processed: number; total: number }> {
  // Already migrated
  if (migrationComplete) {
    return { processed: 0, total: 0 };
  }

  // Migration in progress - wait for it
  if (migrationPromise) {
    await migrationPromise;
    return { processed: 0, total: 0 };
  }

  // Check if embeddings are available
  if (!isEmbeddingsAvailable()) {
    return { processed: 0, total: 0 };
  }

  const total = getMissingCount();
  if (total === 0) {
    migrationComplete = true;
    return { processed: 0, total: 0 };
  }

  let processed = 0;

  migrationPromise = (async () => {
    const db = getDatabase();
    const batchSize = 50;

    while (true) {
      // Get batch of memories without embeddings
      const sql = `
        SELECT m.id, m.title, m.description FROM memories m
        LEFT JOIN memory_embeddings me ON m.id = me.memory_id
        WHERE me.memory_id IS NULL
        LIMIT ?
      `;
      const rows = prepareStatement<[number], { id: number; title: string; description: string }>(
        db,
        sql,
      ).all(batchSize);

      if (rows.length === 0) break;

      for (const row of rows) {
        try {
          const text = `${row.title} ${row.description}`;
          const result = await generateEmbedding(text);

          // Store embedding
          const buffer = Buffer.from(result.embedding.buffer);
          const insertSql = `
            INSERT OR REPLACE INTO memory_embeddings (memory_id, embedding, created_at)
            VALUES (?, ?, datetime('now'))
          `;
          prepareStatement<[number, Buffer]>(db, insertSql).run(row.id, buffer);

          processed++;
          if (onProgress) {
            onProgress(processed, total);
          }
        } catch {
          // Skip this memory, continue with others
        }
      }
    }

    migrationComplete = true;
  })();

  await migrationPromise;
  return { processed, total };
}

/**
 * Ensure embeddings migration is started (non-blocking)
 *
 * Call this at the start of semantic search operations.
 * Starts migration in background, does NOT wait for completion.
 * Search works immediately with whatever embeddings exist.
 */
export function ensureEmbeddingsMigrated(): void {
  if (migrationComplete) return;

  // Start migration in background if not already running (fire and forget)
  if (!migrationPromise) {
    migrateEmbeddings().catch(() => {
      // Silently ignore migration errors
    });
  }
  // Don't await - let search proceed immediately
}
