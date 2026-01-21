/**
 * @module lib/@storage/semantic-search/buffer-utils
 * @description Buffer conversion utilities for embedding storage
 *
 * Provides safe conversions between Float32Array embeddings and
 * Buffer format for SQLite storage, handling byte offsets correctly.
 */

/**
 * Convert Float32Array embedding to Buffer for SQLite storage
 *
 * Creates a Buffer from the underlying ArrayBuffer, properly copying
 * the data to avoid reference issues.
 *
 * @param embedding - Float32Array embedding vector
 * @returns Buffer ready for SQLite storage
 *
 * @example
 * ```typescript
 * const embedding = new Float32Array([0.1, 0.2, 0.3]);
 * const buffer = embeddingToBuffer(embedding);
 * db.prepare('INSERT INTO embeddings VALUES (?)').run(buffer);
 * ```
 */
export function embeddingToBuffer(embedding: Float32Array): Buffer {
  return Buffer.from(embedding.buffer);
}

/**
 * Convert Buffer from SQLite to Float32Array embedding
 *
 * Creates a new Float32Array from the Buffer data, handling
 * byte offsets correctly to avoid data corruption.
 *
 * IMPORTANT: Always creates a new ArrayBuffer slice to avoid
 * issues with Buffer's internal byte offset and length.
 *
 * @param buffer - Buffer from SQLite storage
 * @returns Float32Array embedding vector
 *
 * @example
 * ```typescript
 * const row = db.prepare('SELECT embedding FROM embeddings WHERE id = ?').get(1);
 * const embedding = bufferToEmbedding(row.embedding);
 * console.log(embedding.length); // 384 (for MiniLM model)
 * ```
 */
export function bufferToEmbedding(buffer: Buffer): Float32Array {
  // Create a new ArrayBuffer slice to handle byte offset correctly
  return new Float32Array(
    buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength),
  );
}

/**
 * Validate embedding dimensions
 *
 * Checks if an embedding has the expected number of dimensions.
 * Useful for detecting corrupted or incompatible embeddings.
 *
 * @param embedding - Float32Array embedding vector
 * @param expectedDimension - Expected number of dimensions
 * @returns true if dimensions match
 *
 * @example
 * ```typescript
 * const embedding = bufferToEmbedding(row.embedding);
 * if (!validateDimensions(embedding, 384)) {
 *   console.warn('Invalid embedding dimensions');
 *   return null;
 * }
 * ```
 */
export function validateDimensions(embedding: Float32Array, expectedDimension: number): boolean {
  return embedding.length === expectedDimension;
}
