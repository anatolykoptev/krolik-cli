/**
 * @module lib/@storage/docs/migrate-embeddings
 * @description One-time migration to generate embeddings for existing doc sections
 *
 * This runs automatically on first semantic search if embeddings are missing.
 * After migration completes, all new doc sections should get embeddings automatically.
 */

import { getDatabase, prepareStatement } from '../database';
import { generateEmbedding, isEmbeddingsAvailable } from '../memory/embeddings';

// ============================================================================
// MIGRATION STATE
// ============================================================================

let migrationPromise: Promise<void> | null = null;
let migrationComplete = false;

/**
 * Check if migration has been completed
 */
export function isDocMigrationComplete(): boolean {
  return migrationComplete;
}

/**
 * Get count of doc sections without embeddings
 */
function getMissingCount(): number {
  const db = getDatabase();
  const sql = `
    SELECT COUNT(*) as count FROM doc_sections s
    LEFT JOIN doc_embeddings de ON s.id = de.section_id
    WHERE de.section_id IS NULL
  `;
  const row = prepareStatement<[], { count: number }>(db, sql).get();
  return row?.count ?? 0;
}

// ============================================================================
// MIGRATION
// ============================================================================

/**
 * Migrate existing doc sections to have embeddings
 *
 * This is idempotent - safe to call multiple times.
 * Runs in background, doesn't block the caller.
 *
 * @param onProgress - Optional callback for progress updates
 */
export async function migrateDocEmbeddings(
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
      // Get batch of doc sections without embeddings
      const sql = `
        SELECT s.id, s.title, s.content FROM doc_sections s
        LEFT JOIN doc_embeddings de ON s.id = de.section_id
        WHERE de.section_id IS NULL
        LIMIT ?
      `;
      const rows = prepareStatement<[number], { id: number; title: string; content: string }>(
        db,
        sql,
      ).all(batchSize);

      if (rows.length === 0) break;

      for (const row of rows) {
        try {
          // Combine title and content for embedding
          const text = `${row.title} ${row.content}`;
          const result = await generateEmbedding(text);

          // Store embedding
          const buffer = Buffer.from(result.embedding.buffer);
          const insertSql = `
            INSERT OR REPLACE INTO doc_embeddings (section_id, embedding, created_at)
            VALUES (?, ?, datetime('now'))
          `;
          prepareStatement<[number, Buffer]>(db, insertSql).run(row.id, buffer);

          processed++;
          if (onProgress) {
            onProgress(processed, total);
          }
        } catch {
          // Skip this section, continue with others
        }
      }
    }

    migrationComplete = true;
  })();

  await migrationPromise;
  return { processed, total };
}

/**
 * Ensure doc embeddings migration is started (non-blocking)
 *
 * Call this at the start of semantic search operations.
 * Starts migration in background, does NOT wait for completion.
 * Search works immediately with whatever embeddings exist.
 */
export function ensureDocEmbeddingsMigrated(): void {
  if (migrationComplete) return;

  // Start migration in background if not already running (fire and forget)
  if (!migrationPromise) {
    migrateDocEmbeddings().catch(() => {
      // Silently ignore migration errors
    });
  }
  // Don't await - let search proceed immediately
}
